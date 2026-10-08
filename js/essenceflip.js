  // ====================================================================
  // essenceflip.js — "Essence Flips" tab: koop een "clean" (0★) dungeon-item
  // op de AH, koop de benodigde Essence op de bazaar om 'm naar 5★ te
  // upgraden, en verkoop 'm weer als 5★ op de AH. De clean/5★-paren worden
  // automatisch herkend tijdens de gedeelde AH-scan (zie de ✪-detectie in
  // auctions.js/processAuctionPage) — geen giswerk daar. De HOEVEELHEID
  // Essence per item is bewust NIET hardgecodeerd: die cijfers wijzigen
  // regelmatig door balans-patches en community-bronnen spraken elkaar
  // flink tegen bij het uitzoeken hiervan (bv. Livid Dagger: 860 vs. 210
  // Wither Essence totaal, afhankelijk van de bron/datum) — dus net als de
  // Kat-fee bij Pet Flips vul je dat zelf in (1x per item, 5 seconden werk
  // via de in-game Essence Shop), en onthoudt de app het daarna. Het
  // essence-TYPE per item (wel hieronder voorgeladen) verandert vrijwel
  // nooit en is op basis van de Hypixel Skyblock wiki. Depends on core.js.
  // ====================================================================

  const ESSENCE_TYPE_LABELS = {
    WITHER: 'Wither Essence', SPIDER: 'Spider Essence', UNDEAD: 'Undead Essence',
    DRAGON: 'Dragon Essence', GOLD: 'Gold Essence', DIAMOND: 'Diamond Essence',
    ICE: 'Ice Essence',
  };
  const ESSENCE_BAZAAR_IDS = {
    WITHER: 'ESSENCE_WITHER', SPIDER: 'ESSENCE_SPIDER', UNDEAD: 'ESSENCE_UNDEAD',
    DRAGON: 'ESSENCE_DRAGON', GOLD: 'ESSENCE_GOLD', DIAMOND: 'ESSENCE_DIAMOND',
    ICE: 'ESSENCE_ICE',
  };
  const ESSENCE_TYPE_LIST = Object.keys(ESSENCE_TYPE_LABELS);

  // itemnaam (exact zoals op de AH, zonder ✪'s) -> essence-type. Community-data (Hypixel
  // Skyblock wiki) — alleen het TYPE, bewust geen hoeveelheid (zie uitleg hierboven).
  const STAR_ITEM_ESSENCE_DEFAULTS = {
    'Livid Dagger': 'WITHER', 'Shadow Fury': 'WITHER', "Giant's Sword": 'WITHER',
    'Precursor Eye': 'WITHER', "Necron's Blade": 'WITHER', "Bonzo's Staff": 'WITHER',
    "Bonzo's Mask": 'WITHER', 'Spirit Sceptre': 'WITHER', 'Spirit Shortbow': 'WITHER',
    'Shadow Assassin Helmet': 'WITHER', 'Shadow Assassin Chestplate': 'WITHER',
    'Shadow Assassin Leggings': 'WITHER', 'Shadow Assassin Boots': 'WITHER',
    "Runaan's Bow": 'SPIDER', 'Tarantula Helmet': 'SPIDER', 'Tarantula Chestplate': 'SPIDER',
    'Tarantula Leggings': 'SPIDER', 'Tarantula Boots': 'SPIDER',
    'Reaper Falchion': 'UNDEAD', 'Revenant Falchion': 'UNDEAD', 'Reaper Scythe': 'UNDEAD',
    'Terminator': 'DRAGON', 'Aspect of the Dragons': 'DRAGON',
    'Superior Dragon Helmet': 'DRAGON', 'Superior Dragon Chestplate': 'DRAGON',
    'Superior Dragon Leggings': 'DRAGON', 'Superior Dragon Boots': 'DRAGON',
    "Midas' Sword": 'GOLD', 'Midas Staff': 'GOLD',
    'Ice Spray Wand': 'ICE', 'Frozen Scythe': 'ICE',
  };

  const STAR_ITEM_STORAGE_KEY = 'skyblockFlipFinder_starItemEssence_v1';
  let starItemEssence = {}; // naam -> {type, amount} — amount blijft null totdat de gebruiker 'm invult
  function saveStarItemEssence(){
    try { localStorage.setItem(STAR_ITEM_STORAGE_KEY, JSON.stringify(starItemEssence)); } catch (e) {}
  }
  function loadStarItemEssence(){
    const base = {};
    for (const name in STAR_ITEM_ESSENCE_DEFAULTS){
      base[name] = { type: STAR_ITEM_ESSENCE_DEFAULTS[name], amount: null };
    }
    try {
      const raw = localStorage.getItem(STAR_ITEM_STORAGE_KEY);
      if (raw){
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object'){
          for (const name in saved) base[name] = saved[name]; // eigen aanpassingen/toevoegingen winnen altijd
        }
      }
    } catch (e) { /* corrupte opslag — val terug op de standaardlijst (type-only) */ }
    starItemEssence = base;
  }

  // loopt door de clean/5★-paren uit de laatste AH-scan (lastStarBins, core.js) en
  // berekent — voor de items waar een essence-hoeveelheid is ingevuld — de echte
  // winst: clean BIN + (orderboek-diepte van de benodigde essence) vs. de huidige
  // laagste 5★ BIN. Paren zonder (volledig) ingevulde kosten gaan in `unconfigured`,
  // zodat de UI kan vragen die hieronder aan te vullen in plaats van ze te negeren.
  function computeEssenceFlips(){
    const configured = [];
    const unconfigured = [];
    for (const key in lastStarBins){
      const sb = lastStarBins[key];
      if (!sb.clean || !sb.five) continue; // we hebben beide kanten nodig om iets te kunnen zeggen
      const cfg = starItemEssence[sb.name];
      if (!cfg || !cfg.amount || cfg.amount <= 0){ unconfigured.push(sb); continue; }
      const essenceId = ESSENCE_BAZAAR_IDS[cfg.type];
      const essenceProduct = bazaarData && essenceId ? bazaarData[essenceId] : null;
      if (!essenceProduct || !essenceProduct.sell_summary || essenceProduct.sell_summary.length === 0){ unconfigured.push(sb); continue; }
      const essenceFill = walkBook(essenceProduct.sell_summary, cfg.amount, Infinity);
      if (essenceFill.filled < cfg.amount){ unconfigured.push(sb); continue; } // niet genoeg essence-liquiditeit nu
      const essenceCost = essenceFill.totalCost;
      const totalCost = sb.clean.price + essenceCost;
      const sellPrice = sb.five.price;
      const profit = sellPrice - totalCost;
      const marginPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
      configured.push({
        name: sb.name, rarity: sb.rarity, essenceType: cfg.type, essenceAmount: cfg.amount,
        cleanPrice: sb.clean.price, cleanRemaining: sb.clean.remaining,
        essenceCost, totalCost, sellPrice, fiveRemaining: sb.five.remaining,
        profit, marginPct
      });
    }
    configured.sort((a,b) => b.profit - a.profit);
    return { configured, unconfigured };
  }

  function renderEssenceFlips(){
    const el = document.querySelector('#essenceFlipTableWrap');
    if (!el) return;
    const { configured, unconfigured } = computeEssenceFlips();
    const countEl = document.querySelector('#essenceFlipCount');
    if (countEl){
      countEl.textContent = configured.length + ' flip-kans' + (configured.length===1?'':'en') + ' gevonden'
        + (unconfigured.length ? ` (+ ${unconfigured.length} paar${unconfigured.length===1?'':'en'} zonder (volledig) ingevulde essence-kosten — zie Instellingen hieronder)` : '');
    }
    if (configured.length === 0 && unconfigured.length === 0){
      el.innerHTML = `<div class="empty-state">Nog geen clean+5★-paren gevonden in de laatste scan. Scan de Auction House (dezelfde scan als de andere scanner-tabbladen), of voeg hieronder eerst een item toe aan de lijst.</div>`;
      return;
    }
    if (configured.length === 0){
      el.innerHTML = `<div class="empty-state">Wel ${unconfigured.length} paar/paren gevonden, maar nog geen essence-kosten (volledig) ingevuld — vul de benodigde hoeveelheid hieronder in bij Instellingen om een winstberekening te zien.</div>`;
      return;
    }
    const rows = configured.map(f => `<tr>
      <td class="left"><span class="item-name">${escapeHTML(f.name)}</span><span class="item-id">${escapeHTML(f.rarity)}</span></td>
      <td>${fmtCoins(f.cleanPrice)}<span class="item-id">${fmtDuration(f.cleanRemaining)}</span></td>
      <td>${escapeHTML(ESSENCE_TYPE_LABELS[f.essenceType] || f.essenceType)}<span class="item-id">${fmtInt(f.essenceAmount)}x</span></td>
      <td>${fmtCoins(f.essenceCost)}</td>
      <td>${fmtCoins(f.totalCost)}</td>
      <td>${fmtCoins(f.sellPrice)}<span class="item-id">${fmtDuration(f.fiveRemaining)}</span></td>
      <td class="${profitClass(f.profit)}">${fmtCoins(f.profit)}</td>
      <td>${marginBadge(f.marginPct)}</td>
    </tr>`).join('');
    el.innerHTML = `<div class="table-wrap"><table><thead><tr>
        <th class="left">Item</th><th>Clean BIN (0★)</th><th>Essence nodig</th><th>Essence-kosten</th>
        <th>Totale kostprijs</th><th>5★ verkoopprijs</th><th>Winst</th><th>Margin</th>
      </tr></thead><tbody>${rows}</tbody></table></div>
      <p class="trade-note" style="margin-top:10px;">Verkoopprijs = laagste actieve 5★-BIN van hetzelfde item nu, exclusief AH-plaatsingskosten voor herverkoop (net als bij de AH Flip-scanner). Essence-kosten lopen al door het echte orderboek heen (niet alleen de bovenste prijs). De benodigde hoeveelheid essence is wat jij hieronder hebt ingevuld — check in-game bij de Essence Shop of dat nog klopt, deze kosten veranderen soms door balans-patches.</p>`;
  }

  function renderStarItemSettings(){
    const el = document.querySelector('#starItemSettingsWrap');
    if (!el) return;
    const names = Object.keys(starItemEssence).sort((a,b) => a.localeCompare(b));
    if (names.length === 0){
      el.innerHTML = `<div class="empty-state">Nog geen items ingesteld — voeg er hieronder een toe.</div>`;
      return;
    }
    const rows = names.map(name => {
      const cfg = starItemEssence[name];
      const typeOptions = ESSENCE_TYPE_LIST.map(t =>
        `<option value="${t}"${cfg.type===t?' selected':''}>${escapeHTML(ESSENCE_TYPE_LABELS[t])}</option>`
      ).join('');
      return `<tr>
        <td class="left"><span class="item-name">${escapeHTML(name)}</span></td>
        <td><select class="star-essence-type" data-name="${escapeHTML(name)}">${typeOptions}</select></td>
        <td><input type="number" class="star-essence-amount" data-name="${escapeHTML(name)}" min="0" step="1" value="${cfg.amount || ''}" placeholder="bv. 860" style="width:110px;"></td>
        <td><button class="chip-del star-item-del" data-name="${escapeHTML(name)}" title="Verwijder uit de lijst">✕</button></td>
      </tr>`;
    }).join('');
    el.innerHTML = `<div class="table-wrap"><table><thead><tr>
        <th class="left">Item</th><th>Essence-type</th><th>Benodigd (0★→5★)</th><th></th>
      </tr></thead><tbody>${rows}</tbody></table></div>`;
    el.querySelectorAll('.star-essence-type').forEach(sel => sel.addEventListener('change', () => {
      starItemEssence[sel.dataset.name].type = sel.value;
      saveStarItemEssence();
      renderEssenceFlips();
    }));
    el.querySelectorAll('.star-essence-amount').forEach(inp => {
      const commit = () => {
        const val = parseFloat(inp.value);
        starItemEssence[inp.dataset.name].amount = (!isNaN(val) && val > 0) ? val : null;
        saveStarItemEssence();
        renderEssenceFlips();
      };
      inp.addEventListener('change', commit);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
    });
    el.querySelectorAll('.star-item-del').forEach(btn => btn.addEventListener('click', () => {
      delete starItemEssence[btn.dataset.name];
      saveStarItemEssence();
      renderStarItemSettings();
      renderEssenceFlips();
    }));
  }
