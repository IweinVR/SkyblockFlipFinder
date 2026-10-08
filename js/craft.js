  // ====================================================================
  // craft.js — "Craft / Compact Flips" tab: buy raw material, craft it into
  // the ENCHANTED_ version, sell that. Same order-book-walking approach as
  // bazaar.js — we don't trust the raw top-of-book price, we simulate
  // actually buying raw material and selling the resulting enchanted items
  // through the real order tiers.
  //
  // Multi-step chains: Hypixel's public items-API no longer exposes a
  // `recipe` field (verified directly against the live API — zero "recipe"
  // occurrences across all 5680 items, checked Oct 2026), so real crafting
  // trees can't be read from there. Instead, a genuine SECOND compacting
  // stage is detected straight from the live bazaar product list itself:
  // items like ENCHANTED_IRON_BLOCK compact from ENCHANTED_IRON (160x),
  // which itself compacts from raw IRON_INGOT (160x) — a real two-stage
  // chain, not a single step. Any "*_BLOCK" enchanted item whose name minus
  // "_BLOCK" (or minus "_BLOCK" plus "_BALL", for Clay/Slimeball's naming) is
  // ITSELF a tradeable ENCHANTED_ bazaar product gets this 2-step treatment
  // (verified against live data: 13 such chains exist today — Iron/Gold/
  // Diamond/Coal/Redstone/Lapis/Emerald/Quartz/Bone/Honeycomb/Melon/Clay/
  // Slimeball). Everything else keeps the original single-step rule.
  // Note this also FIXES a pre-existing bug: Enchanted Melon Block used to
  // be (wrongly) priced from raw "Melon Block" — a real but unrelated bazaar
  // item — instead of from Enchanted Melon, which is how it actually crafts.
  // Depends on core.js.
  // ====================================================================
  let craftSort = {col:'marginPct', dir:'desc'};

  // rolling per-item price history for the stability check: id -> {streak, avgBuyPrice, avgSellPrice}
  let craftStability = {};
  let craftExpandedIds = new Set(); // item ids with their orderboek-depth row open (click a row to toggle)

  // A handful of raw materials whose bazaar product ID doesn't match the naive "strip
  // ENCHANTED_ prefix" pattern — verified directly against the live bazaar product list
  // (git log): Iron/Gold use the "_INGOT" id, and Lapis Lazuli oddly still uses the old
  // Minecraft sub-id scheme ("INK_SACK:4") rather than its own id. Without this, the
  // Iron/Gold/Lapis Lazuli Block chains (and even their plain single-step Enchanted
  // Iron/Gold/Lapis Lazuli flips) would silently never be found at all.
  const CRAFT_RAW_ID_OVERRIDES = { 'IRON': 'IRON_INGOT', 'GOLD': 'GOLD_INGOT', 'LAPIS_LAZULI': 'INK_SACK:4' };
  function resolveRawId(candidate){
    return CRAFT_RAW_ID_OVERRIDES[candidate] || candidate;
  }

  // Detects whether `id` is the END of a known 2-step compacting chain. Returns
  // {steps:2, rawId, tier1Id} when id is a "*_BLOCK" item whose tier-1 enchanted
  // counterpart is also tradeable (and that counterpart's own raw material is too),
  // otherwise {steps:1, rawId} for the original single-step rule. Two different tier-1
  // naming patterns exist (both verified against live bazaar data): the direct strip
  // (ENCHANTED_IRON_BLOCK -> ENCHANTED_IRON) covers most materials, but Clay/Slimeball
  // instead keep a "_BALL" tier-1 name (ENCHANTED_CLAY_BLOCK -> ENCHANTED_CLAY_BALL,
  // not "ENCHANTED_CLAY" — that id doesn't exist at all), so both get tried in order.
  function resolveCraftChain(id){
    if (id.endsWith('_BLOCK')){
      const stripped = id.slice(0, -'_BLOCK'.length);
      const tier1Candidates = [stripped, stripped + '_BALL'];
      for (const tier1Id of tier1Candidates){
        if (tier1Id !== id && tier1Id.startsWith('ENCHANTED_') && bazaarData[tier1Id]){
          const rawId = resolveRawId(tier1Id.slice('ENCHANTED_'.length));
          if (bazaarData[rawId]) return { steps: 2, rawId, tier1Id };
        }
      }
    }
    const rawId = resolveRawId(id.slice('ENCHANTED_'.length));
    if (bazaarData[rawId]) return { steps: 1, rawId };
    return null;
  }

  function computeCraftRows(maxCrafts, budget, category, maxRawInput){
    if (!bazaarData) return [];
    const applyTax = $('#craftTax').checked;
    const safeOnly = $('#craftSafe').checked;
    const rows = [];
    // two independent ways to cap how much raw material gets bought: "max crafts" (in
    // units of 160) or "max grondstof" (direct raw quantity) — whichever is set and
    // more restrictive wins. 0 means "no limit" for either. (For a 2-step chain this
    // still counts in RAW units, same as a 1-step item — see the hint text in the UI.)
    const craftsLimit = (maxCrafts > 0) ? maxCrafts * 160 : 0;
    const rawLimit = (maxRawInput > 0) ? maxRawInput : 0;
    const limits = [craftsLimit, rawLimit].filter(v => v > 0);
    const maxRawQty = limits.length ? Math.min(...limits) : 0;

    for (const id in bazaarData){
      if (!id.startsWith('ENCHANTED_')) continue;
      const chain = resolveCraftChain(id);
      if (!chain) continue; // not a recognizable compact chain (no matching raw/tier-1 on the bazaar)
      const baseId = chain.rawId;

      if (category){
        const enchCat = itemMeta[id] && itemMeta[id].category;
        const baseCat = itemMeta[baseId] && itemMeta[baseId].category;
        if (enchCat !== category && baseCat !== category) continue;
      }
      const rawProduct = bazaarData[baseId];
      const enchProduct = bazaarData[id];
      const rawQs = rawProduct.quick_status;
      const enchQs = enchProduct.quick_status;
      if (!rawQs || !enchQs) continue;
      const rawSellSummary = rawProduct.sell_summary || [];
      const enchBuySummary = enchProduct.buy_summary || [];
      if (rawSellSummary.length === 0 || enchBuySummary.length === 0) continue;
      if (safeOnly && (!isHealthyMarket(rawProduct, rawQs) || !isHealthyMarket(enchProduct, enchQs))) continue;
      // for a 2-step chain, the intermediate tier-1 market needs to look healthy too —
      // if THAT market is thin/manipulated, the chain's economics can't be trusted either,
      // even though we never actually transact on it (it's a pure in-game crafting step)
      let tier1Qs = null;
      if (chain.steps === 2){
        const tier1Product = bazaarData[chain.tier1Id];
        tier1Qs = tier1Product && tier1Product.quick_status;
        if (!tier1Qs) continue;
        if (safeOnly && !isHealthyMarket(tier1Product, tier1Qs)) continue;
      }

      // raw units needed per FINISHED unit: 160 for a 1-step item, 160×160=25600 for a
      // 2-step chain (160 raw → 1 tier-1, ×160 of those → 1 tier-2 block).
      const stepMultiplier = chain.steps === 2 ? 160 : 1;
      const rawPerFinished = 160 * stepMultiplier;

      const rawFill = walkBook(rawSellSummary, maxRawQty, budget);
      const tier1Affordable = Math.floor(rawFill.filled / 160); // # of 160-raw compacting batches we can afford
      if (tier1Affordable <= 0) continue;
      const finishedAffordable = chain.steps === 2 ? Math.floor(tier1Affordable / 160) : tier1Affordable;
      if (finishedAffordable <= 0) continue; // 2-step: didn't even afford one full 25.600-raw block
      const rawUnitsUsed = finishedAffordable * rawPerFinished;
      const avgRawPrice = rawFill.filled > 0 ? (rawFill.totalCost / rawFill.filled) : 0;
      const costForOne = avgRawPrice * rawPerFinished; // cost (in raw material) for exactly 1 finished unit

      // sell the resulting enchanted items
      const enchFill = walkBook(enchBuySummary, finishedAffordable, Infinity);
      const crafts = enchFill.filled;
      if (crafts <= 0) continue;

      let totalRevenue = enchFill.totalCost;
      if (applyTax) totalRevenue = totalRevenue * (1 - flipperTaxRate);
      const totalCost = crafts * costForOne;
      const totalProfit = totalRevenue - totalCost;
      const profit = totalProfit / crafts;
      const marginPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
      const weekVol = Math.min(enchQs.sellMovingWeek||0, enchQs.buyMovingWeek||0);
      const effectiveMaxFinished = maxRawQty > 0 ? Math.floor(maxRawQty / rawPerFinished) : 0;
      const partial = crafts < finishedAffordable || (effectiveMaxFinished > 0 && crafts < effectiveMaxFinished);

      if (safeOnly){
        if (marginPct > MAX_SANE_MARGIN_PCT) continue;
        if (hasPriceCliff(rawSellSummary, rawUnitsUsed, avgRawPrice)) continue;
        if (hasPriceCliff(enchBuySummary, crafts, enchFill.avgPrice)) continue;
      }

      const enchDisplay = getItemDisplay(id);
      const rawDisplay = getItemDisplay(baseId);
      const stability = trackStability(craftStability, id, costForOne, enchFill.avgPrice, marginPct);

      const tier1Name = chain.steps === 2 ? getItemDisplay(chain.tier1Id).name : null;
      rows.push({
        id, baseId,
        name: enchDisplay.name, icon: enchDisplay.icon,
        rawName: rawDisplay.name,
        steps: chain.steps,
        tier1Id: chain.steps === 2 ? chain.tier1Id : null,
        tier1Name,
        rowBadge: chain.steps === 2
          ? `<span class="chain-tag" title="2-staps compacting-keten: eerst 160x ${escapeHTML(rawDisplay.name)} → 1x ${escapeHTML(tier1Name)}, dan 160x dát weer → 1x ${escapeHTML(enchDisplay.name)}. Twee aparte compacting-acties in-game, geen recept-data van Hypixel beschikbaar hiervoor dus dit is afgeleid uit de bazaar-productnamen.">2-staps</span>`
          : '',
        costFor160: costForOne, sellRevenue: enchFill.avgPrice, profit, marginPct, weekVol,
        crafts, totalProfit, totalCost, partial,
        streak: stability.streak, stable: stability.stable, marginHistory: stability.history
      });
    }
    return rows;
  }

  function renderCraftTab(){
    const search = $('#craftSearch').value.trim().toLowerCase();
    const minVol = parseFloat($('#craftMinVol').value) || 0;
    const budget = parseFloat($('#craftBudget').value) || 0;
    const maxCrafts = parseFloat($('#craftMaxQty').value) || 0;
    const maxRaw = parseFloat($('#craftMaxRaw').value) || 0;
    const category = $('#craftCategory').value;

    let rows = computeCraftRows(maxCrafts, budget, category, maxRaw);
    rows = rows.filter(r => r.weekVol >= minVol);
    if (search) rows = rows.filter(r => r.name.toLowerCase().includes(search) || r.rawName.toLowerCase().includes(search));

    sortRows(rows, craftSort);
    const chainCount = rows.filter(r => r.steps === 2).length;
    $('#craftCount').textContent = rows.length + ' craft-flip kansen gevonden'
      + (chainCount > 0 ? ` (waarvan ${chainCount} 2-staps compacting-keten${chainCount>1?'s':''})` : '');
    renderCraftRecommendation(rows, budget, maxCrafts, maxRaw);

    if (rows.length === 0){
      $('#craftTableWrap').innerHTML = `<div class="empty-state">Geen resultaten. Verlaag het minimum volume, zet de manipulatie-filter uit, of pas je zoekterm/max crafts/categorie aan.</div>`;
      return;
    }

    const cols = [
      {key:'name', label:'Enchanted item', left:true, sub:'rawName', icon:true},
      {key:'costFor160', label:'Kosten (grondstof voor 1x)', fmt:fmtCoins, flash:true},
      {key:'sellRevenue', label:'Verkoop (1x enchanted)', fmt:fmtCoins, flash:true},
      {key:'profit', label:'Winst per craft', fmt:fmtCoins, cls:profitClass, flash:true},
      {key:'marginPct', label:'Margin %', fmt:marginBadge, raw:true, flash:true},
      {key:'weekVol', label:'Vol/week (enchanted)', fmt:volTag, raw:true},
      {key:'crafts', label:'Realistisch #crafts', fmt:fmtInt},
      {key:'totalProfit', label:'Tot. winst', fmt:fmtCoins, cls:profitClass},
      {key:'streak', label:'Stabiliteit', fmt:stabBadge, raw:true},
      {key:'marginHistory', label:'Verloop', fmt:renderSparkline, raw:true, sortable:false},
    ];
    renderTable('#craftTableWrap', rows, cols, craftSort, (col)=>{
      toggleSort(craftSort, col); renderCraftTab();
    }, (row) => {
      const stepMultiplier = row.steps === 2 ? 160 : 1;
      addToTradeLog({
        type: 'craft',
        boughtItem: row.rawName, boughtQty: row.crafts * 160 * stepMultiplier, cost: row.totalCost,
        soldItem: row.name, soldQty: row.crafts, revenue: null,
        targetPricePerUnit: row.sellRevenue, targetProfit: row.totalProfit
      });
    }, {
      isOpen: (row) => craftExpandedIds.has(row.id),
      onToggle: (row) => {
        if (craftExpandedIds.has(row.id)) craftExpandedIds.delete(row.id); else craftExpandedIds.add(row.id);
        renderCraftTab();
      },
      render: (row) => {
        const rawP = bazaarData[row.baseId];
        const enchP = bazaarData[row.id];
        const stepMultiplier = row.steps === 2 ? 160 : 1;
        const panels = [
          { title: `Stap 1 — grondstof kopen: ${row.rawName}`, tiers: rawP && rawP.sell_summary, side: 'sell', highlightQty: row.crafts * 160 * stepMultiplier }
        ];
        if (row.steps === 2){
          const tier1P = bazaarData[row.tier1Id];
          panels.push({ title: `Stap 2 — eerst compacten tot: ${row.tier1Name} (zelf niet gekocht/verkocht, puur in-game tussenstap)`, tiers: tier1P && tier1P.sell_summary, side: 'sell', highlightQty: 0 });
        }
        panels.push({ title: `${row.steps===2?'Stap 3 — ':''}${row.name} verkopen`, tiers: enchP && enchP.buy_summary, side: 'buy', highlightQty: row.crafts });
        return renderOrderBookDepth(panels);
      }
    });
  }

  function renderCraftRecommendation(rows, budget, maxCrafts, maxRaw){
    const candidates = rows.filter(r => r.crafts > 0 && r.totalProfit > 0);
    candidates.sort((a,b) => b.totalProfit - a.totalProfit);
    const el = $('#craftRecommend');
    if (candidates.length === 0){
      el.innerHTML = `<div class="recommend empty"><div class="rec-body">
        <div class="rec-title">Geen duidelijke aanbeveling</div>
        <div class="rec-text">Met €${fmtCoins(budget)} coins en de huidige filters is er geen craft-flip die genoeg marktdiepte heeft. Verhoog je budget/max crafts, verlaag het volumefilter, of zet de manipulatie-filter uit.</div>
      </div></div>`;
      return;
    }
    const stableCandidates = candidates.filter(r => r.stable);
    const top = stableCandidates.length > 0 ? stableCandidates[0] : candidates[0];
    const isUnsure = !top.stable;
    const stepMultiplier = top.steps === 2 ? 160 : 1;
    const partialNote = top.partial ? ` <span style="color:var(--text-faint)">(orderboek/limiet begrensd dit aantal)</span>` : '';
    const rawAvgPrice = top.costFor160 / (160 * stepMultiplier);
    const chainNote = top.steps === 2
      ? ` Dit is een <b>2-staps compacting-keten</b>: compact eerst 160x ${escapeHTML(top.rawName)} naar 1x ${escapeHTML(top.tier1Name)}, en herhaal dat 160x om aan 1x ${escapeHTML(top.name)} te komen — reken dus op twee aparte compacting-rondes in-game, niet één.`
      : '';
    const unsureNote = isUnsure
      ? `<br><span style="color:var(--accent)">⏳ Nog niet bevestigd — dit item is nog geen ${STABILITY_MIN_STREAK} refreshes op rij stabiel gebleken. Wacht liever nog even, of check zelf extra goed in-game voordat je dit uitvoert.</span>`
      : '';
    el.innerHTML = `<div class="recommend${isUnsure?' unsure':''}"><div class="rec-body">
      <div class="rec-title">${isUnsure?'Beste (nog onbevestigde) craft-flip':'Beste craft-flip met jouw budget'}${top.steps===2?' — 2-staps keten':''}${maxCrafts>0? ' (max '+fmtInt(maxCrafts)+' crafts)':''}${maxRaw>0? ' (max '+fmtInt(maxRaw)+' grondstof)':''}</div>
      <div class="rec-text">Koop <b>${fmtInt(top.crafts * 160 * stepMultiplier)}x ${escapeHTML(top.rawName)}</b> voor gemiddeld <b>${fmtCoins(rawAvgPrice)}</b> coins/stuk (totaal ≈ <b>${fmtCoins(top.totalCost)}</b> coins), craft dit om tot <b>${fmtInt(top.crafts)}x ${top.icon} ${escapeHTML(top.name)}</b>, en verkoop die weer voor gemiddeld <b>${fmtCoins(top.sellRevenue)}</b> coins/stuk.${partialNote}${chainNote}
      Verwachte winst: <b>${fmtCoins(top.totalProfit)}</b> coins (margin ${fmtPct(top.marginPct)}, vol/week ${fmtInt(top.weekVol)}).${unsureNote}</div>
      <button id="craftRecToLogBtn" style="margin-top:10px;">Zet in Mijn Trades</button>
    </div></div>`;
    $('#craftRecToLogBtn').addEventListener('click', () => {
      // logged as "open" (bought, not yet sold) — fill in the real sale price in the
      // Mijn Trades tab once you've actually crafted + sold it in-game
      addToTradeLog({
        type: 'craft',
        boughtItem: top.rawName, boughtQty: top.crafts * 160 * stepMultiplier, cost: top.totalCost,
        soldItem: top.name, soldQty: top.crafts, revenue: null,
        targetPricePerUnit: top.sellRevenue, targetProfit: top.totalProfit
      });
    });
  }
