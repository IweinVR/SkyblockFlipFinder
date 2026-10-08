  // ====================================================================
  // dashboard.js — "Dashboard" tab: a live overview that aggregates numbers
  // already computed by the other tabs (zero extra API calls) into stat
  // cards and a handful of charts, so the state of the market — and your
  // own trading — is visible at a glance before diving into a specific
  // tab. Depends on core.js (renderBarChart/renderDonutChart/renderStatCards,
  // isHealthyMarket, lastGlobalBins) + bazaar.js/craft.js/trades.js/npcscan.js
  // (reads their compute*() functions/state, never duplicates a calculation).
  // ====================================================================

  // Fixed reference budget for the "top flips" lists below — deliberately
  // independent of whatever's typed into the Bazaar/Craft tabs' own budget
  // fields, so the dashboard stays a stable "at a glance" view while you're
  // experimenting with filters over there. It still respects the Bazaar/Craft
  // tabs' tax/manipulatie-filter checkboxes, since those are more "your global
  // trading settings" than per-search filters.
  const DASHBOARD_BUDGET = 1000000;
  const DASHBOARD_MIN_CATEGORY_ITEMS = 2; // don't show a category average based on just 1 item

  // counts how many bazaar items currently pass the same anti-manipulation/liquidity
  // check used everywhere else (isHealthyMarket) — a quick read on "is the market calm
  // right now, or is a lot of it thin/manipulated junk".
  function computeMarketHealth(){
    let healthy = 0, total = 0;
    if (bazaarData){
      for (const id in bazaarData){
        const p = bazaarData[id];
        const qs = p.quick_status;
        if (!qs || (p.sell_summary||[]).length === 0 || (p.buy_summary||[]).length === 0) continue;
        total++;
        if (isHealthyMarket(p, qs)) healthy++;
      }
    }
    return { healthy, total, flagged: total - healthy };
  }

  // average margin% per item category, across whatever profitable bazaar rows were
  // already computed for the dashboard — tells you WHERE to go look, not just what
  // the single best flip is right now.
  function computeCategoryMargins(bazaarRows){
    const byCat = {};
    bazaarRows.forEach(r => {
      if (r.npcFlip) return;
      const cat = itemMeta[r.id] && itemMeta[r.id].category;
      if (!cat) return;
      if (!byCat[cat]) byCat[cat] = { sum: 0, count: 0 };
      byCat[cat].sum += r.marginPct;
      byCat[cat].count++;
    });
    return Object.keys(byCat)
      .filter(cat => byCat[cat].count >= DASHBOARD_MIN_CATEGORY_ITEMS)
      .map(cat => ({ label: niceItemName(cat), value: byCat[cat].sum / byCat[cat].count, sub: byCat[cat].count + 'x gevonden' }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 8);
  }

  function renderDashboard(){
    const emptyEl = document.querySelector('#dashEmptyState');
    const contentEl = document.querySelector('#dashContent');
    if (!emptyEl || !contentEl) return; // panel not in the DOM — defensive, shouldn't happen

    // this re-runs every ~5s bazaar refresh (and after every AH scan / trade-log change)
    // regardless of which tab is open — but unlike a single table render, it does several
    // FULL passes over bazaarData (computeBazaarRows, computeCraftRows, computeMarketHealth,
    // ...) plus 5 chart re-renders. Skip all of that when the tab isn't even visible; the
    // tab-click handler (app.js) re-renders once on switching here, so nothing goes stale.
    const panel = document.querySelector('#panel-dashboard');
    if (panel && !panel.classList.contains('active')) return;

    if (!bazaarData){
      emptyEl.style.display = 'block';
      contentEl.style.display = 'none';
      return;
    }
    emptyEl.style.display = 'none';
    contentEl.style.display = 'block';

    const bazaarRows = computeBazaarRows(0, DASHBOARD_BUDGET, '').filter(r => r.totalProfit > 0);
    const craftRows = computeCraftRows(0, DASHBOARD_BUDGET, '', 0).filter(r => r.totalProfit > 0);
    const nonNpcBazaarRows = bazaarRows.filter(r => !r.npcFlip);
    nonNpcBazaarRows.sort((a,b) => b.totalProfit - a.totalProfit);
    craftRows.sort((a,b) => b.totalProfit - a.totalProfit);

    const health = computeMarketHealth();
    const healthyPct = health.total > 0 ? (health.healthy / health.total) * 100 : 0;
    const npcCount = computeNpcBazaarOpportunities().length + computeNpcAhOpportunities(lastGlobalBins).length;
    const essenceFlipCount = (typeof computeEssenceFlips === 'function') ? computeEssenceFlips().configured.length : 0;
    const tradeProfit = tradeLog.reduce((s,t) => s + tradeStats(t).totalProfit, 0);
    const topBazaar = nonNpcBazaarRows[0];
    const topCraft = craftRows[0];

    renderStatCards('#dashStatCards', [
      { label: 'Bazaar-items getrackt', value: fmtInt(health.total) },
      { label: 'Gezonde markten', value: `<span class="${healthyPct>=70?'profit-pos':(healthyPct<40?'profit-neg':'')}">${healthyPct.toFixed(0)}%</span>`,
        sub: `${fmtInt(health.healthy)} van ${fmtInt(health.total)} liquide &amp; onverdacht` },
      { label: 'Beste bazaar flip nu', value: topBazaar ? fmtPct(topBazaar.marginPct) : '—',
        sub: topBazaar ? escapeHTML(topBazaar.name) : `bij ${fmtCoins(DASHBOARD_BUDGET)} budget` },
      { label: 'Beste craft flip nu', value: topCraft ? fmtPct(topCraft.marginPct) : '—',
        sub: topCraft ? escapeHTML(topCraft.name) : `bij ${fmtCoins(DASHBOARD_BUDGET)} budget` },
      { label: 'Risicovrije NPC-kansen', value: fmtInt(npcCount), sub: 'bazaar-live + laatste AH-scan' },
      { label: 'Essence-flips (laatste scan)', value: fmtInt(essenceFlipCount), sub: 'clean → 5★ met ingevulde kosten' },
      { label: 'Gerealiseerde winst', value: `<span class="${profitClass(tradeProfit)}">${fmtCoins(tradeProfit)}</span>`,
        sub: `${tradeLog.length} trade${tradeLog.length===1?'':'s'} gelogd` },
    ]);

    renderBarChart('#dashTopBazaar', nonNpcBazaarRows.slice(0,8).map(r => ({
      label: r.name, value: r.totalProfit, sub: fmtPct(r.marginPct)
    })), { valueFmt: fmtCoins, barColor: 'var(--blue)' });

    renderBarChart('#dashTopCraft', craftRows.slice(0,8).map(r => ({
      label: r.name, value: r.totalProfit, sub: fmtPct(r.marginPct)
    })), { valueFmt: fmtCoins, barColor: 'var(--accent)' });

    renderBarChart('#dashCategoryMargins', computeCategoryMargins(bazaarRows), { valueFmt: fmtPct, barColor: 'var(--green)' });

    renderDonutChart('#dashMarketHealth', [
      { label: 'Gezond', value: health.healthy, color: 'var(--green)' },
      { label: 'Uitgefilterd', value: health.flagged, color: 'var(--red)' },
    ], { centerLabel: 'gezond', centerValue: healthyPct.toFixed(0) + '%' });

    const daily = (typeof computeDailyProfits === 'function') ? computeDailyProfits() : [];
    renderBarChart('#dashDailyProfit', daily.slice(-10).map(d => ({ label: d.label, value: d.profit })),
      { valueFmt: fmtCoins, barColor: 'var(--blue)' });
  }
