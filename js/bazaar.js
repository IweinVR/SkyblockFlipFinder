  // ====================================================================
  // bazaar.js — "Bazaar Flips" tab: plain buy-order/sell-order flips.
  // Prices/quantities are computed by actually walking the sell/buy order book for the
  // requested budget + max-quantity, not by trusting the raw top-of-book price. That
  // means a single inflated/spoofed order gets diluted into the average once you ask
  // for a realistic quantity, instead of skewing the whole recommendation.
  // Depends on core.js (walkBook, isHealthyMarket, trackStability, renderTable, ...).
  // ====================================================================
  let bazaarSort = {col:'marginPct', dir:'desc'};
  let bazaarStability = {};
  let bazaarExpandedIds = new Set(); // item ids with their orderboek-depth row open (click a row to toggle)
  function computeBazaarRows(maxQty, budget, category){
    if (!bazaarData) return [];
    const applyTax = $('#bazaarTax').checked;
    const safeOnly = $('#bazaarSafe').checked;
    const rows = [];
    for (const id in bazaarData){
      const p = bazaarData[id];
      const qs = p.quick_status;
      if (!qs) continue;
      if (category && (!itemMeta[id] || itemMeta[id].category !== category)) continue;
      const sellSummary = p.sell_summary || [];
      const buySummary = p.buy_summary || [];

      // NPC zero-risk check — independent of the bazaar round-trip flip below: buy on
      // the bazaar, sell straight to an NPC in-game for a fixed price. Only checked for
      // items the user explicitly entered a known NPC price for (see Instellingen).
      if (npcPrices[id] !== undefined && sellSummary.length > 0 && (!safeOnly || isHealthyMarket(p, qs))){
        const top = sellSummary[0];
        const npcPrice = npcPrices[id];
        if (top && top.pricePerUnit > 0 && top.pricePerUnit < npcPrice){
          const cappedByBudget = budget > 0 ? Math.floor(budget / top.pricePerUnit) : Infinity;
          const cappedByMaxQty = maxQty > 0 ? maxQty : Infinity;
          const qty = Math.min(top.amount || 0, cappedByBudget, cappedByMaxQty);
          if (qty > 0){
            const profitPerUnit = npcPrice - top.pricePerUnit;
            const npcMarginPct = (profitPerUnit / top.pricePerUnit) * 100;
            const display = getItemDisplay(id);
            const npcStab = trackStability(npcStability, id, top.pricePerUnit, npcPrice, npcMarginPct);
            rows.push({
              id, name: display.name, icon: display.icon,
              avgBuyPrice: top.pricePerUnit, avgSellPrice: npcPrice,
              profitPerUnit, marginPct: npcMarginPct, weekVol: qs.sellMovingWeek || 0,
              units: qty, totalCost: qty * top.pricePerUnit, totalProfit: qty * profitPerUnit,
              partial: qty < (top.amount || 0),
              streak: npcStab.streak, stable: npcStab.stable, marginHistory: npcStab.history,
              npcFlip: true
            });
          }
        }
      }

      if (sellSummary.length === 0 || buySummary.length === 0) continue;
      if (safeOnly && !isHealthyMarket(p, qs)) continue;

      const buyFill = walkBook(sellSummary, maxQty, budget);   // buying the item to acquire it
      if (buyFill.filled <= 0) continue;
      const sellFill = walkBook(buySummary, buyFill.filled, Infinity); // selling what we bought
      if (sellFill.filled <= 0) continue;

      const units = sellFill.filled; // only count the matched portion both sides could fill
      const totalCost = units * buyFill.avgPrice;
      let totalRevenue = sellFill.totalCost;
      if (applyTax) totalRevenue = totalRevenue * (1 - flipperTaxRate);
      const totalProfit = totalRevenue - totalCost;
      const marginPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
      const weekVol = Math.min(qs.sellMovingWeek||0, qs.buyMovingWeek||0);
      const partial = units < buyFill.filled || (maxQty > 0 && units < maxQty);

      if (safeOnly){
        if (marginPct > MAX_SANE_MARGIN_PCT) continue; // unrealistic margin — almost always bait/manipulation/stale data
        if (hasPriceCliff(sellSummary, buyFill.filled, buyFill.avgPrice)) continue;
        if (hasPriceCliff(buySummary, sellFill.filled, sellFill.avgPrice)) continue;
      }

      const display = getItemDisplay(id);
      const stability = trackStability(bazaarStability, id, buyFill.avgPrice, sellFill.avgPrice, marginPct);

      rows.push({
        id, name: display.name, icon: display.icon,
        avgBuyPrice: buyFill.avgPrice, avgSellPrice: sellFill.avgPrice,
        profitPerUnit: units > 0 ? totalProfit/units : 0,
        marginPct, weekVol, units, totalCost, totalProfit, partial,
        streak: stability.streak, stable: stability.stable, marginHistory: stability.history
      });
    }
    return rows;
  }

  function renderBazaarTab(){
    const search = $('#bazaarSearch').value.trim().toLowerCase();
    const minVol = parseFloat($('#bazaarMinVol').value) || 0;
    const budget = parseFloat($('#bazaarBudget').value) || 0;
    const maxQty = parseFloat($('#bazaarMaxQty').value) || 0;
    const category = $('#bazaarCategory').value;

    let rows = computeBazaarRows(maxQty, budget, category);
    // NPC-flips zijn risicovrij ongeacht het weekvolume, dus die laten we niet wegfilteren
    rows = rows.filter(r => (r.npcFlip || r.weekVol >= minVol) && r.totalProfit > 0);
    if (search) rows = rows.filter(r => r.name.toLowerCase().includes(search) || r.id.toLowerCase().includes(search));

    sortRows(rows, bazaarSort);
    // NPC-flips altijd bovenaan tonen ("felgroen bovenaan je lijst"), los van de gekozen sortering
    const npcRows = rows.filter(r => r.npcFlip).sort((a,b) => b.totalProfit - a.totalProfit);
    const otherRows = rows.filter(r => !r.npcFlip);
    rows = npcRows.concat(otherRows);
    $('#bazaarCount').textContent = rows.length + ' flip-kansen gevonden' + (npcRows.length > 0 ? ` (waarvan ${npcRows.length} NPC-flip${npcRows.length>1?'s':''})` : '');
    renderBazaarRecommendation(rows, budget, maxQty);

    if (rows.length === 0){
      $('#bazaarTableWrap').innerHTML = `<div class="empty-state">Geen resultaten met de huidige filters. Verlaag het minimum volume, zet de manipulatie-filter uit, of pas je zoekterm/max aantal/categorie aan.</div>`;
      return;
    }

    const cols = [
      {key:'name', label:'Item', left:true, icon:true},
      {key:'avgBuyPrice', label:'Gem. koopprijs', fmt:fmtCoins, flash:true},
      {key:'avgSellPrice', label:'Gem. verkoopprijs', fmt:fmtCoins, flash:true},
      {key:'profitPerUnit', label:'Winst/stuk', fmt:fmtCoins, cls:profitClass, flash:true},
      {key:'marginPct', label:'Margin %', fmt:marginBadge, raw:true, flash:true},
      {key:'weekVol', label:'Vol/week', fmt:volTag, raw:true},
      {key:'units', label:'Realistisch #stuks', fmt:fmtInt},
      {key:'totalProfit', label:'Tot. winst', fmt:fmtCoins, cls:profitClass},
      {key:'streak', label:'Stabiliteit', fmt:stabBadge, raw:true},
      {key:'marginHistory', label:'Verloop', fmt:renderSparkline, raw:true, sortable:false},
    ];
    renderTable('#bazaarTableWrap', rows, cols, bazaarSort, (col)=>{
      toggleSort(bazaarSort, col); renderBazaarTab();
    }, (row) => {
      addToTradeLog({
        type: 'bazaar',
        boughtItem: row.name, boughtQty: row.units, cost: row.totalCost,
        soldItem: row.name, soldQty: row.units, revenue: null,
        targetPricePerUnit: row.avgSellPrice, targetProfit: row.totalProfit
      });
    }, {
      isOpen: (row) => bazaarExpandedIds.has(row.id),
      onToggle: (row) => {
        if (bazaarExpandedIds.has(row.id)) bazaarExpandedIds.delete(row.id); else bazaarExpandedIds.add(row.id);
        renderBazaarTab();
      },
      render: (row) => {
        const p = bazaarData[row.id];
        if (!p) return '<div class="depth-empty">Geen orderboek-data beschikbaar.</div>';
        return renderOrderBookDepth([
          { title: 'Verkooporders — hieruit koop jij', tiers: p.sell_summary, side: 'sell', highlightQty: row.units },
          // NPC-flips verkopen aan een NPC, niet via de bazaar buy_summary — niks te
          // markeren in dat paneel dan, maar wel nog gewoon tonen ter info
          { title: 'Kooporders — hierin verkoop jij', tiers: p.buy_summary, side: 'buy', highlightQty: row.npcFlip ? 0 : row.units }
        ]);
      }
    });
  }

  function renderBazaarRecommendation(rows, budget, maxQty){
    const candidates = rows.filter(r => r.units > 0 && r.totalProfit > 0);
    candidates.sort((a,b) => b.totalProfit - a.totalProfit);
    const el = $('#bazaarRecommend');
    if (candidates.length === 0){
      el.innerHTML = `<div class="recommend empty"><div class="rec-body">
        <div class="rec-title">Geen duidelijke aanbeveling</div>
        <div class="rec-text">Met €${fmtCoins(budget)} coins en de huidige filters is er geen flip die genoeg marktdiepte heeft. Verhoog je budget/max aantal, verlaag het volumefilter, of zet de manipulatie-filter uit.</div>
      </div></div>`;
      return;
    }
    // prefer a candidate that's proven stable over several refreshes; fall back to the
    // best unstable one with a clear "not yet confirmed" warning instead of blind trust
    const stableCandidates = candidates.filter(r => r.stable);
    const top = stableCandidates.length > 0 ? stableCandidates[0] : candidates[0];
    const isUnsure = !top.stable;
    const partialNote = top.partial ? ` <span style="color:var(--text-faint)">(orderboek/limiet begrensd dit aantal)</span>` : '';
    const unsureNote = isUnsure
      ? `<br><span style="color:var(--accent)">⏳ Nog niet bevestigd — dit item is nog geen ${STABILITY_MIN_STREAK} refreshes op rij stabiel gebleken. Wacht liever nog even, of check zelf extra goed in-game voordat je dit uitvoert.</span>`
      : '';
    el.innerHTML = `<div class="recommend${isUnsure?' unsure':''}"><div class="rec-body">
      <div class="rec-title">${isUnsure?'Beste (nog onbevestigde) keuze':'Beste keuze met jouw budget'}${maxQty>0? ' (max '+fmtInt(maxQty)+' stuks)':''}</div>
      <div class="rec-text">Koop <b>${fmtInt(top.units)}x ${top.icon} ${escapeHTML(top.name)}</b> voor gemiddeld <b>${fmtCoins(top.avgBuyPrice)}</b> coins/stuk (totaal ≈ <b>${fmtCoins(top.totalCost)}</b> coins) en verkoop ze weer voor gemiddeld <b>${fmtCoins(top.avgSellPrice)}</b> coins/stuk.${partialNote}
      Verwachte winst: <b>${fmtCoins(top.totalProfit)}</b> coins (margin ${fmtPct(top.marginPct)}, vol/week ${fmtInt(top.weekVol)}). Dit is de gemiddelde prijs over het echte orderboek, niet alleen de bovenste (mogelijk gemanipuleerde) order.${unsureNote}</div>
      <button id="bazaarRecToLogBtn" style="margin-top:10px;">Zet in Mijn Trades</button>
    </div></div>`;
    $('#bazaarRecToLogBtn').addEventListener('click', () => {
      // logged as "open" (bought, not yet sold) — fill in the real sale price in the
      // Mijn Trades tab once you've actually sold it in-game
      addToTradeLog({
        type: 'bazaar',
        boughtItem: top.name, boughtQty: top.units, cost: top.totalCost,
        soldItem: top.name, soldQty: top.units, revenue: null,
        targetPricePerUnit: top.avgSellPrice, targetProfit: top.totalProfit
      });
    });
  }

