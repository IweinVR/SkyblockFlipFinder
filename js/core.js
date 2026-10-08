  // ====================================================================
  // core.js — shared engine: API fetching, localStorage persistence,
  // formatting helpers, market-health/order-book/stability checks and the
  // generic sortable-table renderer. Every other js/*.js file depends on
  // this one; it depends on none of them. Must load FIRST (see index.html).
  // ====================================================================
  const BAZAAR_URL = "https://api.hypixel.net/v2/skyblock/bazaar";
  const ITEMS_URL = "https://api.hypixel.net/v2/resources/skyblock/items";
  const AUCTIONS_URL = "https://api.hypixel.net/v2/skyblock/auctions";
  const MAX_AUCTION_PAGES = 60;      // safety cap in case totalPages ever grows unexpectedly
  const AUCTION_SCAN_CONCURRENCY = 6; // parallel page fetches during a scan
  // Try direct first, then a chain of public CORS proxies (Hypixel's API sends no
  // Access-Control-Allow-Origin header, so most browsers need a proxy hop).
  function buildProxySources(url){
    return [
      { url: url, parse: (t) => JSON.parse(t) },
      { url: "https://api.allorigins.win/raw?url=" + encodeURIComponent(url), parse: (t) => JSON.parse(t) },
      { url: "https://corsproxy.io/?url=" + encodeURIComponent(url), parse: (t) => JSON.parse(t) },
      { url: "https://thingproxy.freeboard.io/fetch/" + url, parse: (t) => JSON.parse(t) },
      { url: "https://api.allorigins.win/get?url=" + encodeURIComponent(url), parse: (t) => JSON.parse(JSON.parse(t).contents) },
    ];
  }
  // bazaar (every 5s) and item-metadata (once) source lists — both are just the
  // generic proxy chain above, built once per URL (was hand-duplicated 3x before).
  const FETCH_SOURCES = buildProxySources(BAZAAR_URL);
  const ITEMS_FETCH_SOURCES = buildProxySources(ITEMS_URL);
  // Category "icons" verwijderd voor een zakelijkere, tekst-only look.
  const CATEGORY_ICONS = {};
  const DEFAULT_CATEGORY_ICON = '';
  const REFRESH_SECONDS = 5;
  // stability-over-time thresholds (anti "bait order" defense)
  const STABILITY_MIN_STREAK = 3;      // needs to look consistent for this many consecutive refreshes
  const STABILITY_TOLERANCE = 0.15;    // price may drift up to 15% between refreshes and still count as "same"
  const SPARKLINE_MAX_POINTS = 15;     // how many recent refreshes the margin-history sparkline keeps
  // "Healthy market" thresholds used to strip out manipulated / thin-backlog items
  const MIN_ORDERS_PER_SIDE = 3;     // at least 3 separate player orders on each side
  const MIN_PRICE_TIERS = 2;         // at least 2 distinct price tiers in the order book
  const MAX_TOP_TIER_JUMP = 0.35;    // top order may not deviate >35% from the next tier
  const MIN_BACKLOG_COINS = 20000;   // minimum coin value actually sitting in open orders
  const MAX_SANE_MARGIN_PCT = 150;   // real, fillable bazaar flips essentially never sustain >150% margin;
                                      // anything above this is treated as bait/manipulation/stale data
  const CLIFF_PROBE_MULTIPLIER = 3;  // look this many times deeper into the book than what we actually fill
  const CLIFF_PROBE_MIN_QTY = 5000;  // ...but always probe at least this many units deep
  const CLIFF_DEVIATION = 0.4;       // if the deeper probe price differs >40% from our fill price, flag it

  let bazaarData = null;       // raw products object
  let lastUpdated = null;
  let bazaarFetchSeq = 0;      // bumped on every fetchBazaar() call so an older, slower
                                // in-flight request can't clobber a newer one's result
  let countdownTimer = null;
  let secondsLeft = REFRESH_SECONDS;
  let itemMeta = {};           // id -> {name, category}
  let itemMetaLoaded = false;
  let itemNameToId = {};       // lowercase display name -> id, for looking up bazaar prices by name (Mijn Trades)

  let lastGlobalBins = {}; // raw {id: {min1, min2}} from the most recent full scan — reused by the NPC-verkoop tab's AH side
  let lastPetBins = {}; // {rarity+'|'+petName: {name, rarity, low, high}} from the most recent full scan — reused by the Pet Flips tab
  let lastStarBins = {}; // {rarity+'|'+itemName: {name, rarity, clean, five}} from the most recent full scan — reused by the Essence Flips tab
  let auctionFastSourceIndex = null; // remember which proxy worked, skip trying the rest

  let bazaarPrevSnapshot = {};  // id -> {sell} top-of-book price from the PREVIOUS refresh — powers the live ticker's movers
  let tickerBuffer = [];        // rolling feed of recent big movers (newest first) — the global ticker scrolls through this
  let requestTimestamps = [];   // timestamps of recent outgoing fetch() calls — powers the "REQUESTS/MIN" readout
  let lastPingMs = null;        // latency (ms) of the most recent successful bazaar fetch — powers the "PING" readout

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // escapes item-names/zoektermen etc. voordat ze in innerHTML terechtkomen — deze
  // strings komen (indirect) van de Hypixel API of van vrije tekstinvoer van de
  // gebruiker, dus al is het risico klein, we vertrouwen ze niet blind.
  function escapeHTML(str){
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch]));
  }

  // ---------- persistence (localStorage) ----------
  // Bewaart je trades en watchlist in de browser zelf, zodat ze blijven staan als je de
  // pagina herlaadt of sluit. Let op: dit is per browser + per plek waar dit bestand staat —
  // als je dit .html-bestand vervangt door een nieuwe versie op hetzelfde pad in dezelfde
  // browser blijft het bewaard, maar in een andere browser of op een ander toestel niet.
  const TAX_STORAGE_KEY = 'skyblockFlipFinder_flipperTax_v1';
  const DEFAULT_FLIPPER_TAX = 0.0125;
  let flipperTaxRate = DEFAULT_FLIPPER_TAX;
  function saveFlipperTax(){
    try { localStorage.setItem(TAX_STORAGE_KEY, JSON.stringify(flipperTaxRate)); } catch (e) {}
  }
  function loadFlipperTax(){
    try {
      const raw = localStorage.getItem(TAX_STORAGE_KEY);
      if (raw === null) return;
      const val = JSON.parse(raw);
      if (typeof val === 'number' && val >= 0 && val < 1) flipperTaxRate = val;
    } catch (e) {}
  }

  // NPC-verkoopprijzen (voor de zero-risk NPC-scanner). Deze prijzen zijn al jaren erg
  // statisch in Skyblock (in tegenstelling tot bazaar-prijzen), dus we seeden een
  // ingebouwde standaardlijst — maar wel voorzichtig: alleen bij de allereerste keer
  // laden (niet elke sessie opnieuw overschrijven), pas nadat de item-database geladen
  // is (om namen naar de juiste item-ID te matchen), en zonder ooit een prijs te
  // overschrijven die de gebruiker zelf al heeft ingevuld/aangepast. Klopt een prijs
  // niet (meer)? Pas 'm gewoon aan of verwijder 'm in Instellingen.
  function fmtCoins(n){
    if (n === null || n === undefined || isNaN(n)) return "—";
    const sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    // full, non-abbreviated number with thousands separators (e.g. 1.756 instead of 1.7K)
    // cutoff at 99.95, not 100 — a value toFixed(1) would round UP to "100.0" (e.g.
    // 99.96) needs to fall into the whole-number branch below, not stay a one-decimal "100.0"
    if (n < 99.95) return sign + (Number.isInteger(n) ? n.toString() : n.toFixed(1).replace('.', ',')); // decimal only when it's not a whole number; nl-NL uses a comma here
    return sign + Math.round(n).toLocaleString('nl-NL');
  }
  function fmtInt(n){
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Math.round(n).toLocaleString('nl-NL');
  }
  function fmtPct(n){
    if (n === null || n === undefined || isNaN(n)) return "—";
    return (n>=0?"+":"") + n.toFixed(2).replace('.', ',') + "%"; // nl-NL comma, consistent with fmtCoins/fmtInt
  }
  // compact K/M/B notation (1.4B, 820M, 12K) — only used for "flavor" terminal readouts
  // (the market-status box) where a full number would be unreadable at a glance;
  // everything a user actually acts on (prices/profits) keeps using fmtCoins/fmtInt.
  function fmtAbbrev(n){
    if (n === null || n === undefined || isNaN(n)) return '—';
    const sign = n < 0 ? '-' : '';
    n = Math.abs(n);
    if (n >= 1e9) return sign + (n/1e9).toFixed(n>=1e11?0:1) + 'B';
    if (n >= 1e6) return sign + (n/1e6).toFixed(n>=1e8?0:1) + 'M';
    if (n >= 1e3) return sign + (n/1e3).toFixed(n>=1e5?0:1) + 'K';
    return sign + Math.round(n).toString();
  }
  function niceItemName(id){
    let s = id.replace(/_/g,' ').toLowerCase();
    s = s.replace(/\b\w/g, c => c.toUpperCase());
    return s;
  }

  // ---------- fetching ----------
  // Generic "try direct, then a chain of CORS proxies" fetcher, reused for both the
  // bazaar (every 5s) and the static item-metadata list (once on load).
  async function fetchWithSources(sources){
    const errors = [];
    for (let i = 0; i < sources.length; i++){
      const src = sources[i];
      try{
        logRequest();
        const res = await fetch(src.url, {cache:"no-store"});
        if (!res.ok) throw new Error("HTTP " + res.status);
        const text = await res.text();
        const json = src.parse(text);
        if (!json || !json.success) throw new Error("API meldde success:false");
        return { json, errors };
      }catch(err){
        errors.push((src.url.split('/')[2]||'?') + ': ' + (err.message || err));
      }
    }
    return { json: null, errors };
  }

  // Like fetchWithSources, but remembers which proxy worked last time and tries that
  // one FIRST — used for the auction scan, where we hit the same handful of working
  // sources dozens of times in a row and don't want to re-try 4 dead proxies per page.
  async function fetchJsonSmart(url){
    const sources = buildProxySources(url);
    if (auctionFastSourceIndex !== null && sources[auctionFastSourceIndex]){
      try{
        const src = sources[auctionFastSourceIndex];
        logRequest();
        const res = await fetch(src.url, {cache:"no-store"});
        if (res.ok){
          const text = await res.text();
          const json = src.parse(text);
          if (json && json.success !== false) return json;
        }
      }catch(e){ /* fall through to full search below */ }
    }
    for (let i = 0; i < sources.length; i++){
      try{
        const src = sources[i];
        logRequest();
        const res = await fetch(src.url, {cache:"no-store"});
        if (!res.ok) continue;
        const text = await res.text();
        const json = src.parse(text);
        if (!json || json.success === false) continue;
        auctionFastSourceIndex = i;
        return json;
      }catch(e){ /* try next source */ }
    }
    throw new Error('Alle databronnen faalden voor ' + url);
  }

  async function fetchBazaar(){
    // tag this call so that if a previous call is still in flight (a slow proxy, or the
    // auto-refresh firing again before the manual refresh button's request lands) and
    // resolves AFTER this one, its now-stale result gets dropped instead of silently
    // overwriting fresher data
    const seq = ++bazaarFetchSeq;
    setStatus('loading', 'Data ophalen...');
    const t0 = performance.now();
    const { json, errors } = await fetchWithSources(FETCH_SOURCES);
    if (seq !== bazaarFetchSeq) return; // a newer fetchBazaar() call has since started — ignore this stale result
    if (json){
      lastPingMs = Math.round(performance.now() - t0); // real round-trip latency — feeds the "PING" readout
      applyData(json);
    } else {
      setStatus('err', 'Kon geen data ophalen (alle bronnen faalden)');
      renderError(errors);
    }
  }

  async function fetchItemMeta(){
    // static-ish item catalogue (categories, display names) — fetched once, not every 5s
    const { json } = await fetchWithSources(ITEMS_FETCH_SOURCES);
    if (!json || !json.items) return;
    const map = {};
    for (const it of json.items){
      if (!it.id) continue;
      map[it.id] = {
        name: (it.name || '').replace(/§./g, '').trim() || null,
        category: it.category || null,
        material: it.material || null
      };
    }
    itemMeta = map;
    itemMetaLoaded = true;
    itemNameToId = {};
    for (const id in map){
      // first match for a given display name wins — two items can share a stripped
      // display name (rare, but it happens), and silently letting the last one in the
      // API response win would make name-based lookups flip between items unpredictably
      if (map[id].name && itemNameToId[map[id].name.toLowerCase()] === undefined){
        itemNameToId[map[id].name.toLowerCase()] = id;
      }
    }
    populateCategoryFilters();
    seedDefaultNpcPricesIfNeeded();
    // re-render with the newly available names/categories
    if (bazaarData){ renderBazaarTab(); renderCraftTab(); }
  }

  function populateCategoryFilters(){
    if (!bazaarData) return;
    const cats = new Set();
    for (const id in bazaarData){
      const meta = itemMeta[id];
      if (meta && meta.category) cats.add(meta.category);
    }
    const sorted = Array.from(cats).sort();
    ['bazaarCategory','craftCategory'].forEach(selectId => {
      const sel = document.getElementById(selectId);
      const current = sel.value;
      sel.innerHTML = '<option value="">Alle categorieën</option>' + sorted.map(c =>
        `<option value="${escapeHTML(c)}">${escapeHTML(niceItemName(c))}</option>`
      ).join('');
      if (sorted.includes(current)) sel.value = current;
    });
  }

  function getItemDisplay(id){
    const meta = itemMeta[id];
    const name = (meta && meta.name) ? meta.name : niceItemName(id);
    const category = meta ? meta.category : null;
    const icon = category ? (CATEGORY_ICONS[category] || DEFAULT_CATEGORY_ICON) : '';
    return { name, category, icon };
  }

  // looks up the CURRENT top-of-book instant-sell price for an item by its display
  // name (e.g. "Enchanted Honeycomb") — used to compare an open trade's target price
  // against what the bazaar is doing right now. Returns null if the item can't be
  // matched (not a bazaar item, or bazaar/item data hasn't loaded yet).
  function getCurrentSellPrice(itemName){
    if (!bazaarData || !itemName) return null;
    const id = itemNameToId[itemName.trim().toLowerCase()];
    if (!id || !bazaarData[id]) return null;
    const buySummary = bazaarData[id].buy_summary || [];
    if (buySummary.length === 0 || !buySummary[0].pricePerUnit) return null;
    return buySummary[0].pricePerUnit;
  }

  // ---------- AH ↔ Bazaar arbitrage ----------
  // For a watchlist item that ALSO trades on the bazaar: is the cheapest BIN on the
  // Auction House lower than what you'd get selling it right now on the bazaar? If so
  // that's a near-instant, low-risk flip (buy the BIN, immediately sell on the bazaar).
  // A minimum absolute + relative threshold filters out noise from tiny discrepancies
  // and (since we can't see the AH listing's stack size) keeps false positives down.
  // Used by both auctions.js (watchlist table) and ahflip.js (whole-AH scan).
  const ARB_MIN_PROFIT = 50;       // coins/unit
  const ARB_MIN_PROFIT_PCT = 2;    // %
  function computeArbitrage(w, r){
    if (!w.displayName || !r || !r.bestBin) return null;
    const bazaarSellPrice = getCurrentSellPrice(w.displayName);
    if (bazaarSellPrice === null) return null;
    const netBazaarSell = bazaarSellPrice * (1 - flipperTaxRate);
    const profit = netBazaarSell - r.bestBin.price;
    if (profit < ARB_MIN_PROFIT) return null;
    const profitPct = r.bestBin.price > 0 ? (profit / r.bestBin.price) * 100 : 0;
    if (profitPct < ARB_MIN_PROFIT_PCT) return null;
    return { profit, profitPct, bazaarSellPrice, netBazaarSell, binPrice: r.bestBin.price };
  }

  // ---------- item images (best-effort — vanilla Minecraft item textures via a public,
  // CORS-open CDN, keyed by the item's Minecraft "material"). Player-head-style items
  // (custom-textured skulls) are skipped since the generic skull texture would be
  // misleading — those just fall back to the category emoji instead. Any image that
  // fails to load is hidden client-side (onerror), never breaks the layout. ----------
  const ITEM_ICON_BASE = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.18.1/items/';
  const NO_ICON_MATERIALS = new Set(['PLAYER_HEAD','SKULL_ITEM','MOB_SPAWNER']);
  function getItemIconUrl(material){
    if (!material || NO_ICON_MATERIALS.has(material)) return null;
    return ITEM_ICON_BASE + material.toLowerCase() + '.png';
  }
  // resolve a typed watchlist term to a known item: matches either a skyblock item ID
  // (e.g. "HYPERION", "enchanted_book") or falls straight through as a free-text name
  // search. Returns {searchTerm, displayName, iconUrl} — searchTerm is what we match
  // against auction item_name strings with.
  function resolveAuctionTerm(raw){
    const norm = raw.trim().toUpperCase().replace(/[\s'-]+/g, '_');
    const meta = itemMeta[norm];
    if (meta){
      return {
        searchTerm: meta.name || niceItemName(norm),
        displayName: meta.name || niceItemName(norm),
        iconUrl: getItemIconUrl(meta.material)
      };
    }
    // no ID match — treat the raw input as a free-text name search, but still try to
    // find a matching item (by display name) so we can show an icon if possible
    const rawLower = raw.trim().toLowerCase();
    for (const id in itemMeta){
      const m = itemMeta[id];
      if (m.name && m.name.toLowerCase() === rawLower){
        return { searchTerm: raw.trim(), displayName: m.name, iconUrl: getItemIconUrl(m.material) };
      }
    }
    return { searchTerm: raw.trim(), displayName: raw.trim(), iconUrl: null };
  }

  function applyData(json){
    bazaarData = json.products;
    lastUpdated = json.lastUpdated ? new Date(json.lastUpdated) : new Date();
    setStatus('ok', 'Live — laatste update ' + lastUpdated.toLocaleTimeString('nl-NL'));
    if (itemMetaLoaded) populateCategoryFilters();
    renderBazaarTab();
    renderCraftTab();
    // keep "huidige marktprijs" in Mijn Trades live too — a lightweight, targeted DOM
    // update (not a full renderTradeLog) so it never clobbers text you're mid-typing
    // into an open sell form.
    if (typeof refreshTradePriceComparisons === 'function') refreshTradePriceComparisons();
    if (typeof renderNpcScannerTab === 'function') renderNpcScannerTab();
    if (typeof renderEnchantOptimizer === 'function') renderEnchantOptimizer();
    if (typeof renderDashboard === 'function') renderDashboard();
    computePriceMovers();
    renderMarketTicker();
    renderMarketStatusBox();
  }

  function setStatus(kind, text){
    const dot = $('#statusDot');
    dot.className = 'dot' + (kind==='err' ? ' err' : kind==='loading' ? ' loading' : '');
    $('#statusText').textContent = text;
    renderMarketStatusBox();
  }

  function renderError(errors){
    const detail = (errors && errors.length) ? `<br><span style="font-size:11px;opacity:.7;">${escapeHTML(errors.join(' · '))}</span>` : '';
    $('#bazaarTableWrap').innerHTML = `<div class="error-state">Kon geen live data ophalen — alle databronnen (direct + proxies) faalden. Dit kan door een tijdelijke storing bij een proxy komen.${detail}<br><button id="retryBtn">Opnieuw proberen</button></div>`;
    $('#craftTableWrap').innerHTML = `<div class="error-state">Kon geen live data ophalen.</div>`;
    $('#bazaarRecommend').innerHTML = '';
    $('#craftRecommend').innerHTML = '';
    const rb = document.getElementById('retryBtn');
    if (rb) rb.addEventListener('click', fetchBazaar);
  }

  // ---------- market health / anti-manipulation checks ----------
  function tierJumpOk(summary){
    if (!summary || summary.length < 2) return true; // handled separately by MIN_PRICE_TIERS
    const p0 = summary[0].pricePerUnit, p1 = summary[1].pricePerUnit;
    if (!p1) return true;
    return Math.abs(p0 - p1) / p1 <= MAX_TOP_TIER_JUMP;
  }
  function isHealthyMarket(product, qs){
    const sellSummary = product.sell_summary || [];
    const buySummary = product.buy_summary || [];
    const ordersOk = (qs.sellOrders||0) >= MIN_ORDERS_PER_SIDE && (qs.buyOrders||0) >= MIN_ORDERS_PER_SIDE;
    const tiersOk = sellSummary.length >= MIN_PRICE_TIERS && buySummary.length >= MIN_PRICE_TIERS;
    const jumpOk = tierJumpOk(sellSummary) && tierJumpOk(buySummary);
    const backlogCoins = (qs.sellPrice||0) * (qs.sellVolume||0) + (qs.buyPrice||0) * (qs.buyVolume||0);
    const backlogOk = backlogCoins >= MIN_BACKLOG_COINS;
    return ordersOk && tiersOk && jumpOk && backlogOk;
  }

  // ---------- order-book walking ----------
  // Instead of trusting the single top-of-book / weighted quick_status price (which a
  // single spoofed order can skew badly on thin items), we walk through the actual
  // order tiers to compute the REAL average price you'd pay/receive for a given
  // quantity — capped by an optional max quantity and/or max coin budget. This both
  // fixes unrealistic recommendations on manipulated items and lets a small/rare
  // fake order get diluted away once you ask for a meaningful quantity.
  function walkBook(summary, maxQty, maxBudget){
    const qtyLimit = (maxQty === null || maxQty === undefined || maxQty <= 0) ? Infinity : maxQty;
    const budgetLimit = (maxBudget === null || maxBudget === undefined || maxBudget <= 0) ? Infinity : maxBudget;
    let remainingQty = qtyLimit;
    let remainingBudget = budgetLimit;
    let filled = 0, totalCost = 0;
    for (const tier of (summary || [])){
      if (remainingQty <= 0 || remainingBudget <= 0) break;
      if (!tier || !tier.pricePerUnit || tier.pricePerUnit <= 0) continue;
      let take = Math.min(remainingQty, tier.amount || 0);
      let tierCost = take * tier.pricePerUnit;
      if (tierCost > remainingBudget){
        take = Math.floor(remainingBudget / tier.pricePerUnit);
        tierCost = take * tier.pricePerUnit;
      }
      if (take <= 0) continue;
      filled += take;
      totalCost += tierCost;
      remainingQty -= take;
      remainingBudget -= tierCost;
    }
    return { filled, totalCost, avgPrice: filled > 0 ? totalCost / filled : 0 };
  }

  // Look substantially deeper into the book than we actually need, to catch a
  // "wall" of stacked fake orders that's just deep enough to survive a shallow
  // walk. If the price shifts sharply once you look past what we filled, the
  // near-top price we used is propped up rather than a real, sustained price.
  function hasPriceCliff(summary, filledQty, filledAvgPrice){
    if (!filledQty || !filledAvgPrice) return false;
    const probeQty = Math.max(filledQty * CLIFF_PROBE_MULTIPLIER, CLIFF_PROBE_MIN_QTY);
    const probe = walkBook(summary, probeQty, Infinity);
    if (probe.filled < filledQty * 1.2) return false; // not enough extra depth to judge — don't flag on thin books alone
    if (!probe.avgPrice) return false;
    const deviation = Math.abs(filledAvgPrice - probe.avgPrice) / filledAvgPrice;
    return deviation > CLIFF_DEVIATION;
  }

  // ---------- stability-over-time tracking ----------
  // Compares this refresh's price against the last refresh's for the same item. A
  // consistent price across several 5-second refreshes is a strong signal this is a
  // real, standing order rather than a bait order that gets pulled seconds after
  // appearing. Returns {streak, stable}.
  function trackStability(historyMap, id, priceA, priceB, marginPct){
    const prev = historyMap[id];
    // computeBazaarRows/computeCraftRows run on every re-render — including ones
    // triggered by the user just touching a filter input, not only on a real 5s bazaar
    // refresh — so without this guard a few keystrokes in the budget box (no new data
    // at all) would inflate the streak and falsely flip "⏳ Nieuw" to "Stabiel". Key the
    // streak/history off the shared `lastUpdated` fetch timestamp (core.js) so repeat
    // calls within the same refresh just return the already-computed result untouched.
    const refreshKey = lastUpdated ? lastUpdated.getTime() : null;
    if (prev && refreshKey !== null && prev.refreshKey === refreshKey){
      return { streak: prev.streak, stable: prev.streak >= STABILITY_MIN_STREAK, history: prev.history };
    }
    const closeEnough = (a, b) => (a>0 && b>0) ? Math.abs(a-b)/b <= STABILITY_TOLERANCE : false;
    let streak = 1;
    if (prev && closeEnough(prev.priceA, priceA) && closeEnough(prev.priceB, priceB)){
      streak = prev.streak + 1;
    }
    // keep a short rolling history of margin% across refreshes — powers the "verloop"
    // sparkline so you can see at a glance whether a margin has been consistently good
    // or just spiked this one refresh, without having to sit and watch it yourself.
    const history = (prev && prev.history) ? prev.history.slice() : [];
    if (marginPct !== undefined && marginPct !== null && !isNaN(marginPct)){
      history.push(marginPct);
      if (history.length > SPARKLINE_MAX_POINTS) history.shift();
    }
    historyMap[id] = { streak, priceA, priceB, history, refreshKey };
    return { streak, stable: streak >= STABILITY_MIN_STREAK, history };
  }

  // tiny inline SVG sparkline of recent margin% readings — a STEPPED ("pixelated")
  // line, not a smooth diagonal one: each leg is colored green when that step went up,
  // red when it went down, with square joints/caps instead of rounded ones. Deliberately
  // no single flat "pretty" line color — this is meant to read like a ticker, not a
  // polished stock-app curve. Not enough data yet → a flat dash instead.
  function renderSparkline(history){
    if (!history || history.length < 2){
      return `<span class="spark-empty">—</span>`;
    }
    const W = 56, H = 20, pad = 2;
    const min = Math.min(...history), max = Math.max(...history);
    const range = (max - min) || 1;
    const x = i => pad + (i/(history.length-1)) * (W - pad*2);
    const y = v => H - pad - ((v - min) / range) * (H - pad*2);
    let segs = '';
    for (let i = 1; i < history.length; i++){
      const up = history[i] >= history[i-1];
      segs += `<path d="M${x(i-1).toFixed(1)},${y(history[i-1]).toFixed(1)} H${x(i).toFixed(1)} V${y(history[i]).toFixed(1)}" fill="none" stroke="${up?'var(--green)':'var(--red)'}" stroke-width="1.5" stroke-linecap="square"/>`;
    }
    const lastUp = history[history.length-1] >= history[0];
    const lastX = x(history.length-1), lastY = y(history[history.length-1]);
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="sparkline" title="Margin% laatste ${history.length} refreshes: ${history.map(v=>v.toFixed(1)+'%').join(' → ')}">
      ${segs}
      <rect x="${(lastX-2).toFixed(1)}" y="${(lastY-2).toFixed(1)}" width="4" height="4" fill="${lastUp?'var(--green)':'var(--red)'}"/>
    </svg>`;
  }

  function fmtDuration(ms){
    if (ms === null || ms === undefined) return '—';
    if (ms <= 0) return 'verlopen';
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (days > 0) return `${days}d ${hours}u`;
    if (hours > 0) return `${hours}u ${minutes}m`;
    return `${minutes}m`;
  }

  function parseShorthandNumber(raw){
    if (raw === null || raw === undefined) return null;
    let s = String(raw).trim().toLowerCase();
    if (s === '') return null;
    // nl-NL thousands-grouped plain number, e.g. "1.500" or "12.345,50" — exactly how
    // fmtCoins/fmtInt DISPLAY numbers elsewhere in this app. Without this, pasting a
    // value straight from the table (e.g. "1.500") would be silently misread below as
    // the decimal number 1.5 (dot treated as a decimal point instead of a thousands
    // separator), so strip the grouping dots first when the shape is unambiguous.
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(/,/g, '.');
    const m = s.match(/^(-?\d+(?:\.\d+)?)\s*([kmb])?$/);
    if (!m) { const n = parseFloat(s); return isNaN(n) ? null : n; }
    const num = parseFloat(m[1]);
    const mult = { k: 1e3, m: 1e6, b: 1e9 }[m[2]] || 1;
    return num * mult;
  }

  function updateTaxPctLabels(){
    const pctStr = (flipperTaxRate * 100).toFixed(2).replace(/\.?0+$/, '') || '0';
    $$('.tax-pct-bazaar').forEach(el => el.textContent = pctStr);
    $$('.tax-pct-craft').forEach(el => el.textContent = pctStr);
  }
  function profitClass(v){ return v >= 0 ? 'profit-pos' : 'profit-neg'; }
  function marginBadge(v){
    const cls = v >= 15 ? 'hi' : 'lo';
    return `<span class="margin-badge ${cls}">${fmtPct(v)}</span>`;
  }
  function volTag(v){
    const cls = v < 5000 ? 'low' : '';
    return `<span class="vol-tag ${cls}">${fmtInt(v)}</span>`;
  }
  function stabBadge(streak){
    const stable = streak >= STABILITY_MIN_STREAK;
    return stable
      ? `<span class="stab-badge stable">Stabiel (${streak}x)</span>`
      : `<span class="stab-badge new">⏳ Nieuw (${streak}x)</span>`;
  }

  function toggleSort(sortState, col){
    if (sortState.col === col){
      sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortState.col = col; sortState.dir = 'desc';
    }
  }

  function sortRows(rows, sortState){
    rows.sort((a,b) => {
      let av = a[sortState.col], bv = b[sortState.col];
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return sortState.dir==='asc' ? -1 : 1;
      if (av > bv) return sortState.dir==='asc' ? 1 : -1;
      return 0;
    });
  }

  // "flitsende prijsupdates": onthoudt de vorige numerieke waarde per (tabel, rij-id,
  // kolom) en levert een groene/rode flash-class zodra die waarde verandert tussen twee
  // renders — zo oplicht een cel heel even bij een live prijsbeweging (zie c.flash
  // hieronder), in plaats van dat de tabel er elke 5s gewoon "stil" anders uitziet.
  let cellFlashCache = {};
  function getCellFlashClass(containerSel, rowKey, colKey, rawVal){
    if (rawVal === null || rawVal === undefined || typeof rawVal !== 'number' || isNaN(rawVal)) return '';
    if (!cellFlashCache[containerSel]) cellFlashCache[containerSel] = {};
    const cache = cellFlashCache[containerSel];
    const cacheKey = rowKey + '|' + colKey;
    const prev = cache[cacheKey];
    cache[cacheKey] = rawVal;
    if (prev === undefined || prev === rawVal) return '';
    return rawVal > prev ? ' cell-flash-up' : ' cell-flash-down';
  }

  // onRowAction (optioneel): callback(row) — als meegegeven, krijgt elke rij een extra
  // "Zet in Mijn Trades"-knop, zodat je niet alleen de bovenste aanbeveling maar élke
  // rij rechtstreeks kan loggen.
  // detail (optioneel): {isOpen(row), onToggle(row), render(row)} — als meegegeven is
  // elke rij klikbaar en toont/verbergt een extra rij eronder (bv. de orderboek-
  // dieptegrafiek). isOpen/onToggle laten de aanroeper zélf bijhouden welke rijen
  // open staan (over refreshes heen); render(row) levert de HTML voor die extra rij.
  function renderTable(containerSel, rows, cols, sortState, onSort, onRowAction, detail){
    const displayRows = rows.slice(0, 300);
    const totalCols = cols.length + (onRowAction ? 1 : 0);
    let html = '<div class="table-wrap"><table><thead><tr>';
    if (onRowAction) html += '<th></th>';
    cols.forEach(c => {
      if (c.sortable === false){
        html += `<th class="${c.left?'left':''}">${c.label}</th>`;
        return;
      }
      const arrow = sortState.col === c.key ? (sortState.dir==='asc' ? '▲' : '▼') : '';
      html += `<th class="${c.left?'left':''}" data-col="${c.key}">${c.label}<span class="arrow">${arrow}</span></th>`;
    });
    html += '</tr></thead><tbody>';
    displayRows.forEach((r, i) => {
      const isOpen = !!(detail && detail.isOpen(r));
      html += `<tr class="${r.npcFlip ? 'npc-flip-row' : ''}${detail ? ' depth-toggle-row' : ''}" data-idx="${i}">`;
      if (onRowAction) html += `<td class="row-action-cell"><button class="row-add-trade-btn" title="Zet deze flip in Mijn Trades"></button></td>`;
      cols.forEach(c => {
        const val = r[c.key];
        const cellHtml = c.fmt ? c.fmt(val) : val;
        const clsExtra = c.cls ? c.cls(val) : '';
        if (c.left){
          const sub = c.sub ? `<span class="item-id">van ${escapeHTML(r[c.sub])}</span>` : `<span class="item-id">${escapeHTML(r.id)}</span>`;
          const iconHtml = c.icon && r.icon ? `<span class="cat-icon">${r.icon}</span>` : '';
          const npcBadge = r.npcFlip ? `<span class="npc-tag" title="Koop op de bazaar, verkoop direct aan een NPC in-game voor een vaste prijs — 100% risicovrij, geen flipper tax, geen wachten op een sell-order.">NPC-verkoop</span>` : '';
          // generic extra badge slot (opt-in via r.rowBadge, a trusted pre-built HTML
          // snippet) — e.g. craft.js uses this to flag a 2-step compacting chain
          const extraBadge = r.rowBadge || '';
          const depthIndicator = detail ? `<span class="depth-indicator" title="Klik voor orderboek-diepte">${isOpen ? '▾' : '▸'}</span>` : '';
          html += `<td class="left">${iconHtml}<span class="item-name">${escapeHTML(val)}</span>${sub}${npcBadge}${extraBadge}${depthIndicator}</td>`;
        } else {
          const flashCls = c.flash ? getCellFlashClass(containerSel, (r.id !== undefined ? r.id : i), c.key, val) : '';
          html += `<td class="${clsExtra}${flashCls}">${cellHtml}</td>`;
        }
      });
      html += '</tr>';
      if (detail && isOpen){
        html += `<tr class="row-detail-row"><td colspan="${totalCols}">${detail.render(r)}</td></tr>`;
      }
    });
    html += '</tbody></table></div>';
    if (rows.length > displayRows.length){
      html += `<p class="trade-note" style="margin-top:8px;">Toont de eerste ${displayRows.length} van ${rows.length} resultaten (gesorteerd) — verfijn je filters om de rest te zien.</p>`;
    }
    const el = document.querySelector(containerSel);
    el.innerHTML = html;
    el.querySelectorAll('th[data-col]').forEach(th => {
      th.addEventListener('click', () => onSort(th.dataset.col));
    });
    if (onRowAction){
      el.querySelectorAll('.row-add-trade-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation(); // don't also trigger the depth-chart row toggle below
          const idx = Number(btn.closest('tr').dataset.idx);
          const row = displayRows[idx];
          if (row) onRowAction(row);
        });
      });
    }
    if (detail){
      el.querySelectorAll('tbody tr.depth-toggle-row').forEach(tr => {
        tr.addEventListener('click', (e) => {
          if (e.target.closest('.row-add-trade-btn')) return;
          const idx = Number(tr.dataset.idx);
          const row = displayRows[idx];
          if (row) detail.onToggle(row);
        });
      });
    }
  }

  // small bar-chart rendering of one or more bazaar order-book sides (sell_summary /
  // buy_summary tiers) — no extra API call, this data is already in bazaarData. Used
  // by the Bazaar/Craft tabs' click-to-expand row detail (see renderTable's `detail`
  // option). panels: [{title, tiers, side:'buy'|'sell', highlightQty}], where
  // highlightQty (optional) shades the portion of the book this specific flip would
  // actually consume, so you can see at a glance how deep into the book you're going.
  function renderOrderBookDepth(panels){
    const colsHtml = (panels || []).map(p => {
      const tiers = (p.tiers || []).slice(0, 8); // "mini" chart — top 8 tiers is plenty
      if (tiers.length === 0){
        return `<div class="depth-col"><div class="depth-title">${escapeHTML(p.title)}</div><div class="depth-empty">Geen orders gevonden.</div></div>`;
      }
      const maxAmount = Math.max(...tiers.map(t => t.amount || 0), 1);
      const highlightQty = p.highlightQty || 0;
      let cumulative = 0;
      const rowsHtml = tiers.map(t => {
        const amt = t.amount || 0;
        const widthPct = Math.max(2, (amt / maxAmount) * 100);
        const before = cumulative;
        cumulative += amt;
        const filledHere = Math.max(0, Math.min(amt, highlightQty - before));
        const highlightHtml = filledHere > 0
          ? `<span class="depth-bar-highlight" style="width:${((filledHere/amt)*100).toFixed(1)}%" title="Jouw flip gebruikt hiervan ${fmtInt(filledHere)}"></span>` : '';
        return `<div class="depth-row">
          <span class="depth-price">${fmtCoins(t.pricePerUnit)}</span>
          <span class="depth-bar-track"><span class="depth-bar-fill ${p.side}" style="width:${widthPct.toFixed(1)}%">${highlightHtml}</span></span>
          <span class="depth-amount">${fmtInt(amt)}${t.orders ? ` <span class="depth-orders">(${fmtInt(t.orders)}x)</span>` : ''}</span>
        </div>`;
      }).join('');
      return `<div class="depth-col"><div class="depth-title">${escapeHTML(p.title)}</div>${rowsHtml}</div>`;
    }).join('');
    return `<div class="depth-wrap">${colsHtml}</div>`;
  }

  // ---------- generic dashboard widgets (stat cards + bar/donut charts) ----------
  // Pure rendering helpers: every caller hands over already-computed numbers (from
  // bazaar.js/craft.js/trades.js/npcscan.js's own compute*() functions) — nothing here
  // fetches or recalculates anything itself, so these are safe to reuse anywhere a
  // ranked list or a part-of-a-whole breakdown is useful (Dashboard tab, Mijn Trades).

  // cards: [{label, value, sub, cls}] — value/sub may contain trusted HTML (e.g. a
  // colored <span>) since callers build those from already-escaped/number-formatted
  // pieces; only label is treated as plain text and escaped here.
  function renderStatCards(containerSel, cards){
    const el = document.querySelector(containerSel);
    if (!el) return;
    el.innerHTML = cards.map(c => `<div class="stat-card${c.cls?(' '+c.cls):''}">
      <div class="stat-card-label">${escapeHTML(c.label)}</div>
      <div class="stat-card-value">${c.value}</div>
      ${c.sub ? `<div class="stat-card-sub">${c.sub}</div>` : ''}
    </div>`).join('');
  }

  // Horizontal bar chart — a ranked list (top flips, category averages, daily P/L)
  // is far easier to scan as bars than as a raw table. data: [{label, value, sub}],
  // already sorted/sliced by the caller. Negative values (a losing day) get a red
  // bar instead of the given color, same visual language as profit-pos/profit-neg.
  function renderBarChart(containerSel, data, opts){
    opts = opts || {};
    const valueFmt = opts.valueFmt || fmtCoins;
    const barColor = opts.barColor || 'var(--blue)';
    const el = document.querySelector(containerSel);
    if (!el) return;
    if (!data || data.length === 0){
      el.innerHTML = `<div class="chart-empty">Nog geen data.</div>`;
      return;
    }
    const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);
    el.innerHTML = `<div class="hbar-chart">` + data.map(d => {
      const pct = Math.max(2, (Math.abs(d.value) / maxVal) * 100);
      const neg = d.value < 0;
      return `<div class="hbar-row">
        <span class="hbar-label" title="${escapeHTML(d.label)}">${escapeHTML(d.label)}</span>
        <span class="hbar-track"><span class="hbar-fill${neg?' neg':''}" style="width:${pct.toFixed(1)}%;${neg?'':`background:${barColor};`}"></span></span>
        <span class="hbar-value">${valueFmt(d.value)}${d.sub ? `<span class="hbar-sub">${escapeHTML(d.sub)}</span>` : ''}</span>
      </div>`;
    }).join('') + `</div>`;
  }

  // Donut chart — for a simple "part of a whole" breakdown (market health, profit by
  // trade type). segments: [{label, value, color, fmtValue}] — fmtValue (optional)
  // lets the caller show the true signed number in the legend while the slice itself
  // uses a clamped-to-zero value (a donut can't draw a negative slice).
  function renderDonutChart(containerSel, segments, opts){
    opts = opts || {};
    const el = document.querySelector(containerSel);
    if (!el) return;
    const total = (segments||[]).reduce((s,x) => s + Math.max(0, x.value||0), 0);
    if (!segments || segments.length === 0 || total <= 0){
      el.innerHTML = `<div class="chart-empty">Nog geen data.</div>`;
      return;
    }
    const R = 52, C = 2 * Math.PI * R, CX = 70, CY = 70;
    let offset = 0;
    const arcs = segments.filter(s => (s.value||0) > 0).map(s => {
      const frac = s.value / total;
      const dash = frac * C;
      const circle = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${s.color}" stroke-width="18"
        stroke-dasharray="${dash.toFixed(2)} ${(C-dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${CX} ${CY})"/>`;
      offset += dash;
      return circle;
    }).join('');
    const centerLabel = opts.centerLabel || '';
    const centerValue = opts.centerValue !== undefined ? opts.centerValue : fmtInt(total);
    const legend = segments.map(s => `<div class="donut-legend-row">
        <span class="donut-dot" style="background:${s.color}"></span>
        <span class="donut-legend-label">${escapeHTML(s.label)}</span>
        <span class="donut-legend-value">${s.fmtValue !== undefined ? s.fmtValue : fmtInt(s.value)}${total>0 ? ` <span class="donut-pct">(${((Math.max(0,s.value)/total)*100).toFixed(0)}%)</span>` : ''}</span>
      </div>`).join('');
    el.innerHTML = `<div class="donut-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">${arcs}
        <text x="${CX}" y="${CY-3}" text-anchor="middle" font-size="18" font-weight="700" fill="var(--text)">${escapeHTML(String(centerValue))}</text>
        <text x="${CX}" y="${CY+14}" text-anchor="middle" font-size="9.5" fill="var(--text-faint)">${escapeHTML(centerLabel)}</text>
      </svg>
      <div class="donut-legend">${legend}</div>
    </div>`;
  }

  // ---------- live market ticker (global marquee) + market status box ----------
  // Pure "trading terminal" chrome: a scrolling strip of recent big bazaar price moves,
  // and a small server-status-style panel (API status, request rate, ping, est. market
  // volume). Every number shown is real (derived from the same bazaarData/requests this
  // app already does) — nothing here is simulated just for effect.
  const TICKER_MIN_PCT = 1.5;      // ignore moves smaller than this — keeps the ticker meaningful, not noisy
  const TICKER_MIN_PRICE = 50;     // ignore items whose price is too small for a % move to matter
  const TICKER_BUFFER_MAX = 40;    // how many recent movers the scrolling feed keeps
  const REQUEST_RATE_CEILING = 120; // flavor "budget" ceiling for the REQUESTS/MIN readout — not a real server limit

  function logRequest(){
    const now = Date.now();
    requestTimestamps.push(now);
    const cutoff = now - 60000;
    while (requestTimestamps.length && requestTimestamps[0] < cutoff) requestTimestamps.shift();
  }

  // compares this refresh's top-of-book sell price against the previous refresh's, per
  // item, and feeds any big-enough mover into the rolling ticker buffer (newest first).
  function computePriceMovers(){
    if (!bazaarData) return;
    const snap = {};
    for (const id in bazaarData){
      const p = bazaarData[id];
      const sell = (p.sell_summary && p.sell_summary[0]) ? p.sell_summary[0].pricePerUnit : null;
      if (!sell) continue;
      snap[id] = sell;
      const prevSell = bazaarPrevSnapshot[id];
      if (!prevSell || prevSell <= 0 || sell < TICKER_MIN_PRICE) continue;
      const pct = ((sell - prevSell) / prevSell) * 100;
      if (Math.abs(pct) < TICKER_MIN_PCT) continue;
      tickerBuffer.unshift({ source: 'BZ', name: getItemDisplay(id).name, price: sell, pct });
    }
    bazaarPrevSnapshot = snap;
    if (tickerBuffer.length > TICKER_BUFFER_MAX) tickerBuffer.length = TICKER_BUFFER_MAX;
  }

  function renderMarketTicker(){
    const track = $('#globalTickerTrack');
    if (!track) return;
    if (tickerBuffer.length === 0){
      track.style.animationDuration = '0s';
      track.innerHTML = `<span class="gticker-empty">Wachten op prijsbewegingen (≥${TICKER_MIN_PCT}%)...</span>`;
      return;
    }
    const itemsHtml = tickerBuffer.map(m => {
      const up = m.pct >= 0;
      return `<span class="gticker-item ${up?'up':'down'}">
        <span class="gt-dir">${up?'▲':'▼'}</span>
        <span class="gt-name">${escapeHTML(m.source)}:${escapeHTML(m.name.toUpperCase())}</span>
        <span class="gt-price">${fmtCoins(m.price)}</span>
        <span>(${up?'+':''}${m.pct.toFixed(1)}%)</span>
      </span>`;
    }).join('');
    // duplicate the feed so a translateX(-50%) loop is seamless, and scale the scroll
    // duration with content length so the apparent speed stays roughly constant
    track.innerHTML = itemsHtml + itemsHtml;
    track.style.animationDuration = Math.max(20, tickerBuffer.length * 3.5) + 's';
  }

  // sums (weekly bazaar volume × current top price) across every item, both sides,
  // then divides down to an estimated hourly coin turnover — a real (if rough) number,
  // not a decorative one. Feeds the market-status box's "EST. MARKET VOL".
  function computeEstMarketVolPerHour(){
    if (!bazaarData) return 0;
    let weeklyCoins = 0;
    for (const id in bazaarData){
      const p = bazaarData[id];
      const qs = p.quick_status;
      if (!qs) continue;
      const sellTop = (p.sell_summary && p.sell_summary[0]) ? p.sell_summary[0].pricePerUnit : 0;
      const buyTop = (p.buy_summary && p.buy_summary[0]) ? p.buy_summary[0].pricePerUnit : 0;
      weeklyCoins += (qs.sellMovingWeek||0) * sellTop + (qs.buyMovingWeek||0) * buyTop;
    }
    return weeklyCoins / (7*24);
  }

  function renderMarketStatusBox(){
    const apiEl = $('#msbApiStatus');
    if (!apiEl) return; // panel not in the DOM — defensive, shouldn't happen
    const dot = $('#statusDot');
    const isErr = dot && dot.classList.contains('err');
    const isLoading = dot && dot.classList.contains('loading');
    apiEl.textContent = isErr ? 'ERROR' : (isLoading ? 'SYNCING' : 'NOMINAL');
    apiEl.className = 'msb-val' + (isErr ? ' bad' : '');
    const now = Date.now();
    const cutoff = now - 60000;
    const reqPerMin = requestTimestamps.filter(t => t >= cutoff).length;
    $('#msbReqRate').textContent = reqPerMin + '/' + REQUEST_RATE_CEILING;
    $('#msbPing').textContent = lastPingMs !== null ? lastPingMs + 'ms' : '—';
    $('#msbMarketVol').textContent = fmtAbbrev(computeEstMarketVolPerHour()) + '/hr';
  }

  // ---------- auto refresh countdown ----------
  function tickCountdown(){
    secondsLeft -= 1;
    if (secondsLeft <= 0){
      secondsLeft = REFRESH_SECONDS;
      fetchBazaar();
    }
    $('#countdown').textContent = secondsLeft;
  }
