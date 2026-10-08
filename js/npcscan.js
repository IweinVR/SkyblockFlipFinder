  // ====================================================================
  // npcscan.js — "NPC-verkoop" tab: zero-risk flips against fixed NPC
  // sell prices (bazaar side: live, recomputed every ~5s refresh; AH side:
  // based on the two cheapest BIN's from the most recent full Auction House
  // scan, see lastGlobalBins in core.js). Also owns the user-editable NPC
  // price list rendered under Instellingen (Uitleg tab). Depends on core.js.
  // ====================================================================
  const NPC_STORAGE_KEY = 'skyblockFlipFinder_npcPrices_v1';
  const NPC_SEEDED_KEY = 'skyblockFlipFinder_npcDefaultsSeeded_v1';
  let npcPrices = {};
  let npcStability = {};
  // Naam -> NPC-verkoopprijs/stuk. Bron: publiek gedocumenteerde Hypixel Skyblock
  // NPC-verkoopprijzen (community-overzichten); deze zijn historisch al jaren stabiel,
  // maar controleer bij twijfel altijd zelf de prijs in-game voor je groot inzet.
  const DEFAULT_NPC_PRICES = {
    'Wheat': 1, 'Enchanted Bread': 60, 'Hay Bale': 9, 'Enchanted Hay Bale': 1300,
    'Carrot': 1, 'Enchanted Carrot': 160, 'Enchanted Carrot on a Stick': 10240, 'Enchanted Golden Carrot': 20608,
    'Potato': 1, 'Enchanted Potato': 160, 'Enchanted Baked Potato': 25600,
    'Pumpkin': 4, 'Enchanted Pumpkin': 640,
    'Melon': 0.5, 'Enchanted Melon': 160, 'Enchanted Glistering Melon': 1000, 'Enchanted Melon Block': 25600,
    'Seeds': 0.5, 'Enchanted Seeds': 80,
    'Red Mushroom': 4, 'Enchanted Red Mushroom': 640, 'Red Mushroom Block': 4, 'Enchanted Red Mushroom Block': 2300,
    'Brown Mushroom': 4, 'Enchanted Brown Mushroom': 640, 'Brown Mushroom Block': 4, 'Enchanted Brown Mushroom Block': 2300,
    'Cocoa Beans': 3, 'Enchanted Cocoa Beans': 480, 'Enchanted Cookie': 61500,
    'Cactus': 1, 'Enchanted Cactus Green': 160, 'Enchanted Cactus': 25600,
    'Sugar Cane': 2, 'Enchanted Sugar': 320, 'Enchanted Paper': 384, 'Enchanted Sugar Cane': 51200,
    'Feather': 3, 'Enchanted Feather': 480,
    'Leather': 3, 'Enchanted Leather': 1700,
    'Raw Beef': 4, 'Enchanted Raw Beef': 640,
    'Raw Porkchop': 5, 'Enchanted Pork': 800, 'Enchanted Grilled Pork': 128000,
    'Raw Chicken': 4, 'Enchanted Raw Chicken': 640, 'Enchanted Egg': 432, 'Enchanted Cake': 2700,
    'Mutton': 5, 'Enchanted Mutton': 800, 'Enchanted Cooked Mutton': 128000,
    'Raw Rabbit': 4, 'Enchanted Raw Rabbit': 640,
    'Rabbit Foot': 5, 'Rabbit Hide': 5, 'Enchanted Rabbit Foot': 800, 'Enchanted Rabbit Hide': 800,
    'Nether Wart': 3, 'Enchanted Nether Wart': 480,
    'Rotten Flesh': 2, 'Enchanted Rotten Flesh': 320,
    'Bone': 2, 'Enchanted Bone': 320,
    'String': 3, 'Enchanted String': 576,
    'Spider Eye': 3, 'Enchanted Spider Eye': 480, 'Enchanted Fermented Spider Eye': 31000,
    'Gunpowder': 4, 'Enchanted Gunpowder': 640, 'Enchanted Firework Rocket': 41000,
    'Ender Pearl': 10, 'Enchanted Ender Pearl': 200, 'Enchanted Eye of Ender': 3520,
    'Ghast Tear': 16, 'Enchanted Ghast Tear': 80,
    'Slimeball': 5, 'Enchanted Slimeball': 800, 'Enchanted Slime Block': 128000,
    'Blaze Rod': 9, 'Enchanted Blaze Powder': 1440, 'Enchanted Blaze Rod': 230400,
    'Magma Cream': 8, 'Enchanted Magma Cream': 1280,
    'Cobblestone': 1, 'Enchanted Cobblestone': 160,
    'Coal': 2, 'Enchanted Coal': 320, 'Enchanted Charcoal': 320, 'Enchanted Block of Coal': 51000,
    'Iron Ingot': 3, 'Enchanted Iron': 480, 'Enchanted Iron Block': 76800,
    'Gold Ingot': 4, 'Enchanted Gold Block': 102000,
    'Diamond': 8, 'Enchanted Diamond': 1280, 'Enchanted Diamond Block': 204800,
    'Lapis Lazuli': 1, 'Enchanted Lapis Lazuli': 160, 'Enchanted Lapis Lazuli Block': 25600,
    'Emerald': 6, 'Enchanted Emerald': 960, 'Enchanted Emerald Block': 153600,
    'Redstone': 1, 'Enchanted Redstone': 160, 'Enchanted Redstone Block': 25600,
    'Nether Quartz': 4, 'Enchanted Quartz': 640, 'Enchanted Quartz Block': 102400,
    'Obsidian': 12, 'Enchanted Obsidian': 1920,
    'Glowstone Dust': 2, 'Enchanted Glowstone Dust': 320, 'Enchanted Glowstone': 61000,
    'Gravel': 3, 'Flint': 4, 'Enchanted Flint': 640,
    'Ice': 0.5, 'Packed Ice': 4.5, 'Enchanted Ice': 80, 'Enchanted Packed Ice': 12800,
    'Netherrack': 1, 'Sand': 2, 'Enchanted Sand': 320,
    'End Stone': 2, 'Enchanted End Stone': 320,
    'Snowball': 1, 'Snow Block': 4, 'Enchanted Snow Block': 600,
    'Oak Wood': 2, 'Enchanted Oak Wood': 320, 'Spruce Wood': 2, 'Enchanted Spruce Wood': 320,
    'Birch Wood': 2, 'Enchanted Birch Wood': 320, 'Dark Oak Wood': 2, 'Enchanted Dark Oak Wood': 320,
    'Acacia Wood': 2, 'Enchanted Acacia Wood': 320, 'Jungle Wood': 2, 'Enchanted Jungle Wood': 320,
    'Raw Fish': 6, 'Enchanted Raw Fish': 960, 'Enchanted Cooked Fish': 150000,
    'Raw Salmon': 10, 'Enchanted Raw Salmon': 1600, 'Enchanted Cooked Salmon': 256000,
    'Clownfish': 20, 'Enchanted Clownfish': 3200,
    'Pufferfish': 15, 'Enchanted Pufferfish': 2400,
    'Prismarine Shard': 5, 'Enchanted Prismarine Shard': 400,
    'Prismarine Crystals': 5, 'Enchanted Prismarine Crystals': 400,
    'Clay': 3, 'Enchanted Clay': 480,
    'Lily Pad': 10, 'Enchanted Lily Pad': 1600,
    'Ink Sack': 2, 'Enchanted Ink Sack': 160,
    'Sponge': 50, 'Enchanted Sponge': 2000, 'Enchanted Wet Sponge': 80000,
    'Hot Potato Book': 13000, 'Compactor': 640, 'Super Compactor 3000': 50000,
    'Enchanted Redstone Lamp': 30720, 'Enchanted Lava Bucket': 50000,
    'Hamster Wheel': 20000, 'Foul Flesh': 25000, 'Catalyst': 500
  };
  // eenmalige, zelf-helende correctie voor standaardprijzen die eerder fout de
  // DEFAULT_NPC_PRICES-lijst in zaten (bv. Enchanted Rabbit Hide: 2880 i.p.v. 800) en
  // dus bij bestaande gebruikers al in hun browser-opslag staan — seedDefaultNpcPricesIfNeeded
  // vult dit immers maar één keer, dus een latere fix van de lijst zelf bereikt een reeds
  // geseede waarde niet. Corrigeert ALLEEN als de huidige prijs nog exact de oude, foute
  // waarde is, dus een eigen aanpassing van de gebruiker (al dan niet toevallig hetzelfde
  // getal) blijft met rust; eenmaal gecorrigeerd is deze check voorgoed een no-op.
  const NPC_PRICE_FIXES = {
    'ENCHANTED_RABBIT_HIDE': { wrong: 2880, right: 800 }, // was een tikfout, zie README/git-log
  };
  function applyKnownNpcPriceFixes(){
    let changed = false;
    for (const id in NPC_PRICE_FIXES){
      const fix = NPC_PRICE_FIXES[id];
      if (npcPrices[id] === fix.wrong){
        npcPrices[id] = fix.right;
        changed = true;
      }
    }
    if (changed) saveNpcPrices();
  }
  function saveNpcPrices(){
    try { localStorage.setItem(NPC_STORAGE_KEY, JSON.stringify(npcPrices)); } catch (e) {}
  }
  function loadNpcPrices(){
    try {
      const raw = localStorage.getItem(NPC_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') npcPrices = data;
    } catch (e) {}
  }
  // seeded once, na het laden van de item-database (voor naam -> ID matching); vult
  // alleen items aan die nog niet bestaan, overschrijft dus nooit eigen aanpassingen
  function seedDefaultNpcPricesIfNeeded(){
    try {
      if (localStorage.getItem(NPC_SEEDED_KEY)) return;
      let added = 0;
      for (const name in DEFAULT_NPC_PRICES){
        const id = itemNameToId[name.toLowerCase()];
        if (!id || npcPrices[id] !== undefined) continue;
        npcPrices[id] = DEFAULT_NPC_PRICES[name];
        added++;
      }
      localStorage.setItem(NPC_SEEDED_KEY, '1');
      if (added > 0){ saveNpcPrices(); if (typeof renderNpcList === 'function') renderNpcList(); if (typeof renderNpcScannerTab === 'function') renderNpcScannerTab(); }
    } catch (e) {}
  }

  function computeNpcBazaarOpportunities(){
    const out = [];
    if (!bazaarData) return out;
    for (const id in npcPrices){
      const p = bazaarData[id];
      if (!p) continue;
      const qs = p.quick_status;
      const sellSummary = p.sell_summary || [];
      if (!qs || sellSummary.length === 0) continue;
      if (!isHealthyMarket(p, qs)) continue; // altijd de manipulatie-check toepassen, geen toggle hier
      const top = sellSummary[0];
      const npcPrice = npcPrices[id];
      if (!top || !(top.pricePerUnit > 0) || top.pricePerUnit >= npcPrice) continue;
      const display = getItemDisplay(id);
      const profitPerUnit = npcPrice - top.pricePerUnit;
      out.push({
        id, name: display.name, icon: display.icon, source: 'bazaar',
        buyPrice: top.pricePerUnit, npcPrice, profitPerUnit,
        marginPct: (profitPerUnit / top.pricePerUnit) * 100,
        qtyAvailable: top.amount || 0
      });
    }
    return out;
  }
  // AH-kant: gebaseerd op de laagste BIN uit de laatste volledige scan (lastGlobalBins) —
  // wordt dus alleen bijgewerkt als er ook echt gescand is.
  function computeNpcAhOpportunities(globalBins){
    const out = [];
    for (const id in npcPrices){
      const g = globalBins && globalBins[id];
      if (!g || !g.min1) continue;
      const npcPrice = npcPrices[id];
      if (g.min1.price >= npcPrice) continue;
      const display = getItemDisplay(id);
      const profitPerUnit = npcPrice - g.min1.price;
      out.push({
        id, name: display.name, icon: display.icon, source: 'auction',
        buyPrice: g.min1.price, npcPrice, profitPerUnit,
        marginPct: (profitPerUnit / g.min1.price) * 100,
        remaining: g.min1.remaining
      });
    }
    return out;
  }
  function renderNpcScannerTab(){
    const el = $('#npcScanTableWrap');
    if (!el) return;
    const rows = [...computeNpcBazaarOpportunities(), ...computeNpcAhOpportunities(lastGlobalBins)];
    rows.sort((a,b) => b.profitPerUnit - a.profitPerUnit);
    if (rows.length === 0){
      el.innerHTML = `<div class="empty-state">Geen NPC-verkoopkansen gevonden. Voeg eventueel meer NPC-prijzen toe onder Instellingen (Uitleg-tabblad) als je een item mist, of scan de Auction House voor het AH-gedeelte.</div>`;
      return;
    }
    const html = rows.map(r => {
      const sourceBadge = r.source === 'bazaar'
        ? `<span class="ah-flip-badge arb">Bazaar</span>`
        : `<span class="ah-flip-badge relist">AH${r.remaining!==undefined?` · ${fmtDuration(r.remaining)}`:''}</span>`;
      const extra = r.source === 'bazaar' ? `${fmtInt(r.qtyAvailable)} beschikbaar` : '';
      return `<tr>
        <td class="left"><span class="item-name">${escapeHTML(r.name)}</span><span class="item-id">${escapeHTML(r.id)}</span></td>
        <td>${sourceBadge}</td>
        <td>${fmtCoins(r.buyPrice)}</td>
        <td>${fmtCoins(r.npcPrice)}</td>
        <td class="${profitClass(r.profitPerUnit)}">${fmtCoins(r.profitPerUnit)} (${r.marginPct.toFixed(0)}%)</td>
        <td>${extra}</td>
      </tr>`;
    }).join('');
    el.innerHTML = `<div class="table-wrap"><table><thead><tr>
        <th class="left">Item</th><th>Bron</th><th>Koopprijs</th><th>NPC-prijs</th><th>Winst/stuk</th><th></th>
      </tr></thead><tbody>${html}</tbody></table></div>
      <p class="trade-note" style="margin-top:10px;">Bazaar-koopprijs = instant-koopprijs nu; AH-koopprijs = laagste BIN uit de laatste scan. Geen flipper tax van toepassing (je verkoopt aan een NPC, niet op de bazaar).</p>`;
  }

  function renderNpcList(){
    saveNpcPrices();
    const el = $('#npcList');
    const ids = Object.keys(npcPrices);
    if (ids.length === 0){
      el.innerHTML = '';
      return;
    }
    el.innerHTML = ids.map(id => {
      const display = itemMeta[id] ? itemMeta[id].name : id;
      return `<div class="chip">${escapeHTML(display)} — ${fmtCoins(npcPrices[id])}<button class="chip-del" data-npc-id="${escapeHTML(id)}" title="Verwijder">✕</button></div>`;
    }).join('');
    el.querySelectorAll('.chip-del').forEach(btn => {
      btn.addEventListener('click', () => {
        delete npcPrices[btn.dataset.npcId];
        renderNpcList();
        renderBazaarTab();
        renderNpcScannerTab();
      });
    });
  }
