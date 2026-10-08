  // ====================================================================
  // petflip.js — "Pet Flips" tab: twee onafhankelijke pet-flip-calculators.
  // 1) Force-level flip: koop een goedkope lage-level pet op de AH, voer 'm
  //    met pet-candy (Pet Cake / Chyme) naar level 100, verkoop 'm weer op
  //    de AH. Gebruikt dezelfde volledige AH-scan als Auction House/AH
  //    Flip-scanner/NPC-verkoop (zie lastPetBins in core.js, gevuld door
  //    processAuctionPage in auctions.js) — geen extra scan nodig.
  // 2) Kat rarity-upgrade flip: vergelijkt de live AH-prijs van dezelfde
  //    pet in twee rarities, min. de Kat-fee + materiaalkosten die je zelf
  //    invult (die verschillen te veel per pet-type om betrouwbaar te
  //    hardcoden — vul ze in zoals de Kat-NPC ze in-game toont).
  // XP-tabel: totale XP van level 1 naar 100 per rarity, bronnen:
  // hypixel.net/threads/total-xp-required-for-pet-levels-1-100-all-rarities
  // (community-reverse-engineered, geen officiële Hypixel-data — Mythic
  // volgt dezelfde curve als Legendary). Een paar bijzondere pets (bv.
  // Golden Dragon) hebben een eigen, veel duurdere curve die hier niet
  // apart in zit. Zonder AH-plaatsingskosten. Check bij twijfel zelf
  // in-game en pas de getallen gerust aan als Hypixel ooit iets wijzigt.
  // Depends on core.js (bazaarData, itemMeta, lastPetBins, fmtCoins, ...).
  // ====================================================================

  const PET_RARITIES = ['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','MYTHIC'];

  const PET_XP_DEFAULTS = {
    COMMON: 5624785, UNCOMMON: 8644220, RARE: 12626665,
    EPIC: 17222200, LEGENDARY: 25353230, MYTHIC: 25353230,
  };
  const PET_XP_STORAGE_KEY = 'skyblockFlipFinder_petXp_v1';
  let petXpTable = Object.assign({}, PET_XP_DEFAULTS);
  function savePetXpTable(){
    try { localStorage.setItem(PET_XP_STORAGE_KEY, JSON.stringify(petXpTable)); } catch (e) {}
  }
  function loadPetXpTable(){
    try {
      const raw = localStorage.getItem(PET_XP_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') petXpTable = Object.assign({}, PET_XP_DEFAULTS, data);
    } catch (e) {}
  }

  // Bazaar-verhandelbare pet-XP-items ZONDER gebruikslimiet (anders dan Carrot
  // Candy, die maar 10x per pet-leven mag — daarom niet meegenomen hier).
  // match = (deel van de) itemnaam om op te zoeken, xp = Pet-XP per stuk.
  const PET_CANDY_OPTIONS = [
    { match: 'pet cake', xp: 10000 },
    { match: 'chyme', xp: 90000 },
  ];
  // zoekt beide candy-opties op via de itemnaam (geen hardcoded bazaar-ID,
  // zoals guessBookPrice in enchant.js) en geeft de goedkoopste per XP-punt terug.
  function getCheapestPetCandy(){
    if (!bazaarData || !itemMetaLoaded) return null;
    let best = null;
    for (const id in itemMeta){
      const meta = itemMeta[id];
      if (!meta || !meta.name) continue;
      const nameLower = meta.name.toLowerCase();
      const opt = PET_CANDY_OPTIONS.find(o => nameLower.includes(o.match));
      if (!opt) continue;
      const p = bazaarData[id];
      if (!p || !p.sell_summary || !p.sell_summary.length || !p.sell_summary[0].pricePerUnit) continue;
      const price = p.sell_summary[0].pricePerUnit;
      const pricePerXp = price / opt.xp;
      if (!best || pricePerXp < best.pricePerXp){
        best = { price, xp: opt.xp, pricePerXp, id, name: meta.name };
      }
    }
    return best;
  }

  // let op: geeft {flips, candyMissing} terug, niet zomaar een array — als de candy-
  // prijs niet gevonden kan worden, is er GEEN betrouwbare winst te berekenen (de
  // candy-kosten zijn vaak een groot deel van de totale investering), dus dan geven we
  // dat expliciet terug i.p.v. stilletjes een profit te tonen die de candy-kosten mist.
  function computeForceLevelFlips(){
    const out = [];
    const candy = getCheapestPetCandy();
    if (!candy) return { flips: out, candyMissing: true };
    for (const key in lastPetBins){
      const entry = lastPetBins[key];
      if (!entry.low || !entry.high) continue; // we hebben allebei een BIN nodig om te vergelijken
      const totalXp = petXpTable[entry.rarity];
      if (!totalXp) continue;
      const candiesNeeded = Math.ceil(totalXp / candy.xp);
      const candyCost = candiesNeeded * candy.price;
      const totalCost = entry.low.price + candyCost;
      const profit = entry.high.price - totalCost;
      const marginPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
      out.push({
        key, name: entry.name, rarity: entry.rarity,
        lowLevel: entry.low.level, lowPrice: entry.low.price,
        highLevel: entry.high.level, highPrice: entry.high.price,
        totalXp, candiesNeeded, candyCost, candyName: candy.name,
        totalCost, profit, marginPct,
      });
    }
    out.sort((a, b) => b.profit - a.profit);
    return { flips: out, candyMissing: false };
  }

  function renderPetXpSettings(){
    const el = $('#petXpTableWrap');
    if (!el) return;
    el.innerHTML = '<div class="pet-xp-grid">' + PET_RARITIES.map(r => `
      <div class="field"><label>${r}</label><input type="number" step="100000" min="0" class="pet-xp-input" data-rarity="${r}" value="${petXpTable[r] || 0}"></div>
    `).join('') + '</div>';
    el.querySelectorAll('.pet-xp-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const val = parseFloat(inp.value);
        if (!isNaN(val) && val >= 0){
          petXpTable[inp.dataset.rarity] = val;
          savePetXpTable();
          renderPetFlipper();
        }
      });
    });
  }

  function renderPetFlipper(){
    const el = $('#petFlipTableWrap');
    if (!el) return;
    const { flips, candyMissing } = computeForceLevelFlips();
    const countEl = $('#petFlipCount');
    if (candyMissing){
      if (countEl) countEl.textContent = '';
      el.innerHTML = `<div class="empty-state">Pet Cake/Chyme niet (meer) gevonden op de bazaar — kan daardoor geen betrouwbare winst berekenen (de candy-kosten zijn vaak een groot deel van de investering). Dit lost zichzelf meestal op zodra de bazaar- en itemdata volledig geladen zijn; ververs anders handmatig.</div>`;
      renderKatCalculator();
      return;
    }
    if (countEl) countEl.textContent = flips.length + ' pet-flip kans' + (flips.length === 1 ? '' : 'en') + ' gevonden (level 1 → 100 via pet-candy)';
    if (flips.length === 0){
      el.innerHTML = `<div class="empty-state">Nog geen force-level pet-flips gevonden. Scan de Auction House hierboven (of via een ander scanner-tabblad — ze delen allemaal dezelfde scan).</div>`;
    } else {
      const rows = flips.map(f => `<tr>
          <td class="left"><span class="item-name">${escapeHTML(f.name)}</span><span class="item-id">${escapeHTML(f.rarity)}</span></td>
          <td>Lvl ${f.lowLevel} — ${fmtCoins(f.lowPrice)}</td>
          <td>Lvl ${f.highLevel} — ${fmtCoins(f.highPrice)}</td>
          <td>${fmtInt(f.candiesNeeded)}x ${escapeHTML(f.candyName)} (${fmtCoins(f.candyCost)})</td>
          <td>${fmtCoins(f.totalCost)}</td>
          <td class="${profitClass(f.profit)}">${fmtCoins(f.profit)}</td>
          <td class="${profitClass(f.profit)}">${fmtPct(f.marginPct)}</td>
        </tr>`).join('');
      el.innerHTML = `<div class="table-wrap"><table><thead><tr>
          <th class="left">Pet</th><th>Laag level (koop)</th><th>Lvl 100 (verkoop)</th><th>Pet-candy nodig</th><th>Tot. investering</th><th>Winst</th><th>Margin</th>
        </tr></thead><tbody>${rows}</tbody></table></div>
        <p class="trade-note" style="margin-top:10px;">Gebruikt steeds de goedkoopste van Pet Cake (10.000 XP, geen limiet) / Chyme (90.000 XP, geen limiet) — Carrot Candy is bewust niet meegenomen omdat die maar 10x per pet mag. Exclusief AH-plaatsingskosten. XP t/m level 100 is een schatting (zie instellingen hieronder) — check bij twijfel zelf in-game. Een BIN kan al gekocht zijn tegen de tijd dat je 'm opent.</p>`;
    }
    renderKatCalculator();
  }

  // Kat rarity-upgrade calculator: typ een pet-naam, zie de live (laatste scan)
  // level-100(ish) BIN-prijs per gevonden rarity, kies van/naar, vul zelf de
  // Kat-fee + materiaalkosten in (die lees je in-game af bij de Kat-NPC).
  function renderKatCalculator(){
    const nameInput = $('#katPetNameInput');
    const wrap = $('#katPriceTableWrap');
    const fromSel = $('#katFromRarity');
    const toSel = $('#katToRarity');
    const resultWrap = $('#katResultWrap');
    if (!nameInput || !wrap || !fromSel || !toSel || !resultWrap) return;
    const search = nameInput.value.trim().toLowerCase();

    if (!search){
      wrap.innerHTML = `<p class="trade-note">Typ hierboven een pet-naam om de live AH-prijzen per rarity te zien (uit de laatste scan).</p>`;
      fromSel.innerHTML = ''; toSel.innerHTML = ''; resultWrap.innerHTML = '';
      return;
    }

    const matches = {}; // rarity -> {level, price}
    for (const key in lastPetBins){
      const entry = lastPetBins[key];
      if (entry.high && entry.name.toLowerCase().includes(search)){
        if (!matches[entry.rarity] || entry.high.price < matches[entry.rarity].price){
          matches[entry.rarity] = entry.high;
        }
      }
    }
    const foundRarities = PET_RARITIES.filter(r => matches[r]);
    if (foundRarities.length === 0){
      wrap.innerHTML = `<p class="trade-note">Geen level 100(+)-BIN gevonden voor "${escapeHTML(nameInput.value.trim())}" in de laatste scan.</p>`;
      fromSel.innerHTML = ''; toSel.innerHTML = ''; resultWrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th class="left">Rarity</th><th>Level</th><th>Laagste BIN</th></tr></thead><tbody>${
      foundRarities.map(r => `<tr><td class="left">${escapeHTML(r)}</td><td>${matches[r].level}</td><td>${fmtCoins(matches[r].price)}</td></tr>`).join('')
    }</tbody></table></div>`;

    const curFrom = fromSel.value, curTo = toSel.value;
    const optsHtml = foundRarities.map(r => `<option value="${r}">${r}</option>`).join('');
    fromSel.innerHTML = optsHtml;
    toSel.innerHTML = optsHtml;
    fromSel.value = foundRarities.includes(curFrom) ? curFrom : foundRarities[0];
    toSel.value = foundRarities.includes(curTo) && curTo !== fromSel.value ? curTo : foundRarities[foundRarities.length - 1];

    const fromR = fromSel.value, toR = toSel.value;
    const fee = parseFloat($('#katFeeInput').value) || 0;
    const material = parseFloat($('#katMaterialInput').value) || 0;
    if (!fromR || !toR || fromR === toR || !matches[fromR] || !matches[toR]){
      resultWrap.innerHTML = fromR === toR ? `<p class="trade-note">Kies twee verschillende rarities.</p>` : '';
      return;
    }
    const priceFrom = matches[fromR].price, priceTo = matches[toR].price;
    const totalCost = priceFrom + fee + material;
    const profit = priceTo - totalCost;
    const marginPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    resultWrap.innerHTML = `<p class="trade-note" style="margin-top:10px;">
      Koop <b>${escapeHTML(fromR)}</b> voor <b>${fmtCoins(priceFrom)}</b>, upgrade via Kat (${fmtCoins(fee)} fee + ${fmtCoins(material)} materiaal) naar <b>${escapeHTML(toR)}</b>,
      verkoop voor <b>${fmtCoins(priceTo)}</b> → <span class="${profitClass(profit)}">${fmtCoins(profit)} winst (${fmtPct(marginPct)})</span>. Exclusief AH-plaatsingskosten.
    </p>`;
  }
