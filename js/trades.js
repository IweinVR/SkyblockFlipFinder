  // ====================================================================
  // trades.js — "Mijn Trades" tab: a self-logged trade journal (persisted to
  // localStorage) with partial/staggered selling, a live "current market
  // price vs. target" comparison, CSV export and a cumulative profit chart
  // (hand-rolled inline SVG, no external chart lib). Depends on core.js.
  // ====================================================================
  let tradeLog = [];
  let tradeIdCounter = 1;

  const TRADE_STORAGE_KEY = 'skyblockFlipFinder_tradeLog_v1';
  function saveTradeLog(){
    try {
      localStorage.setItem(TRADE_STORAGE_KEY, JSON.stringify({ tradeLog, tradeIdCounter }));
    } catch (e) { /* localStorage niet beschikbaar (bv. privénavigatie) — negeer stil */ }
  }
  function loadTradeLog(){
    try {
      const raw = localStorage.getItem(TRADE_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.tradeLog)){
        tradeLog = data.tradeLog;
        const maxId = tradeLog.reduce((m,t) => Math.max(m, t.id || 0), 0);
        tradeIdCounter = data.tradeIdCounter && data.tradeIdCounter > maxId ? data.tradeIdCounter : maxId + 1;
      }
    } catch (e) { /* corrupte of ontbrekende opslag — start gewoon leeg */ }
  }
  function tradeStats(t){
    // "sellableQty" is hoeveel je UITEINDELIJK te verkopen hebt van het verkochte item —
    // bij een gewone bazaar-flip is dat gelijk aan boughtQty (zelfde item), maar bij een
    // craft-flip koop je bv. 32.000x grondstof en craft je die om tot maar 200x enchanted
    // item: dan moet zowel "nog te verkopen" als de kostprijs/stuk gebaseerd zijn op die
    // 200, niet op de 32.000 grondstof-eenheden. Oudere, al opgeslagen trades hebben dit
    // veld nog niet — die vallen terug op het oude (soms onjuiste) boughtQty-gedrag.
    const sellableQty = (t.sellableQty !== undefined && t.sellableQty !== null && t.sellableQty > 0)
      ? t.sellableQty : t.boughtQty;
    const costPerUnit = sellableQty > 0 ? t.cost / sellableQty : t.cost;
    const soldQty = t.sells.reduce((s,x) => s + x.qty, 0);
    const remainingQty = Math.max(0, sellableQty - soldQty);
    const totalProfit = t.sells.reduce((s,x) => s + (x.revenue - x.qty * costPerUnit), 0);
    const status = t.sells.length === 0 ? 'open' : (remainingQty > 0.0001 ? 'partial' : 'closed');
    return { costPerUnit, soldQty, remainingQty, totalProfit, status, sellableQty };
  }

  // "huidige marktprijs vs. richtprijs" — links an open trade back to what the bazaar
  // is doing RIGHT NOW, instead of the trade log going stale the moment you add it.
  // Works for any trade whose "verkocht als"-item matches a known bazaar item, and
  // shows the delta vs. the recommendation's target price when one was set.
  function renderPriceCompareHtml(t){
    const current = getCurrentSellPrice(t.soldItem);
    if (current === null) return '';
    let html = `Huidige marktprijs: <b>${fmtCoins(current)}</b>/stuk`;
    if (t.targetPricePerUnit){
      const diffPct = ((current - t.targetPricePerUnit) / t.targetPricePerUnit) * 100;
      const cls = diffPct >= 0 ? 'profit-pos' : 'profit-neg';
      html += ` <span class="${cls}">(${diffPct>=0?'▲ +':'▼ '}${diffPct.toFixed(1)}% t.o.v. je richtprijs van ${fmtCoins(t.targetPricePerUnit)})</span>`;
    }
    return html;
  }

  // called on every ~5s bazaar refresh — updates only the small price-compare lines
  // in place (by id), so it never disturbs focus/text in the sell-qty/revenue inputs
  // a user might be mid-typing into elsewhere in the (unrelated) table rows.
  function refreshTradePriceComparisons(){
    tradeLog.forEach(t => {
      const el = document.getElementById('price-compare-' + t.id);
      if (!el) return;
      const html = renderPriceCompareHtml(t);
      if (html) el.innerHTML = html;
    });
  }

  function renderTradeLog(){
    saveTradeLog();
    const allSells = tradeLog.flatMap(t => t.sells);
    const totalProfit = tradeLog.reduce((s,t) => s + tradeStats(t).totalProfit, 0);
    const openCount = tradeLog.filter(t => tradeStats(t).status !== 'closed').length;
    $('#tradeCount').textContent = tradeLog.length;
    $('#tradeOpenCount').textContent = openCount;
    $('#tradeTotal').textContent = fmtCoins(totalProfit);
    $('#tradeTotal').style.color = totalProfit >= 0 ? 'var(--green)' : 'var(--red)';
    $('#tradeAvg').textContent = allSells.length ? fmtCoins(totalProfit / allSells.length) : '—';

    if (tradeLog.length === 0){
      $('#tradeTableWrap').innerHTML = `<div class="empty-state">Nog geen trades gelogd. Voeg hierboven je eerste flip toe, of klik op "Zet in Mijn Trades" bij een aanbeveling.</div>`;
      renderProfitChart();
      return;
    }
    let html = '<div class="table-wrap"><table><thead><tr>'
      + '<th class="left">Type</th><th class="left">Gekocht</th><th>Prijs/stuk (koop)</th><th>Kostprijs</th>'
      + '<th class="left">Verkocht als</th><th class="left">Status</th><th>Winst tot nu toe</th><th>Tijd</th><th></th>'
      + '</tr></thead><tbody>';
    tradeLog.slice().reverse().forEach(t => {
      const st = tradeStats(t);
      const typeLabel = t.type === 'craft' ? 'Craft' : 'Bazaar';
      const statusBadge = st.status === 'open' ? '<span class="open-badge">⏳ nog niet verkocht</span>'
        : st.status === 'partial' ? `<span class="partial-badge">◐ ${fmtInt(st.soldQty)}/${fmtInt(st.sellableQty)} verkocht</span>`
        : '<span class="closed-badge">✓ volledig verkocht</span>';

      html += `<tr>
        <td class="left">${typeLabel}</td>
        <td class="left"><span class="item-name">${fmtInt(t.boughtQty)}x ${escapeHTML(t.boughtItem)}</span></td>
        <td>${fmtCoins(st.costPerUnit)}</td>
        <td>${fmtCoins(t.cost)}</td>
        <td class="left"><span class="item-name">${escapeHTML(t.soldItem)}</span></td>
        <td class="left">${statusBadge}</td>
        <td class="${profitClass(st.totalProfit)}">${t.sells.length ? fmtCoins(st.totalProfit) : '—'}</td>
        <td style="color:var(--text-faint);font-size:11px;">${t.time}</td>
        <td><button class="del-btn" data-id="${t.id}" title="Verwijder hele trade">✕</button></td>
      </tr>`;

      // detail row: past sells for this trade + (if anything remains) a form to log another sell
      const sellLines = t.sells.map(s => {
        const profit = s.revenue - s.qty * st.costPerUnit;
        return `<div class="sell-line">
          <span>${fmtInt(s.qty)}x verkocht voor <b>${fmtCoins(s.revenue)}</b> (${fmtCoins(s.revenue / s.qty)}/stuk)</span>
          <span class="sell-profit ${profitClass(profit)}">${profit >= 0 ? '+' : ''}${fmtCoins(profit)}</span>
          <span style="color:var(--text-faint);font-size:11px;">${s.time}</span>
          <button class="sell-del" data-trade="${t.id}" data-sell="${s.id}" title="Verwijder deze verkoop">✕</button>
        </div>`;
      }).join('');
      const suggestedTotal = t.targetPricePerUnit ? st.remainingQty * t.targetPricePerUnit : null;
      const targetHintHtml = (st.remainingQty > 0.0001 && t.targetPricePerUnit) ? `
        <div class="target-hint" title="Verwachting op het moment dat je toevoegde (${fmtCoins(suggestedTotal)} totaal) — check de actuele prijs in-game.">Verwachte verkoopprijs: <b>${fmtCoins(t.targetPricePerUnit)}</b>/stuk
          <button class="fill-target-btn" data-id="${t.id}" data-qty="${st.remainingQty}" data-total="${suggestedTotal}" title="Vult aantal + totaalbedrag hieronder automatisch in">Vul in</button>
        </div>` : '';
      // live "huidige marktprijs vs. richtprijs" line — refreshed independently every
      // bazaar tick (see refreshTradePriceComparisons) so it stays current WITHOUT
      // re-rendering the whole row and losing whatever you're mid-typing below.
      const priceCompareHtml = st.remainingQty > 0.0001
        ? `<div class="price-compare" id="price-compare-${t.id}">${renderPriceCompareHtml(t)}</div>` : '';
      const addSellFormHtml = st.remainingQty > 0.0001 ? `
        <div class="sale-input-row">
          <input type="number" placeholder="aantal (max ${fmtInt(st.remainingQty)})" data-id="${t.id}" class="sell-qty-input" style="width:150px;">
          <input type="number" placeholder="totaalbedrag voor dít aantal (niet per stuk!)" data-id="${t.id}" class="sell-revenue-input" style="width:230px;">
          <button class="confirm-sale-btn primary" data-id="${t.id}">✓ Verkoop loggen</button>
        </div>` : '';
      html += `<tr class="trade-detail-row"><td colspan="9">
        ${sellLines ? `<div class="sells-list">${sellLines}</div>` : ''}
        ${st.remainingQty > 0.0001 ? `<div class="remaining-note">Nog ${fmtInt(st.remainingQty)}x niet verkocht${t.sells.length ? ' — vul hieronder de volgende (deel)verkoop in' : ''}: ${targetHintHtml}</div>` : ''}
        ${priceCompareHtml}
        ${addSellFormHtml}
      </td></tr>`;
    });
    html += '</tbody></table></div>';
    $('#tradeTableWrap').innerHTML = html;
    $('#tradeTableWrap').querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tradeLog = tradeLog.filter(t => t.id !== Number(btn.dataset.id));
        renderTradeLog();
      });
    });
    $('#tradeTableWrap').querySelectorAll('.sell-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = tradeLog.find(t => t.id === Number(btn.dataset.trade));
        if (!t) return;
        t.sells = t.sells.filter(s => s.id !== Number(btn.dataset.sell));
        renderTradeLog();
      });
    });
    $('#tradeTableWrap').querySelectorAll('.fill-target-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const qtyInput = $('#tradeTableWrap').querySelector(`.sell-qty-input[data-id="${id}"]`);
        const revInput = $('#tradeTableWrap').querySelector(`.sell-revenue-input[data-id="${id}"]`);
        if (qtyInput) qtyInput.value = Math.round(parseFloat(btn.dataset.qty));
        if (revInput) revInput.value = Math.round(parseFloat(btn.dataset.total));
      });
    });
    $('#tradeTableWrap').querySelectorAll('.confirm-sale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const qtyInput = $('#tradeTableWrap').querySelector(`.sell-qty-input[data-id="${id}"]`);
        const revInput = $('#tradeTableWrap').querySelector(`.sell-revenue-input[data-id="${id}"]`);
        const qty = parseFloat(qtyInput.value);
        const revenue = parseFloat(revInput.value);
        if (isNaN(qty) || qty <= 0){
          alert('Vul in hoeveel stuks je (deze keer) verkocht hebt.');
          return;
        }
        if (isNaN(revenue)){
          alert('Vul in voor hoeveel coins je dit verkocht hebt (dit mag ook lager zijn dan de kostprijs, bij verlies).');
          return;
        }
        addSellToTrade(id, qty, revenue);
      });
    });
    renderProfitChart();
  }

  function addSellToTrade(tradeId, qty, revenue){
    const t = tradeLog.find(t => t.id === tradeId);
    if (!t) return;
    const st = tradeStats(t);
    if (qty > st.remainingQty + 0.0001){
      alert(`Je hebt nog maar ${fmtInt(st.remainingQty)}x over om te verkopen bij deze trade.`);
      return;
    }
    t.sells.push({
      id: t.sellIdCounter++,
      qty, revenue,
      time: new Date().toLocaleString('nl-NL', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}),
      timestamp: Date.now()
    });
    renderTradeLog();
  }

  // shared by the manual "+ Toevoegen" button and the recommendation "Zet in Mijn
  // Trades" buttons — creates a trade (with an initial sell logged only if a revenue was
  // given), refreshes the log, and switches to that tab.
  function addToTradeLog(t){
    const hasRevenue = t.revenue !== null && t.revenue !== undefined && !isNaN(t.revenue);
    const sellableQty = (t.soldQty !== undefined && t.soldQty !== null && !isNaN(t.soldQty) && t.soldQty > 0)
      ? t.soldQty : t.boughtQty;
    const trade = {
      id: tradeIdCounter++,
      type: t.type, boughtItem: t.boughtItem, boughtQty: t.boughtQty, cost: t.cost,
      soldItem: t.soldItem, sellableQty,
      // richtprijs vanuit de aanbeveling (indien via "Zet in Mijn Trades" toegevoegd) —
      // puur een aanwijzing van wat je in-game zou moeten proberen te halen, niet bindend
      targetPricePerUnit: t.targetPricePerUnit || null,
      targetProfit: t.targetProfit !== undefined ? t.targetProfit : null,
      time: new Date().toLocaleString('nl-NL', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}),
      sellIdCounter: 1,
      sells: []
    };
    if (hasRevenue){
      trade.sells.push({
        id: trade.sellIdCounter++,
        qty: sellableQty, revenue: t.revenue,
        time: trade.time, timestamp: Date.now()
      });
    }
    tradeLog.push(trade);
    renderTradeLog();
    $$('.tab-btn').forEach(b=>b.classList.remove('active'));
    $$('.panel').forEach(p=>p.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="trades"]').classList.add('active');
    document.getElementById('panel-trades').classList.add('active');
  }

  function computeDailyProfits(){
    const byDay = {}; // dateKey -> {profit, count, timestamp}
    tradeLog.forEach(t => {
      const st = tradeStats(t);
      t.sells.forEach(s => {
        const d = new Date(s.timestamp);
        const key = d.toISOString().slice(0,10);
        if (!byDay[key]) byDay[key] = { profit: 0, count: 0, timestamp: s.timestamp, label: d.toLocaleDateString('nl-NL', {day:'2-digit', month:'2-digit'}) };
        const profit = s.revenue - s.qty * st.costPerUnit;
        byDay[key].profit += profit;
        byDay[key].count += 1;
        byDay[key].timestamp = Math.min(byDay[key].timestamp, s.timestamp);
      });
    });
    return Object.keys(byDay).sort().map(k => ({ key: k, ...byDay[k] }));
  }

  // gerealiseerde winst opgesplitst per trade-type — voedt de "Winst per type"-donut
  // hieronder, en (herbruikt) het Dashboard-tabblad zou dit in theorie ook kunnen tonen.
  function computeProfitByType(){
    const totals = {};
    tradeLog.forEach(t => {
      const st = tradeStats(t);
      totals[t.type] = (totals[t.type] || 0) + st.totalProfit;
    });
    return totals;
  }

  function renderProfitChart(){
    if (typeof renderDonutChart === 'function'){
      const byType = computeProfitByType();
      const bazaarProfit = byType.bazaar || 0;
      const craftProfit = byType.craft || 0;
      renderDonutChart('#tradeTypeDonut', [
        { label: 'Bazaar flips', value: Math.max(0, bazaarProfit), fmtValue: fmtCoins(bazaarProfit), color: 'var(--blue)' },
        { label: 'Craft flips', value: Math.max(0, craftProfit), fmtValue: fmtCoins(craftProfit), color: 'var(--accent)' },
      ], { centerLabel: 'winst', centerValue: fmtCoins(bazaarProfit + craftProfit) });
    }
    const daily = computeDailyProfits();
    const chartWrap = $('#chartWrap');
    const dailyWrap = $('#dailyListWrap');
    if (daily.length === 0){
      chartWrap.innerHTML = `<div class="chart-empty">Nog geen verkopen gelogd — zodra je een verkoop invult, verschijnt hier je winstlijn.</div>`;
      dailyWrap.innerHTML = `<div class="chart-empty">—</div>`;
      return;
    }

    // daily list (most recent first)
    dailyWrap.innerHTML = daily.slice().reverse().map(d => `
      <div class="daily-row">
        <span><span class="d-date">${d.label}</span><span class="d-count">(${d.count}x verkocht)</span></span>
        <span class="d-amt ${profitClass(d.profit)}">${d.profit >= 0 ? '+' : ''}${fmtCoins(d.profit)}</span>
      </div>`).join('');

    // cumulative line
    let running = 0;
    const points = daily.map(d => { running += d.profit; return { ...d, cumulative: running }; });

    const W = 640, H = 220, padL = 60, padR = 16, padT = 16, padB = 30;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const minY = Math.min(0, ...points.map(p => p.cumulative));
    const maxY = Math.max(0, ...points.map(p => p.cumulative));
    const yRange = (maxY - minY) || 1;
    const x = i => points.length > 1 ? padL + (i/(points.length-1)) * innerW : padL + innerW/2;
    const y = v => padT + innerH - ((v - minY) / yRange) * innerH;

    // stepped ("pixelated") path instead of a smooth diagonal line — a horizontal run
    // then a vertical jump at each new day, no interpolation. Each leg is colored green
    // or red by direction (deliberately no single flat line color), and points are
    // squares with square caps/joins — a blocky terminal look, not a stock-app curve.
    const zeroY = y(0).toFixed(1);
    let stepSegmentsSvg = '';
    let areaPath = `M${x(0).toFixed(1)},${zeroY} L${x(0).toFixed(1)},${y(points[0].cumulative).toFixed(1)}`;
    for (let i = 1; i < points.length; i++){
      const up = points[i].cumulative >= points[i-1].cumulative;
      stepSegmentsSvg += `<path d="M${x(i-1).toFixed(1)},${y(points[i-1].cumulative).toFixed(1)} H${x(i).toFixed(1)} V${y(points[i].cumulative).toFixed(1)}" fill="none" stroke="${up?'var(--green)':'var(--red)'}" stroke-width="2" stroke-linecap="square"/>`;
      areaPath += ` H${x(i).toFixed(1)} V${y(points[i].cumulative).toFixed(1)}`;
    }
    areaPath += ` L${x(points.length-1).toFixed(1)},${zeroY} Z`;
    const areaColor = points[points.length-1].cumulative >= 0 ? 'var(--green)' : 'var(--red)';

    // sparse x labels so they don't collide
    const labelStep = Math.max(1, Math.ceil(points.length / 6));

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" id="profitSvg" style="overflow:visible;display:block;">`;
    svg += `<line x1="${padL}" y1="${zeroY}" x2="${W-padR}" y2="${zeroY}" stroke="var(--border)" stroke-width="1"/>`;
    svg += `<path d="${areaPath}" fill="${areaColor}" opacity="0.10" stroke="none"/>`;
    svg += stepSegmentsSvg;
    points.forEach((p,i) => {
      if (i % labelStep === 0 || i === points.length-1){
        svg += `<text x="${x(i).toFixed(1)}" y="${H-8}" font-size="9.5" fill="var(--text-faint)" text-anchor="middle">${p.label}</text>`;
      }
      const ptColor = p.profit >= 0 ? 'var(--green)' : 'var(--red)';
      svg += `<rect class="pt" data-i="${i}" x="${(x(i)-3).toFixed(1)}" y="${(y(p.cumulative)-3).toFixed(1)}" width="6" height="6" fill="${ptColor}" stroke="#0f1117" stroke-width="1"/>`;
    });
    svg += `<text x="${padL}" y="12" font-size="10" fill="var(--text-faint)">${fmtCoins(maxY)}</text>`;
    svg += `<text x="${padL}" y="${H-padB+2}" font-size="10" fill="var(--text-faint)">${fmtCoins(minY)}</text>`;
    svg += `<line class="crosshair" x1="0" y1="${padT}" x2="0" y2="${H-padB}" stroke="var(--text-faint)" stroke-width="1" stroke-dasharray="3,3" opacity="0"/>`;
    svg += `</svg>`;
    svg += `<div class="chart-tooltip" id="chartTooltip"></div>`;
    chartWrap.innerHTML = svg;

    const svgEl = $('#profitSvg');
    const tooltip = $('#chartTooltip');
    const crosshair = svgEl.querySelector('.crosshair');
    svgEl.addEventListener('mousemove', (e) => {
      const rect = svgEl.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * W;
      let nearest = 0, best = Infinity;
      points.forEach((p,i) => { const d = Math.abs(x(i) - relX); if (d < best){ best = d; nearest = i; } });
      const p = points[nearest];
      crosshair.setAttribute('x1', x(nearest)); crosshair.setAttribute('x2', x(nearest));
      crosshair.setAttribute('opacity', '1');
      tooltip.style.opacity = '1';
      tooltip.innerHTML = `<b>${p.label}</b><br>Die dag: <span style="color:${p.profit>=0?'var(--green)':'var(--red)'}">${p.profit>=0?'+':''}${fmtCoins(p.profit)}</span><br>Cumulatief: ${fmtCoins(p.cumulative)}`;
      const px = (x(nearest)/W) * rect.width;
      tooltip.style.left = Math.min(rect.width - 140, Math.max(0, px + 10)) + 'px';
      tooltip.style.top = '6px';
    });
    svgEl.addEventListener('mouseleave', () => {
      crosshair.setAttribute('opacity', '0');
      tooltip.style.opacity = '0';
    });
  }

