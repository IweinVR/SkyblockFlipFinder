  // ====================================================================
  // ahflip.js — "AH Flip-scanner" tab: scans the ENTIRE Auction House (not
  // just the watchlist), but only for bazaar-tradeable (stackable, no
  // enchants/reforges/stars) items, so a fair price comparison is possible.
  // Two independent signals per item, based on the two cheapest BIN's that
  // processAuctionPage (auctions.js) already collected during the scan:
  //  1. "relist": the cheapest BIN is clearly cheaper than the next-cheapest
  //     BIN of the same item — buy it, relist it on the AH at the normal price.
  //  2. "arb": the cheapest BIN is cheaper than what you'd get selling it on
  //     the bazaar right now — same idea as the watchlist arbitrage badge,
  //     just for the whole AH. Depends on core.js (computeArbitrage, ...).
  // ====================================================================
  let ahFlips = []; // AH-wide flip opportunities from the most recent full scan (see computeAhFlips)
  const AH_FLIP_MIN_DISCOUNT_PCT = 15; // laagste BIN moet minstens dit % goedkoper zijn dan de volgende
  const AH_FLIP_MIN_PROFIT = 500;      // coins, ongeacht welk signaal
  function computeAhFlips(globalBins){
    const out = [];
    for (const id in (globalBins || {})){
      const g = globalBins[id];
      if (!g || !g.min1) continue;
      const display = getItemDisplay(id);
      let relist = null;
      if (g.min2 && g.min2.price > 0){
        const profit = g.min2.price - g.min1.price;
        const discountPct = (profit / g.min2.price) * 100;
        if (profit >= AH_FLIP_MIN_PROFIT && discountPct >= AH_FLIP_MIN_DISCOUNT_PCT){
          relist = { profit, discountPct, refPrice: g.min2.price };
        }
      }
      let arb = null;
      const bazaarSellPrice = getCurrentSellPrice(display.name);
      if (bazaarSellPrice !== null){
        const netBazaarSell = bazaarSellPrice * (1 - flipperTaxRate);
        const profit = netBazaarSell - g.min1.price;
        const discountPct = g.min1.price > 0 ? (profit / g.min1.price) * 100 : 0;
        if (profit >= AH_FLIP_MIN_PROFIT && discountPct >= ARB_MIN_PROFIT_PCT){
          arb = { profit, discountPct, refPrice: netBazaarSell, bazaarSellPrice };
        }
      }
      if (!relist && !arb) continue;
      const bestProfit = Math.max(relist ? relist.profit : -Infinity, arb ? arb.profit : -Infinity);
      out.push({
        id, name: display.name, icon: display.icon,
        binPrice: g.min1.price, remaining: g.min1.remaining,
        relist, arb, bestProfit
      });
    }
    out.sort((a,b) => b.bestProfit - a.bestProfit);
    return out;
  }

  function renderAhFlipper(){
    const el = $('#aucFlipperTableWrap');
    if (!el) return;
    if (ahFlips.length === 0){
      el.innerHTML = `<div class="empty-state">Geen AH flip-kansen gevonden in de laatste scan. Dat is normaal — de meeste spelers verkopen bazaar-achtige items via de bazaar zelf, dus dit zijn de uitzonderingen. Probeer het later opnieuw, of scan vaker met "Automatisch elke 10s scannen".</div>`;
      return;
    }
    const rows = ahFlips.map(f => {
      const badges = (f.relist ? `<span class="ah-flip-badge relist" title="Volgende goedkoopste BIN van dit item: ${fmtCoins(f.relist.refPrice)}">Herverkoop AH (+${fmtCoins(f.relist.profit)}, -${f.relist.discountPct.toFixed(0)}%)</span>` : '')
        + (f.arb ? `<span class="ah-flip-badge arb" title="Huidige bazaar-verkoopprijs netto: ${fmtCoins(f.arb.refPrice)}">Bazaar-arbitrage (+${fmtCoins(f.arb.profit)}, -${f.arb.discountPct.toFixed(0)}%)</span>` : '');
      return `<tr>
        <td class="left"><span class="item-name">${escapeHTML(f.name)}</span><span class="item-id">${escapeHTML(f.id)}</span></td>
        <td>${fmtCoins(f.binPrice)}</td>
        <td>${fmtDuration(f.remaining)}</td>
        <td>${badges}</td>
      </tr>`;
    }).join('');
    el.innerHTML = `<div class="table-wrap"><table><thead><tr>
        <th class="left">Item</th><th>Laagste BIN</th><th>Tijd over</th><th>Kans</th>
      </tr></thead><tbody>${rows}</tbody></table></div>
      <p class="trade-note" style="margin-top:10px;">Exclusief AH-plaatsingskosten voor herverkoop. Een BIN kan al gekocht zijn tegen de tijd dat je 'm opent — check altijd zelf in-game voor je erop rekent.</p>`;
  }

