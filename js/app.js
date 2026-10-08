  // ====================================================================
  // app.js — bootstrap/glue: DOM event wiring + the initial render/fetch
  // calls, in the same order the original single-file script ran them in.
  // Loaded LAST (see index.html) so every function/state from every other
  // js/*.js file already exists by the time any of this actually runs.
  // This is the only file that's allowed to reach across feature files.
  // ====================================================================

  // restore persisted state (trade log, watchlist, flipper tax, NPC prices, pet-flip settings)
  loadTradeLog();
  loadWatchlist();
  loadFlipperTax();
  loadNpcPrices();
  applyKnownNpcPriceFixes();
  loadPetXpTable();
  loadStarItemEssence();

  // finish building ENCHANT_DB (enchant.js): merge the "every armor piece" enchants in
  ['helmet','chestplate','leggings','boots'].forEach(piece => {
    ENCHANT_DB[piece] = ENCHANT_DB[piece].concat(ARMOR_COMMON);
  });

  // settings: flipper tax + NPC prices (Uitleg tab)
  $('#settingsFlipperTax').value = (flipperTaxRate * 100).toFixed(2).replace(/\.?0+$/, '');
  updateTaxPctLabels();
  $('#settingsFlipperTax').addEventListener('change', () => {
    const val = parseFloat($('#settingsFlipperTax').value);
    if (isNaN(val) || val < 0 || val >= 100){
      alert('Vul een geldig percentage in (0 t/m 99.99).');
      $('#settingsFlipperTax').value = (flipperTaxRate * 100).toFixed(2).replace(/\.?0+$/, '');
      return;
    }
    flipperTaxRate = val / 100;
    saveFlipperTax();
    updateTaxPctLabels();
    renderBazaarTab();
    renderCraftTab();
  });

  $('#npcAddBtn').addEventListener('click', () => {
    const rawId = $('#npcItemInput').value.trim().toUpperCase().replace(/[\s'-]+/g, '_');
    const price = parseFloat($('#npcPriceInput').value);
    if (!rawId){ alert('Vul een item-ID in, bv. ENCHANTED_SNOW_BLOCK.'); return; }
    if (isNaN(price) || price <= 0){ alert('Vul een geldige NPC-verkoopprijs per stuk in.'); return; }
    npcPrices[rawId] = price;
    $('#npcItemInput').value = ''; $('#npcPriceInput').value = '';
    renderNpcList();
    renderBazaarTab();
    renderNpcScannerTab();
  });
  $('#npcItemInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#npcAddBtn').click(); });
  $('#npcPriceInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#npcAddBtn').click(); });
  renderNpcList();

  // Pet Flips: XP-instellingen + Kat-calculator (de scan-tabel zelf wordt elke scan
  // opnieuw gerenderd door scanAuctions in auctions.js, zie verderop)
  $('#petXpResetBtn').addEventListener('click', () => {
    if (confirm('Standaard XP-schattingen herstellen?')){
      petXpTable = Object.assign({}, PET_XP_DEFAULTS);
      savePetXpTable();
      renderPetXpSettings();
      renderPetFlipper();
    }
  });
  renderPetXpSettings();
  ['katPetNameInput','katFromRarity','katToRarity','katFeeInput','katMaterialInput'].forEach(id => {
    $('#' + id).addEventListener('input', renderKatCalculator);
    $('#' + id).addEventListener('change', renderKatCalculator);
  });
  renderPetFlipper();

  // Essence Flips: items & essence-kosten instellen (de clean/5★-paren zelf worden
  // elke scan opnieuw gerenderd door scanAuctions in auctions.js, zie verderop)
  $('#starItemAddBtn').addEventListener('click', () => {
    const name = $('#starItemNameInput').value.trim();
    const type = $('#starItemTypeInput').value;
    const amountRaw = parseFloat($('#starItemAmountInput').value);
    if (!name){ alert('Vul een itemnaam in, exact zoals op de AH (bv. "Hyperion").'); return; }
    starItemEssence[name] = { type, amount: (!isNaN(amountRaw) && amountRaw > 0) ? amountRaw : null };
    saveStarItemEssence();
    $('#starItemNameInput').value = ''; $('#starItemAmountInput').value = '';
    renderStarItemSettings();
    renderEssenceFlips();
  });
  $('#starItemNameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#starItemAddBtn').click(); });
  renderStarItemSettings();
  renderEssenceFlips();

  $('#aucAddBtn').addEventListener('click', () => {
    const val = $('#aucItemInput').value.trim();
    if (!val) return;
    const alertRaw = $('#aucAlertInput').value.trim();
    const alertPrice = alertRaw === '' ? null : parseShorthandNumber(alertRaw);
    const resolved = resolveAuctionTerm(val);
    const key = val.toLowerCase();
    if (!auctionWatchlist.some(w => w.term === key)){
      auctionWatchlist.push({ term: key, searchTerm: resolved.searchTerm, displayName: resolved.displayName, iconUrl: resolved.iconUrl, alertPrice });
    } else {
      auctionWatchlist = auctionWatchlist.map(w => w.term === key ? {...w, searchTerm: resolved.searchTerm, displayName: resolved.displayName, iconUrl: resolved.iconUrl, alertPrice} : w);
    }
    $('#aucItemInput').value = ''; $('#aucAlertInput').value = '';
    renderWatchlist();
  });
  $('#aucItemInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#aucAddBtn').click(); });
  $('#aucAlertInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#aucAddBtn').click(); });

  // deze drie tabbladen (Auction House, AH Flip-scanner, NPC-verkoop) delen allemaal
  // dezelfde volledige scan — elk heeft zijn eigen scanknop/statuslijn/voortgangsbalk
  // (aparte elementen), maar ze worden via een gedeelde class allemaal tegelijk bijgewerkt
  $$('.auc-scan-btn').forEach(btn => btn.addEventListener('click', scanAuctions));

  $('#aucAutoScan').addEventListener('change', () => {
    if (auctionAutoTimer) { clearInterval(auctionAutoTimer); auctionAutoTimer = null; }
    if ($('#aucAutoScan').checked){
      if (auctionWatchlist.length === 0){
        alert('Voeg eerst minstens één item toe aan je watchlist.');
        $('#aucAutoScan').checked = false;
        return;
      }
      scanAuctions();
      auctionAutoTimer = setInterval(scanAuctions, 10000);
    }
  });

  // ---------- monitor mode: fullscreen dashboard for a second monitor ----------
  $('#aucMonitorBtn').addEventListener('click', enterMonitorMode);
  $('#aucExitMonitorBtn').addEventListener('click', exitMonitorMode);
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) document.body.classList.remove('monitor-mode');
  });

  renderWatchlist();
  renderAuctionResults();
  renderAhFlipper();
  renderNpcScannerTab();
  renderEnchantOptimizer();
  renderDashboard();
  renderMarketTicker();

  // ---------- tabs ----------
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b=>b.classList.remove('active'));
      $$('.panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      // Dashboard skips its (relatively expensive) render while its panel isn't visible
      // (see dashboard.js) — catch it up immediately on switching here, so it never shows
      // stale/empty data for up to 5s while waiting for the next bazaar refresh.
      if (btn.dataset.tab === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
    });
  });

  // ---------- controls ----------
  ['bazaarSearch','bazaarBudget','bazaarMaxQty','bazaarMinVol','bazaarTax','bazaarSafe','bazaarCategory'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderBazaarTab);
    document.getElementById(id).addEventListener('change', renderBazaarTab);
  });
  ['craftSearch','craftBudget','craftMaxQty','craftMaxRaw','craftMinVol','craftTax','craftSafe','craftCategory'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderCraftTab);
    document.getElementById(id).addEventListener('change', renderCraftTab);
  });
  $('#refreshBtn').addEventListener('click', () => { fetchBazaar(); secondsLeft = REFRESH_SECONDS; });

  // ---------- trade log ----------
  // A trade starts the moment you buy (we know cost, item, qty — but not yet what
  // you'll sell it for in-game, or whether you'll sell it all at once). Each trade can
  // have MULTIPLE sell entries — e.g. sell 40 of your 100 now for X, sell the rest of
  // 60 later for Y — so partial/staggered selling matches how flipping actually works.
  // Profit is computed PER SELL (revenue minus that sell's share of the cost) and only
  // counts toward the totals once a sell is actually logged. Losses are just negative
  // profit — no special-casing, the coloring (green/red) already handles that.
  $('#tradeAddBtn').addEventListener('click', () => {
    const type = $('#tradeType').value;
    const boughtItem = $('#tradeBoughtItem').value.trim();
    const boughtQty = parseFloat($('#tradeBoughtQty').value) || 0;
    const cost = parseFloat($('#tradeCost').value) || 0;
    const soldItemRaw = $('#tradeSoldItem').value.trim();
    const soldItem = soldItemRaw || boughtItem; // bazaar flips: same item bought & sold
    const soldQty = parseFloat($('#tradeSoldQty').value) || boughtQty;
    const revenueRaw = $('#tradeRevenue').value.trim();
    const revenue = revenueRaw === '' ? null : parseFloat(revenueRaw);
    if (!boughtItem || cost <= 0){
      alert('Vul minstens een gekocht item en een kostprijs in.');
      return;
    }
    addToTradeLog({ type, boughtItem, boughtQty, cost, soldItem, soldQty, revenue });
    $('#tradeBoughtItem').value = ''; $('#tradeBoughtQty').value = ''; $('#tradeCost').value = '';
    $('#tradeSoldItem').value = ''; $('#tradeSoldQty').value = ''; $('#tradeRevenue').value = '';
  });

  $('#tradeClearBtn').addEventListener('click', () => {
    if (tradeLog.length === 0) return;
    if (confirm('Weet je zeker dat je alle gelogde trades wilt wissen?')){
      tradeLog = [];
      renderTradeLog();
    }
  });

  $('#tradeExportBtn').addEventListener('click', () => {
    if (tradeLog.length === 0){ alert('Nog niets om te exporteren.'); return; }
    const header = 'Type,Gekocht item,Aantal gekocht,Kostprijs totaal,Kostprijs/stuk,Verkocht item,Aantal verkocht (deze verkoop),Verkoopprijs (deze verkoop),Winst (deze verkoop),Tijd gekocht,Tijd verkocht\n';
    const rows = [];
    tradeLog.forEach(t => {
      const st = tradeStats(t);
      if (t.sells.length === 0){
        rows.push(`${t.type},"${t.boughtItem.replace(/"/g,'""')}",${Math.round(t.boughtQty)},${Math.round(t.cost)},${Math.round(st.costPerUnit)},"${t.soldItem.replace(/"/g,'""')}",,,,"${t.time}",`);
      } else {
        t.sells.forEach(s => {
          const profit = s.revenue - s.qty * st.costPerUnit;
          rows.push(`${t.type},"${t.boughtItem.replace(/"/g,'""')}",${Math.round(t.boughtQty)},${Math.round(t.cost)},${Math.round(st.costPerUnit)},"${t.soldItem.replace(/"/g,'""')}",${Math.round(s.qty)},${Math.round(s.revenue)},${Math.round(profit)},"${t.time}","${s.time}"`);
        });
      }
    });
    const blob = new Blob([header + rows.join('\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skyblock-trades-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // initial trade-log + profit-chart render
  renderTradeLog();

  // ---------- auto refresh countdown ----------
  countdownTimer = setInterval(tickCountdown, 1000);

  // initial load
  fetchBazaar();
  fetchItemMeta();
