  // ====================================================================
  // auctions.js — "Auction House" tab: watchlist + BIN/auction alerts, the
  // trading-terminal ticker strip, the shared full-AH scan (scanAuctions,
  // also feeds ahflip.js + npcscan.js) and monitor mode (fullscreen dashboard
  // for a second monitor). Depends on core.js.
  // ====================================================================
  let auctionWatchlist = [];
  let auctionResults = {};     // watch term -> {bestBin, bestAuction, soonestAuction, matchCount}
  let auctionPrevResults = {}; // previous scan's results, kept for the ticker's up/down delta
  let auctionScanning = false;
  const WATCHLIST_STORAGE_KEY = 'skyblockFlipFinder_watchlist_v1';

  function saveWatchlist(){
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(auctionWatchlist));
    } catch (e) { /* negeer stil */ }
  }
  function loadWatchlist(){
    try {
      const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) auctionWatchlist = data;
    } catch (e) { /* corrupte of ontbrekende opslag — start gewoon leeg */ }
  }

  const AUC_ALERT_SOON_MS = 30 * 60000; // <30 min left — still shown as an info highlight, but no longer triggers the alert itself
  const MAX_AUCTION_REMAINING_MS = 2 * 24 * 60 * 60000; // 2 dagen — een "laagste veiling" die pas over 16 dagen afloopt is niet bruikbaar
  let auctionAutoTimer = null;
  let previouslyAlerting = new Set(); // which watch terms were alerting last render — only beep on new alerts

  function renderWatchlist(){
    saveWatchlist();
    const el = $('#aucWatchlist');
    if (auctionWatchlist.length === 0){
      el.innerHTML = '';
      return;
    }
    el.innerHTML = auctionWatchlist.map(w =>
      `<div class="chip">${w.iconUrl ? `<img class="item-icon" src="${escapeHTML(w.iconUrl)}" onerror="this.remove()">` : ''}${escapeHTML(w.displayName)}${w.alertPrice ? `<span style="color:var(--accent);font-size:11px;">&lt; ${fmtCoins(w.alertPrice)}</span>` : ''}<button class="chip-del" data-term="${escapeHTML(w.term)}" title="Verwijder">✕</button></div>`
    ).join('');
    el.querySelectorAll('.chip-del').forEach(btn => {
      btn.addEventListener('click', () => {
        auctionWatchlist = auctionWatchlist.filter(w => w.term !== btn.dataset.term);
        delete auctionResults[btn.dataset.term];
        renderWatchlist();
        renderAuctionResults();
      });
    });
  }

  // these three tabs (Auction House, AH Flip-scanner, NPC-verkoop) all share the one
  // full scan — each has its own scan button/status line/progress bar (separate
  // elements), but they're all driven together via a shared class (see app.js)
  function setAucScanUiState(scanning, statusText){
    $$('.auc-scan-btn').forEach(btn => btn.disabled = scanning);
    $$('.auc-progress-wrap').forEach(el => el.style.display = scanning ? 'block' : 'none');
    if (statusText !== undefined) $$('.auc-status-text').forEach(el => el.textContent = statusText);
  }

  async function scanAuctions(){
    if (auctionScanning) return;
    auctionScanning = true;
    setAucScanUiState(true, 'Bezig met scannen...');
    const freshResults = {};
    auctionWatchlist.forEach(w => { freshResults[w.term] = { bestBin: null, bestAuction: null, soonestAuction: null, matchCount: 0 }; });
    // globale tracker (los van de watchlist) voor de AH flip-scanner: per bazaar-item de
    // twee laagste actieve BIN's — genoeg om zowel AH-interne outliers als bazaar-arbitrage
    // te herkennen, zonder alle duizenden losse veilingen te hoeven onthouden
    const globalBins = {};
    const petBins = {}; // per (rarity+naam): goedkoopste lage-level + goedkoopste level-100(ish) BIN — zie Pet Flips tab
    const starBins = {}; // per (rarity+naam, alleen items uit starItemEssence): goedkoopste clean (0★) + 5★ BIN — zie Essence Flips tab
    const now = lastUpdated ? lastUpdated.getTime() : Date.now();

    try{
      const watchList = auctionWatchlist.map(w => ({ term: w.term, searchTerm: w.searchTerm }));
      const first = await fetchJsonSmart(AUCTIONS_URL + '?page=0');
      const totalPages = Math.min(first.totalPages || 1, MAX_AUCTION_PAGES);
      processAuctionPage(first, freshResults, watchList, now, globalBins, petBins, starBins);
      let done = 1;
      updateScanProgress(done, totalPages);

      const remainingPages = [];
      for (let p = 1; p < totalPages; p++) remainingPages.push(p);

      // fetch remaining pages with limited concurrency so we don't hammer the free proxies
      let cursor = 0;
      async function worker(){
        while (cursor < remainingPages.length){
          const p = remainingPages[cursor++];
          try{
            const pageJson = await fetchJsonSmart(AUCTIONS_URL + '?page=' + p);
            processAuctionPage(pageJson, freshResults, watchList, now, globalBins, petBins, starBins);
          }catch(e){ /* skip a failed page rather than aborting the whole scan */ }
          done++;
          updateScanProgress(done, totalPages);
        }
      }
      const workers = Array.from({length: Math.min(AUCTION_SCAN_CONCURRENCY, remainingPages.length)}, worker);
      await Promise.all(workers);

      // remember the previous best prices (for the ticker's up/down delta) before overwriting
      auctionPrevResults = auctionResults;
      auctionResults = freshResults;
      lastGlobalBins = globalBins;
      lastPetBins = petBins;
      lastStarBins = starBins;
      ahFlips = computeAhFlips(globalBins);
      setAucScanUiState(false, 'Laatste scan: ' + new Date().toLocaleTimeString('nl-NL') + ' — ' + totalPages + ' pagina\'s doorzocht.');
    }catch(err){
      setAucScanUiState(false, 'Scan mislukt: ' + (err.message || err));
    }finally{
      auctionScanning = false;
      setAucScanUiState(false);
      renderAuctionResults();
      renderAhFlipper();
      renderNpcScannerTab();
      renderPetFlipper();
      if (typeof renderEssenceFlips === 'function') renderEssenceFlips();
      if (typeof renderDashboard === 'function') renderDashboard();
    }
  }

  function updateScanProgress(done, total){
    const pct = Math.round((done/total)*100);
    $$('.auc-progress-fill').forEach(el => el.style.width = pct + '%');
    $$('.auc-progress-text').forEach(el => el.textContent = `Pagina ${done}/${total} doorzocht (${pct}%)`);
  }

  function processAuctionPage(pageJson, results, watchList, now, globalBins, petBins, starBins){
    const auctions = (pageJson && pageJson.auctions) || [];
    for (const a of auctions){
      if (!a.item_name) continue;
      if (a.end && a.end < now) continue; // defensively skip anything already ended
      const nameLower = a.item_name.toLowerCase();

      // AH flip-scanner: track the two cheapest BIN's per item, hele AH, maar ALLEEN voor
      // items die exact overeenkomen met een bazaar-item — dat garandeert een identiek,
      // stapelbaar item zonder enchants/reforges/sterren, dus een eerlijke vergelijking.
      if (globalBins && a.bin && a.starting_bid > 0){
        const exactId = itemNameToId[nameLower];
        if (exactId && bazaarData && bazaarData[exactId]){
          const price = a.starting_bid;
          const remaining = (a.end||0) - now;
          let g = globalBins[exactId];
          if (!g) g = globalBins[exactId] = { min1: null, min2: null };
          if (!g.min1 || price < g.min1.price){
            g.min2 = g.min1;
            g.min1 = { price, remaining };
          } else if (!g.min2 || price < g.min2.price){
            g.min2 = { price, remaining };
          }
        }
      }

      // Pet Flips: herkent "[Lvl N] Petnaam" BIN's (het level staat gewoon leesbaar in
      // item_name, geen NBT/item_bytes-parsing nodig) en onthoudt per (rarity+naam) de
      // goedkoopste lage-level (<=5) en hoge-level (>=95) vondst — genoeg om een "koop
      // laag, candy 'm naar 100, verkoop" paar te herkennen. Runes tonen ook "[Lvl N]"
      // maar gaan nooit naar level 95+, dus die vallen vanzelf weg (nooit een "high"-kant).
      if (petBins && a.bin && a.starting_bid > 0 && a.tier){
        const cleanName = a.item_name.replace(/§./g, '').trim();
        const lvlMatch = cleanName.match(/^\[Lvl (\d+)\]\s*(.+)$/);
        if (lvlMatch){
          const level = parseInt(lvlMatch[1], 10);
          const petName = lvlMatch[2].trim();
          if (petName && (level <= 5 || level >= 95)){
            const key = a.tier + '|' + petName;
            let pb = petBins[key];
            if (!pb) pb = petBins[key] = { name: petName, rarity: a.tier, low: null, high: null };
            const price = a.starting_bid;
            const remaining = (a.end||0) - now;
            if (level <= 5){
              if (!pb.low || price < pb.low.price) pb.low = { level, price, remaining };
            } else {
              if (!pb.high || price < pb.high.price) pb.high = { level, price, remaining };
            }
          }
        }
      }

      // Essence Flips: herkent "Itemnaam ✪✪✪✪✪" (5★, klaar om te verkopen) vs. de
      // "clean" 0★ versie (gewoon geen ✪'s aan het einde van de naam) via het ✪-symbool —
      // net zo leesbaar-in-de-naam als het pet-level hierboven, geen NBT-parsing nodig.
      // Alleen bijgehouden voor items die in starItemEssence staan (de instelbare lijst
      // onder Essence Flips) — dat houdt dit lichtgewicht in plaats van elk uniek
      // AH-itemnaam (de overgrote meerderheid wordt sowieso nooit 5★ verhandeld) te tracken.
      if (starBins && a.bin && a.starting_bid > 0 && a.tier && typeof starItemEssence === 'object'){
        const cleanName = a.item_name.replace(/§./g, '').trim();
        const starMatch = cleanName.match(/✪+$/);
        const starCount = starMatch ? starMatch[0].length : 0;
        if (starCount === 0 || starCount === 5){
          const baseName = (starCount > 0 ? cleanName.slice(0, -starCount) : cleanName).trim();
          if (Object.prototype.hasOwnProperty.call(starItemEssence, baseName)){
            const key = a.tier + '|' + baseName;
            let sb = starBins[key];
            if (!sb) sb = starBins[key] = { name: baseName, rarity: a.tier, clean: null, five: null };
            const price = a.starting_bid;
            const remaining = (a.end||0) - now;
            if (starCount === 0){
              if (!sb.clean || price < sb.clean.price) sb.clean = { price, remaining };
            } else {
              if (!sb.five || price < sb.five.price) sb.five = { price, remaining };
            }
          }
        }
      }

      for (const w of watchList){
        if (!nameLower.includes(w.searchTerm.toLowerCase())) continue;
        const bucket = results[w.term];
        bucket.matchCount++;
        const remaining = (a.end||0) - now;
        if (a.bin){
          const price = a.starting_bid;
          if (!bucket.bestBin || price < bucket.bestBin.price){
            bucket.bestBin = { price, remaining, itemName: a.item_name };
          }
        } else {
          const price = (a.highest_bid_amount && a.highest_bid_amount > 0) ? a.highest_bid_amount : a.starting_bid;
          // een veiling die pas over dagen afloopt is niet bruikbaar als "laagste veiling om
          // nu op te bieden" — die telt dus niet mee als kandidaat, ook al is de prijs laag
          if (remaining > 0 && remaining <= MAX_AUCTION_REMAINING_MS && (!bucket.bestAuction || price < bucket.bestAuction.price)){
            bucket.bestAuction = { price, remaining, itemName: a.item_name };
          }
          // track the soonest-ending active auction separately — the cheapest auction isn't
          // always the one about to expire, and the user wants to know about EITHER
          if (remaining > 0 && (!bucket.soonestAuction || remaining < bucket.soonestAuction.remaining)){
            bucket.soonestAuction = { price, remaining, itemName: a.item_name };
          }
        }
      }
    }
  }

  // simple two-tone beep via Web Audio API — no external asset needed, works offline
  function playAlertBeep(){
    if (!$('#aucSoundAlert').checked) return;
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1175].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i*0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.18 + 0.16);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i*0.18);
        osc.stop(ctx.currentTime + i*0.18 + 0.17);
      });
    }catch(e){ /* audio not available — silently skip */ }
  }

  // renders the top exchange-style ticker strip: one compact badge per watched item,
  // showing its current best BIN and an up/down delta vs. the previous scan.
  function renderTicker(){
    const strip = $('#aucTicker');
    if (Object.keys(auctionResults).length === 0 || auctionWatchlist.length === 0){
      strip.style.display = 'none';
      strip.innerHTML = '';
      return;
    }
    strip.style.display = 'flex';
    strip.innerHTML = auctionWatchlist.map(w => {
      const r = auctionResults[w.term];
      const prev = auctionPrevResults[w.term];
      const cur = r && r.bestBin ? r.bestBin.price : null;
      const prevPrice = prev && prev.bestBin ? prev.bestBin.price : null;
      let deltaHtml = '';
      if (cur !== null && prevPrice !== null && cur !== prevPrice){
        const up = cur > prevPrice;
        deltaHtml = `<span class="t-delta ${up?'up':'down'}">${up?'▲':'▼'} ${fmtCoins(Math.abs(cur - prevPrice))}</span>`;
      }
      const binAlert = !!(r && r.bestBin && w.alertPrice && r.bestBin.price < w.alertPrice);
      const isAlert = binAlert; // alleen een BIN onder je alertprijs telt als alert — een veiling die bijna afloopt niet meer
      return `<div class="ticker-item${isAlert?' alert':''}">
        ${w.iconUrl ? `<img class="item-icon" src="${escapeHTML(w.iconUrl)}" onerror="this.remove()">` : ''}
        <span class="t-sym">${escapeHTML(w.displayName.toUpperCase())}</span>
        <span class="t-price">${cur !== null ? fmtCoins(cur) : '—'}</span>
        ${deltaHtml}
        ${isAlert ? '<span></span>' : ''}
      </div>`;
    }).join('');
  }

  function renderAuctionResults(){
    const el = $('#aucTableWrap');
    const banner = $('#aucAlertBanner');
    if (auctionWatchlist.length === 0){
      el.innerHTML = `<div class="empty-state">Nog geen items op je watchlist. Voeg er hierboven een toe (naam of item-ID).</div>`;
      banner.innerHTML = '';
      renderTicker();
      return;
    }
    if (Object.keys(auctionResults).length === 0){
      el.innerHTML = `<div class="empty-state">Klik op "Zoeken in Auction House" om resultaten te zien.</div>`;
      banner.innerHTML = '';
      renderTicker();
      return;
    }

    const currentlyAlerting = new Set();
    const currentlyArbitraging = new Set();
    const rows = auctionWatchlist.map(w => {
      const r = auctionResults[w.term] || { bestBin: null, bestAuction: null, soonestAuction: null, matchCount: 0 };
      const binAlert = !!(r.bestBin && w.alertPrice && r.bestBin.price < w.alertPrice);
      // een bijna-aflopende veiling wordt nog wel getoond (zie soonAuction hieronder),
      // maar telt niet meer als "alert" — alleen een BIN onder je alertprijs doet dat
      const soonAuction = r.soonestAuction;
      const isAlert = binAlert;
      if (isAlert) currentlyAlerting.add(w.term);

      const arb = computeArbitrage(w, r);
      if (arb) currentlyArbitraging.add(w.term);

      const binHtml = (r.bestBin
        ? `<span class="v${binAlert?' hot':''}">${fmtCoins(r.bestBin.price)}</span><span class="t${r.bestBin.remaining<AUC_ALERT_SOON_MS?' soon':''}">${fmtDuration(r.bestBin.remaining)}</span>`
        : `<span class="v empty">geen BIN</span>`)
        + (arb ? `<span class="t-extra arb" title="Aanname: veiling = 1 stuk — check zelf de stack-grootte in-game. Een BIN kan bovendien al gekocht zijn tegen de tijd dat je het item opent.">Arbitrage: bazaar ≈ ${fmtCoins(arb.netBazaarSell)}/stuk netto → +${fmtCoins(arb.profit)} (${arb.profitPct.toFixed(1)}%) bij direct doorverkopen</span>` : '');
      // "laagste veiling" cell: the cheapest active auction, and — right in this same
      // cell rather than a separate column — a small extra line when a different
      // (pricier) auction on this item is the one actually about to end.
      const cheapestIsSoonest = !soonAuction || !r.bestAuction || soonAuction.remaining === r.bestAuction.remaining;
      const aucHtml = r.bestAuction
        ? `<span class="v${r.bestAuction.remaining<AUC_ALERT_SOON_MS?' hot':''}">${fmtCoins(r.bestAuction.price)}</span><span class="t${r.bestAuction.remaining<AUC_ALERT_SOON_MS?' soon':''}">${fmtDuration(r.bestAuction.remaining)}</span>`
          + (!cheapestIsSoonest && soonAuction ? `<span class="t-extra">⏰ ${fmtCoins(soonAuction.price)} loopt af over ${fmtDuration(soonAuction.remaining)}</span>` : '')
        : (soonAuction ? `<span class="v empty">geen veiling</span><span class="t-extra">⏰ ${fmtCoins(soonAuction.price)} loopt af over ${fmtDuration(soonAuction.remaining)}</span>` : `<span class="v empty">geen veiling</span>`);

      return `<tr class="${isAlert?'alert':''}${arb?' arb-row':''}">
        <td class="left">
          <div class="inst-symbol">
            ${w.iconUrl ? `<img class="item-icon" src="${escapeHTML(w.iconUrl)}" onerror="this.remove()">` : ''}
            <div class="names">
              <span class="n-main">${escapeHTML(w.displayName)}${isAlert?'<span class="n-alert-flag"></span>':''}</span>
              ${w.alertPrice ? `<span class="inst-badge">alert &lt; ${fmtCoins(w.alertPrice)}</span>` : ''}
            </div>
          </div>
        </td>
        <td class="inst-metric">${binHtml}</td>
        <td class="inst-metric">${aucHtml}</td>
        <td class="inst-matches">${fmtInt(r.matchCount)}</td>
      </tr>`;
    });

    const newAlerts = [...currentlyAlerting].filter(t => !previouslyAlerting.has(t));
    if (newAlerts.length > 0) playAlertBeep();
    previouslyAlerting = currentlyAlerting;

    const alertHtml = currentlyAlerting.size > 0
      ? `<div class="alert-banner">${currentlyAlerting.size} alert${currentlyAlerting.size>1?'s':''} actief: ${escapeHTML([...currentlyAlerting].map(t => (auctionWatchlist.find(w=>w.term===t)||{}).displayName || t).join(', '))}</div>`
      : '';
    const arbHtml = currentlyArbitraging.size > 0
      ? `<div class="alert-banner arb-banner">${currentlyArbitraging.size} arbitrage-kans${currentlyArbitraging.size>1?'en':''} (AH goedkoper dan bazaar): ${escapeHTML([...currentlyArbitraging].map(t => (auctionWatchlist.find(w=>w.term===t)||{}).displayName || t).join(', '))}</div>`
      : '';
    banner.innerHTML = alertHtml + arbHtml;

    el.innerHTML = `<div class="table-wrap"><table class="instrument-table"><thead><tr>
        <th class="left">Instrument</th><th>Laagste BIN</th><th>Laagste veiling</th><th>Matches</th>
      </tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
    renderTicker();
  }

  function enterMonitorMode(){
    document.body.classList.add('monitor-mode');
    $$('.tab-btn').forEach(b=>b.classList.remove('active'));
    $$('.panel').forEach(p=>p.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="auctions"]').classList.add('active');
    document.getElementById('panel-auctions').classList.add('active');
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(()=>{});
  }
  function exitMonitorMode(){
    document.body.classList.remove('monitor-mode');
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  }
