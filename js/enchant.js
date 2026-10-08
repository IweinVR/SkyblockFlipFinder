  // ====================================================================
  // enchant.js — "Item Maxen" tab: the enchant/gemstone/reforge-stone cost
  // configurator. Data below is compiled from the Hypixel Skyblock wiki
  // (Enchantments + Ultimate Enchantments pages) — not an official Hypixel
  // source, so it can go stale or miss rare/new enchants. "group" = conflict
  // group: enchants sharing a group value exclude each other (max 1 active),
  // the first entry in the list is the suggested default.
  // Depends on core.js (bazaarData, fmtCoins, escapeHTML, $, ...).
  // ====================================================================
  const ENCHANT_DB = {
    sword: [
      { name:'Sharpness', max:7, group:'dmg' },
      { name:'Smite', max:7, group:'dmg' },
      { name:'Bane of Arthropods', max:6, group:'dmg' },
      { name:'Critical', max:7 },
      { name:'First Strike', max:5, group:'strike' },
      { name:'Triple-Strike', max:5, group:'strike' },
      { name:'Execute', max:6, group:'exec' },
      { name:'Prosecute', max:6, group:'exec' },
      { name:'Giant Killer', max:7, group:'killer' },
      { name:'Titan Killer', max:7, group:'killer' },
      { name:'Life Steal', max:5, group:'lifesteal' },
      { name:'Drain', max:5, group:'lifesteal' },
      { name:'Mana Steal', max:3, group:'lifesteal' },
      { name:'Thunderlord', max:7, group:'thunder' },
      { name:'Thunderbolt', max:6, group:'thunder' },
      { name:'Cleave', max:6 },
      { name:'Cubism', max:6 },
      { name:'Ender Slayer', max:7 },
      { name:'Experience', max:5 },
      { name:'Knockback', max:2 },
      { name:'Looting', max:5 },
      { name:'Scavenger', max:6 },
      { name:'Snipe', max:4 },
      { name:'Sunder', max:6 },
      { name:'Tabasco', max:3 },
      { name:'Vampirism', max:6 },
      { name:'Venomous', max:6 },
      { name:'Vicious', max:5 },
    ],
    bow: [
      { name:'Power', max:7 },
      { name:'Compact', max:10, group:'compact' },
      { name:'Prismatic', max:5, group:'compact', aliases:['PRISTINE'] },
      { name:'Chance', max:5 },
      { name:'Dragon Tracer', max:5 },
      { name:'Flame', max:2 },
      { name:'Infinite Quiver', max:10 },
      { name:'Knockback', max:2 },
      { name:'Looting', max:5 },
      { name:'Prosecute', max:6 },
      { name:'Snipe', max:4 },
      { name:'Tabasco', max:2 },
      { name:'Toxophilite', max:1 },
    ],
    helmet: [
      { name:'Growth', max:7 },
      { name:'Respiration', max:4 },
      { name:'Big Brain', max:5, group:'brain' },
      { name:'Small Brain', max:5, group:'brain' },
      { name:'Aqua Affinity', max:1 },
      { name:'Champion', max:10 },
      { name:'Dedication', max:10 },
    ],
    chestplate: [
      { name:'Growth', max:7 },
      { name:'Rejuvenate', max:5, group:'rejuv' },
      { name:'Respite', max:5, group:'rejuv' },
      { name:'Thorns', max:3, group:'thorns' },
      { name:'Blessing', max:5 },
      { name:'Champion', max:10 },
      { name:'Cultivation', max:10 },
      { name:'Dedication', max:10 },
    ],
    leggings: [
      { name:'Growth', max:7 },
      { name:'Smarty Pants', max:5 },
      { name:'Champion', max:10 },
      { name:'Dedication', max:10 },
    ],
    boots: [
      { name:'Growth', max:7 },
      { name:'Depth Strider', max:3 },
      { name:'Feather Falling', max:10 },
      { name:'Sugar Rush', max:3 },
      { name:'Turbo-Crop', max:6, manual:true, note:'Naam varieert per gewas (bv. Turbo-Wheat) — niet automatisch te prijzen.' },
      { name:'Champion', max:10 },
      { name:'Cultivation', max:10 },
      { name:'Dedication', max:10 },
    ],
    pickaxe: [
      { name:'Efficiency', max:10 },
      { name:'Fortune', max:4, group:'harvest' },
      { name:'Silk Touch', max:1, group:'harvest' },
      { name:'Smelting Touch', max:1, group:'harvest' },
      { name:'Compact', max:10, group:'compact' },
      { name:'Prismatic', max:5, group:'compact', aliases:['PRISTINE'] },
      { name:'Experience', max:5 },
    ],
    axe: [
      { name:'Efficiency', max:10 },
      { name:'Fortune', max:4, group:'harvest' },
      { name:'Silk Touch', max:1, group:'harvest' },
      { name:'Smelting Touch', max:1, group:'harvest' },
      { name:'Compact', max:10, group:'compact' },
      { name:'Prismatic', max:5, group:'compact', aliases:['PRISTINE'] },
      { name:'Cultivating', max:10 },
      { name:'Green Thumb', max:6 },
      { name:'Lumberjack', max:5 },
      { name:'Replenish', max:1 },
      { name:'Tabasco', max:6 },
      { name:'Turbo-Crop', max:6, manual:true, note:'Naam varieert per gewas (bv. Turbo-Wheat) — niet automatisch te prijzen.' },
      { name:'Experience', max:5 },
    ],
    hoe: [
      { name:'Efficiency', max:10 },
      { name:'Fortune', max:4 },
      { name:'Harvesting', max:6 },
      { name:'Cultivating', max:10 },
      { name:'Delicate', max:5 },
      { name:'Replenish', max:1 },
      { name:'Turbo-Crop', max:5, manual:true, note:'Naam varieert per gewas (bv. Turbo-Wheat) — niet automatisch te prijzen.' },
      { name:'Experience', max:5 },
    ],
    fishing_rod: [
      { name:'Power', max:7 },
      { name:'Luck of the Sea', max:6 },
      { name:'Lure', max:6 },
      { name:'Angler', max:6 },
      { name:'Blessing', max:6 },
      { name:'Corruption', max:5 },
      { name:'Drain', max:5 },
      { name:'Expertise', max:10 },
      { name:'Looting', max:5 },
      { name:'Piscary', max:6 },
      { name:'Spiked Hook', max:7 },
      { name:'Tabasco', max:2 },
      { name:'Thunderbolt', max:6 },
      { name:'Experience', max:6 },
    ],
  };
  // "Alle harnas-onderdelen" enchants — worden aan elk van de 4 armor-lijsten toegevoegd.
  const ARMOR_COMMON = [
    { name:'Protection', max:7, group:'prot' },
    { name:'Blast Protection', max:7, group:'prot' },
    { name:'Fire Protection', max:7, group:'prot' },
    { name:'Projectile Protection', max:7, group:'prot' },
    { name:'True Protection', max:7 },
    { name:'Hardened Mana', max:10, group:'mana' },
    { name:'Strong Mana', max:10, group:'mana' },
    { name:'Ferocious Mana', max:10, group:'mana' },
    { name:'Mana Vampire', max:10, group:'mana' },
    { name:'Thorns', max:3, group:'thorns2' },
    { name:'Reflection', max:3, group:'thorns2' },
    { name:'Health', max:7 },
    { name:'Charm', max:5 },
    { name:'Corruption', max:5 },
    { name:'Forest Pledge', max:5 },
  ];
  const ULTIMATE_DB = [
    { name:'One For All', max:1, cats:['sword','bow'] },
    { name:'Ultimate Wise', max:5, cats:['sword','bow'] },
    { name:'Chimera', max:5, cats:['sword','bow'] },
    { name:'Combo', max:5, cats:['sword','bow'] },
    { name:'Fatal Tempo', max:5, cats:['sword','bow'] },
    { name:'Inferno', max:5, cats:['sword','bow'] },
    { name:'Soul Eater', max:5, cats:['sword','bow'] },
    { name:'Swarm', max:5, cats:['sword','bow'] },
    { name:'Rend', max:5, cats:['bow'] },
    { name:'Duplex', max:5, cats:['bow'] },
    { name:'Bank', max:5, cats:['helmet','chestplate','leggings','boots'] },
    { name:"Bobbin' Time", max:5, cats:['helmet','chestplate','leggings','boots'] },
    { name:'Habanero Tactics', max:5, cats:['helmet','chestplate','leggings','boots'] },
    { name:'Last Stand', max:5, cats:['helmet','chestplate','leggings','boots'] },
    { name:'Legion', max:5, cats:['helmet','chestplate','leggings','boots'] },
    { name:'No Pain No Gain', max:5, cats:['helmet','chestplate','leggings','boots'] },
    { name:'Refrigerate', max:5, cats:['helmet','chestplate','leggings','boots'] },
    { name:'Wisdom', max:5, cats:['helmet','chestplate','leggings','boots'] },
    { name:'Crop Fever', max:5, cats:['hoe','axe'] },
    { name:'First Impression', max:5, cats:['axe'] },
    { name:'Missile', max:5, cats:['axe'] },
    { name:'Flowstate', max:3, cats:['pickaxe'] },
    { name:'Flash', max:5, cats:['fishing_rod'] },
  ];

  const ENCHANT_TYPE_LABELS = {
    sword:'Sword', bow:'Bow', helmet:'Helmet', chestplate:'Chestplate',
    leggings:'Leggings', boots:'Boots', pickaxe:'Pickaxe', axe:'Axe',
    hoe:'Hoe', fishing_rod:'Fishing Rod',
  };

  // Korte, vereenvoudigde omschrijvingen per enchant — bedoeld als geheugensteun, geen
  // letterlijke in-game tooltip-tekst. Percentages/getallen kunnen per level en per
  // Hypixel-update afwijken; check bij twijfel zelf de enchant-tafel in-game.
  const ENCHANT_DESC = {
    'Sharpness':'Verhoogt melee-schade tegen alle mobs.',
    'Smite':'Verhoogt melee-schade tegen undead mobs (zombies, skeletons, wither-mobs...).',
    'Bane of Arthropods':'Verhoogt melee-schade tegen arthropods (spiders, endermites, silverfish...).',
    'Critical':'Verhoogt je crit-damage.',
    'First Strike':'Bonusschade op de eerste hit tegen een mob.',
    'Triple-Strike':'Elke 3e hit doet flink meer schade.',
    'Execute':'Meer schade tegen mobs met minder health.',
    'Prosecute':'Bonusschade tegen mobs binnen een grote AoE.',
    'Giant Killer':'Meer schade tegen mobs met veel meer HP dan jij.',
    'Titan Killer':'Meer schade tegen mobs met veel meer defense dan jij.',
    'Life Steal':'Kans om health te stelen bij een hit.',
    'Drain':'Geneest je bij het doden van een mob.',
    'Mana Steal':'Kans om mana te stelen bij een hit.',
    'Thunderlord':'Bouwt lading op die na genoeg hits bliksem-AoE-schade doet.',
    'Thunderbolt':'Kans om bliksem te laten inslaan bij een hit.',
    'Cleave':'Damaget alle mobs rondom je doelwit.',
    'Cubism':'Extra schade tegen "kubus-vormige" mobs (o.a. slimes, magma cubes).',
    'Ender Slayer':'Meer schade tegen endermen en enderman-achtige mobs.',
    'Experience':'Meer XP van gedode mobs.',
    'Knockback':'Stoot mobs verder weg bij een hit.',
    'Looting':'Meer/betere drops van gedode mobs.',
    'Scavenger':'Meer coins van gedode mobs.',
    'Snipe':'Bonusschade als je een tijdje niet gehit bent.',
    'Sunder':'Verzwakt de defense van je doelwit tijdelijk.',
    'Tabasco':'Kans op extra vuurschade/effect bij een hit.',
    'Vampirism':'Sterkere lifesteal-variant.',
    'Venomous':'Kans om je doelwit te vergiftigen (damage over time).',
    'Vicious':'Kans op een extra, harde bonus-hit.',
    'Power':'Verhoogt boog-schade.',
    'Compact':'Verzamelt automatisch pijlen op korte afstand.',
    'Prismatic':'Combineert Compact-achtige verzamel-bonus met extra effecten (vervangt "Pristine").',
    'Chance':'Kans op een bonus-effect per schot.',
    'Dragon Tracer':'Pijlen keren na een tijdje terug naar je.',
    'Flame':'Zet doelwitten in brand.',
    'Infinite Quiver':'Kans om geen pijl te verbruiken per schot.',
    'Toxophilite':'Kleine algemene boog-stat-boost.',
    'Growth':'Verhoogt max health.',
    'Respiration':'Langer onder water kunnen ademen/zien.',
    'Big Brain':'Verhoogt Intelligence.',
    'Small Brain':'Verlaagt Intelligence maar geeft een andere bonus terug (bewust "negatieve" enchant).',
    'Aqua Affinity':'Normale mijnsnelheid onder water.',
    'Champion':'Bonus op basis van je Slayer-levels.',
    'Dedication':'Bonus die groeit met je collection-voortgang.',
    'Rejuvenate':'Verhoogt genezing (healing) via potions/staffs e.d.',
    'Respite':'Tijdelijke schild/regen-bonus na het nemen van schade.',
    'Thorns':'Kans om schade terug te kaatsen naar de aanvaller.',
    'Blessing':'Kans op extra coins/XP bonus.',
    'Cultivation':'Bonus gekoppeld aan Farming-collections.',
    'Smarty Pants':'Verhoogt Intelligence.',
    'Depth Strider':'Sneller bewegen in water.',
    'Feather Falling':'Minder val-schade.',
    'Sugar Rush':'Tijdelijke speed-boost bij het nemen van schade.',
    'Turbo-Crop':'Verhoogt farming fortune voor een specifiek gewas (naam varieert, bv. Turbo-Wheat).',
    'Efficiency':'Verhoogt mijnsnelheid.',
    'Fortune':'Meer drops per gemined blok (mining fortune).',
    'Silk Touch':'Blokken droppen zichzelf i.p.v. hun normale drop.',
    'Smelting Touch':'Blokken droppen automatisch hun gesmolten (gesmolten oven) versie.',
    'Cultivating':'Bonus gekoppeld aan Farming/Foraging-collections.',
    'Green Thumb':'Kans op een extra Enchanted-versie van het gehakte hout.',
    'Lumberjack':'Meer XP/drops bij het hakken van bomen.',
    'Replenish':'Plant automatisch een nieuw gewas na oogsten.',
    'Harvesting':'Verhoogt farming fortune.',
    'Delicate':'Iets betere kwaliteit/kans bij het oogsten.',
    'Luck of the Sea':'Betere vis-kwaliteit/treasure-kans.',
    'Lure':'Sneller beet bij het vissen.',
    'Angler':'Meer vis-drops in het algemeen.',
    'Corruption':'Meer kans op "gecorrumpeerde" (moeilijkere maar waardevollere) vangsten.',
    'Expertise':'Bonus XP/coins gekoppeld aan fishing.',
    'Piscary':'Bonus mana/health regen tijdens het vissen.',
    'Spiked Hook':'Bonusschade tegen sea creatures.',
    'Protection':'Vermindert algemene schade.',
    'Blast Protection':'Vermindert explosie-schade.',
    'Fire Protection':'Vermindert vuur-schade.',
    'Projectile Protection':'Vermindert schade van projectielen.',
    'True Protection':'Sterke algemene defense-bonus tegen bosses (zeldzaam/duur).',
    'Hardened Mana':'Verhoogt max mana.',
    'Strong Mana':'Sterkere versie van Hardened Mana.',
    'Ferocious Mana':'Sterkste variant, meer max mana.',
    'Mana Vampire':'Steelt mana van mobs bij een hit i.p.v. pure max-mana-bonus.',
    'Reflection':'Kaatst een deel van binnenkomende schade terug.',
    'Health':'Verhoogt max health.',
    'Charm':'Extra effect bij het gebruik van potions.',
    'Forest Pledge':'Bonus gekoppeld aan Foraging.',
    'One For All':'Verwijdert alle andere enchants maar geeft enorme bonusschade (alles-of-niets keuze).',
    'Ultimate Wise':'Verlaagt de mana-kosten van itemabilities fors.',
    'Chimera':'Kopieert een deel van de stats van je actieve pet.',
    'Combo':'Bouwt een combo-teller op die je schade verhoogt bij opeenvolgende hits.',
    'Fatal Tempo':'Verhoogt ferocity bij opeenvolgende hits.',
    'Inferno':'Elke 10e hit "brandmerkt" de mob voor schade over tijd.',
    'Soul Eater':'Krijgt tijdelijk kracht op basis van de schade van je vorige gedode mob.',
    'Swarm':'Meer schade naarmate er meer vijanden dichtbij zijn.',
    'Rend':'Left-click ability die pijlen laat exploderen voor bonusschade.',
    'Duplex':'Schiet een tweede pijl met vuureffect mee.',
    'Bank':'Bespaart een deel van je coins bij overlijden; mobs droppen coins.',
    "Bobbin' Time":'Boost fishing-stats en magic find op basis van nabije bobbers.',
    'Habanero Tactics':'Boost genezing/slayer-schade/combat wisdom.',
    'Last Stand':'Meer defense zodra je health onder ~40% zakt.',
    'Legion':'Bonus stats op basis van nabije spelers.',
    'No Pain No Gain':'Kans op XP-orbs bij het raken van mobs.',
    'Refrigerate':'Zet ongebruikte mana tijdelijk om in extra defense.',
    'Wisdom':'Bonus Intelligence op basis van je skill-XP-levels.',
    'Crop Fever':'Kans op bonusgewassen en zeldzame drops bij oogsten/hakken.',
    'First Impression':'Bonus sweep-schade op de eerste hit met een bijl.',
    'Missile':'Vermindert de sweep-penalty bij het gooien van bijlen.',
    'Flowstate':'Mijnsnelheid stijgt naarmate je meer blokken achter elkaar mined.',
    'Flash':'Kans om direct een vis aan te trekken.',
  };

  // ---------- Gemstones & Reforge Stones ----------
  // Bron: Hypixel Skyblock wiki. Gemstones zijn bazaar-verhandelbaar (patroon
  // <TIER>_<TYPE>_GEM); reforge stones zijn meestal drops/dungeon-loot/NPC-aankopen —
  // niet allemaal via de bazaar te koop, dat wordt hieronder eerlijk aangegeven.
  const GEM_TYPES = ['Ruby','Amber','Sapphire','Jade','Amethyst','Topaz','Jasper','Opal','Onyx','Aquamarine','Citrine','Peridot'];
  const GEM_TIERS = ['Rough','Flawed','Fine','Flawless','Perfect'];
  // Reforge stones: prijs is een vast NPC-bedrag waar bekend, anders null (niet via bazaar/NPC te koop).
  const REFORGE_STONES = [
    { name:'Black Diamond', reforge:'Fruitful', applies:'Pickaxe/Drill', npcPrice:100, source:'NPC (Mining Merchant, Hub)' },
    { name:'Andesite Whetstone', reforge:'Refined', applies:'Pickaxe/Drill', npcPrice:1000000, source:'NPC (Smithmonger)' },
    { name:'Moil Log', reforge:'Moil', applies:'Axe', npcPrice:50000, source:'NPC (Smithmonger)' },
    { name:'Toil Log', reforge:'Toil', applies:'Axe', npcPrice:1000000, source:'NPC (Smithmonger)' },
    { name:'Blessed Fruit', reforge:'Blessed', applies:'Farming tool', npcPrice:1000000, source:'NPC (Smithmonger)' },
    { name:"Golden Ball", reforge:'Bountiful', applies:'Farming tool', npcPrice:1000000, source:'NPC (Jake, na Loch Emperor)' },
    { name:'Large Walnut', reforge:'Earthy', applies:'Farming tool', npcPrice:150, source:'NPC (SkyMart, 150 Copper)' },
    { name:'Dirt Bottle', reforge:'Dirty', applies:'Melee weapon', npcPrice:100000, source:'NPC (Smithmonger)' },
    { name:'SkyMart Brochure', reforge:'Bustling', applies:'Armor', npcPrice:100, source:'NPC (SkyMart, 100 Copper)' },
    { name:"Boo Stone", reforge:'Greater Spook', applies:'Spooky armor', npcPrice:10000, source:'NPC (Tyashoi Alchemist, seizoensgebonden)' },
    { name:'Necromancer\'s Brooch', reforge:'Necrotic', applies:'Armor', npcPrice:null, source:'Dungeon-drop (Catacombs I-IV)' },
    { name:'Dragon Horn', reforge:'Renowned', applies:'Armor', npcPrice:null, source:'Drop (Superior Dragon)' },
    { name:'Rare Diamond', reforge:'Reinforced', applies:'Armor', npcPrice:null, source:'Mining-drop (Diamond Ore/Block)' },
    { name:'Dragon Claw', reforge:'Fabled', applies:'Melee weapon', npcPrice:null, source:'Drop (Ender Dragon)' },
    { name:'Spirit Stone', reforge:'Spiritual', applies:'Bow', npcPrice:null, source:'Dungeon-drop (Catacombs F4)' },
    { name:'Optical Lens', reforge:'Precise', applies:'Bow', npcPrice:null, source:'Drop (The Watcher)' },
    { name:'Giant Tooth', reforge:'Giant', applies:'Armor', npcPrice:null, source:'Dungeon-drop (Catacombs F6)' },
  ];
  let gemList = [];      // [{type, tier, id, price}]
  let reforgeList = [];  // [{name, price, source}]

  function gemBazaarId(tier, type){ return `${tier.toUpperCase()}_${type.toUpperCase()}_GEM`; }
  function gemBazaarPrice(tier, type){
    if (!bazaarData) return null;
    const id = gemBazaarId(tier, type);
    const p = bazaarData[id];
    if (p && p.sell_summary && p.sell_summary.length && p.sell_summary[0].pricePerUnit) return { price: p.sell_summary[0].pricePerUnit, id };
    return null;
  }
  function renderGemReforgeSection(){
    let gemOptions = '';
    GEM_TIERS.forEach(tier => GEM_TYPES.forEach(type => {
      gemOptions += `<option value="${tier}|${type}">${tier} ${type}</option>`;
    }));
    let gemHtml = `<div class="enchant-group"><div class="enchant-group-title">Gemstones toevoegen</div>
      <div class="npc-add-row"><select id="gemPickSelect">${gemOptions}</select><button id="gemAddBtn">+ Toevoegen</button></div>`;
    gemList.forEach((g, i) => {
      const priceInfo = gemBazaarPrice(g.tier, g.type);
      gemHtml += `<div class="enchant-opt"><label style="flex:1;"><span class="e-name">${escapeHTML(g.tier)} ${escapeHTML(g.type)} Gemstone</span>
        ${priceInfo ? `<span class="e-price">${fmtCoins(priceInfo.price)}</span>` : `<span class="e-price na">niet gevonden</span>`}</label>
        <button data-gem-del="${i}" class="chip-del" title="Verwijder">✕</button></div>`;
    });
    gemHtml += `</div>`;

    let reforgeOptions = REFORGE_STONES.map((r,i) => `<option value="${i}">${r.name} (${r.reforge} — ${r.applies})</option>`).join('');
    let reforgeHtml = `<div class="enchant-group"><div class="enchant-group-title">Reforge stones toevoegen</div>
      <div class="npc-add-row"><select id="reforgePickSelect">${reforgeOptions}</select><button id="reforgeAddBtn">+ Toevoegen</button></div>`;
    reforgeList.forEach((r, i) => {
      reforgeHtml += `<div class="enchant-opt"><label style="flex:1;"><span class="e-name">${escapeHTML(r.name)}<span class="e-lvl">${escapeHTML(r.reforge)}</span></span>
        ${r.npcPrice != null ? `<span class="e-price">${fmtCoins(r.npcPrice)}</span>` : `<span class="e-price na" title="${escapeHTML(r.source)}">niet kopen</span>`}</label>
        <button data-reforge-del="${i}" class="chip-del" title="Verwijder">✕</button></div>`;
    });
    reforgeHtml += `<div class="hint" style="margin-top:6px;">Reforge stones zonder prijs zijn drops/dungeon-loot en niet gewoon te kopen — vermeld als referentie (bron in tooltip).</div></div>`;

    return { gemHtml, reforgeHtml };
  }

  let enchantSelectedType = 'sword';
  let enchantChoices = {};   // per type: { [groupKey]: chosenName }
  let enchantChecked = {};   // per type: { [enchantName]: bool } for ungrouped ones
  let enchantUltimate = {};  // per type: chosen ultimate name or '' (none)
  let enchantLevel = {};     // per type: { [enchantName]: targetLevel }
  let enchantCurrent = {};   // per type: { [enchantName]: currentLevel (0 = geen) }

  function enchantSlug(name){
    return name.toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  }
  // Probeert de live bazaar-instant-koopprijs van een enchanted book te vinden door de
  // itemnaam te "raden" naar het bazaar-product-ID-patroon (ENCHANTMENT_<NAAM>_<LEVEL>,
  // of ENCHANTMENT_ULTIMATE_<NAAM>_<LEVEL> voor ultimates). Niet hardcoded — wordt altijd
  // live geverifieerd tegen de daadwerkelijk geladen bazaarData, dus nooit een stale ID.
  function guessBookPrice(ench, isUltimate, level){
    if (!bazaarData) return null;
    if (ench.manual) return null;
    const lvl = level || ench.max;
    const baseSlug = enchantSlug(ench.name);
    const candidateSlugs = [baseSlug].concat(ench.aliases || []);
    const idsToTry = [];
    candidateSlugs.forEach(slug => {
      if (isUltimate){
        idsToTry.push(slug.startsWith('ULTIMATE_') ? `ENCHANTMENT_${slug}_${lvl}` : `ENCHANTMENT_ULTIMATE_${slug}_${lvl}`);
      }
      idsToTry.push(`ENCHANTMENT_${slug}_${lvl}`);
    });
    for (const id of idsToTry){
      if (bazaarData[id] && bazaarData[id].sell_summary && bazaarData[id].sell_summary.length){
        const p = bazaarData[id].sell_summary[0].pricePerUnit;
        if (p) return { price: p, id };
      }
    }
    return null;
  }

  function levelOptionsHtml(max, selected){
    let html = '';
    for (let i = 1; i <= max; i++){
      html += `<option value="${i}" ${i === selected ? 'selected' : ''}>${romanNumeral(i)}</option>`;
    }
    return html;
  }
  function currentOptionsHtml(max, selected){
    let html = `<option value="0" ${!selected ? 'selected' : ''}>—</option>`;
    for (let i = 1; i <= max; i++){
      html += `<option value="${i}" ${i === selected ? 'selected' : ''}>${romanNumeral(i)}</option>`;
    }
    return html;
  }
  function descIconHtml(name){
    const d = ENCHANT_DESC[name];
    return d ? `<span class="e-desc-icon" title="${escapeHTML(d)}">ⓘ</span>` : '';
  }

  function renderEnchantOptimizer(){
    const typeSel = $('#enchantItemType');
    if (typeSel && !typeSel.options.length){
      typeSel.innerHTML = Object.keys(ENCHANT_TYPE_LABELS).map(k =>
        `<option value="${k}">${ENCHANT_TYPE_LABELS[k]}</option>`).join('');
      typeSel.value = enchantSelectedType;
      typeSel.addEventListener('change', () => { enchantSelectedType = typeSel.value; renderEnchantOptimizer(); });
    }
    const type = enchantSelectedType;
    const list = ENCHANT_DB[type] || [];
    if (!enchantChoices[type]) enchantChoices[type] = {};
    if (!enchantChecked[type]) enchantChecked[type] = {};
    if (!enchantLevel[type]) enchantLevel[type] = {};
    if (!enchantCurrent[type]) enchantCurrent[type] = {};
    if (enchantUltimate[type] === undefined) enchantUltimate[type] = '';

    // groepeer op conflictgroep
    const groups = {}; // groupKey -> [enchant,...]
    const solo = [];
    list.forEach(e => {
      if (e.group){
        if (!groups[e.group]) groups[e.group] = [];
        groups[e.group].push(e);
      } else solo.push(e);
    });
    // default keuzes instellen indien nog niet gezet
    Object.keys(groups).forEach(g => {
      if (!enchantChoices[type][g]) enchantChoices[type][g] = groups[g][0].name;
    });
    list.forEach(e => {
      if (!e.group && enchantChecked[type][e.name] === undefined) enchantChecked[type][e.name] = true;
      if (!enchantLevel[type][e.name]) enchantLevel[type][e.name] = e.max;
    });

    let totalCost = 0;
    const lines = []; // {name, price}
    const upgradeCandidates = []; // {name, price, currentLvl, targetLvl}
    let missingCount = 0;

    // ench = data, name = actual chosen name (voor groepen kan dit afwijken van ench.name niet nodig, groep-items zijn zelf de ench)
    function evalEnchant(ench, isUltimate){
      const target = enchantLevel[type][ench.name] || ench.max;
      const current = enchantCurrent[type][ench.name] || 0;
      const info = guessBookPrice(ench, isUltimate, target);
      const alreadyDone = current >= target && target > 0;
      if (ench.manual){
        return { priceHtml:`<span class="e-price na" title="${escapeHTML(ench.note||'')}">handmatig</span>`, alreadyDone };
      }
      if (!info){
        missingCount++;
        return { priceHtml:`<span class="e-price na">niet gevonden</span>`, alreadyDone };
      }
      if (alreadyDone){
        return { priceHtml:`<span class="e-price" style="color:var(--green);">al ${romanNumeral(current)}</span>`, alreadyDone, price:info.price };
      }
      totalCost += info.price;
      lines.push({ name: ench.name, price: info.price, target });
      upgradeCandidates.push({ name: ench.name, price: info.price, current, target });
      return { priceHtml:`<span class="e-price">${fmtCoins(info.price)}</span>`, alreadyDone, price:info.price };
    }

    function levelSelectsHtml(ench){
      const target = enchantLevel[type][ench.name] || ench.max;
      const current = enchantCurrent[type][ench.name] || 0;
      if (ench.max <= 1) return '';
      return `<select class="e-target-lvl" data-ench="${escapeHTML(ench.name)}" title="Gewenst level">${levelOptionsHtml(ench.max, target)}</select>
        <select class="e-current-lvl" data-ench="${escapeHTML(ench.name)}" title="Wat heb je nu?">${currentOptionsHtml(ench.max, current)}</select>`;
    }

    let groupsHtml = '';
    Object.keys(groups).sort().forEach(g => {
      const opts = groups[g];
      groupsHtml += `<div class="enchant-group"><div class="enchant-group-title">Kies er 1</div>`;
      opts.forEach(e => {
        const checked = enchantChoices[type][g] === e.name ? 'checked' : '';
        const result = checked ? evalEnchant(e, false) : { priceHtml: (() => { const info = guessBookPrice(e, false, enchantLevel[type][e.name] || e.max); return info ? `<span class="e-price">${fmtCoins(info.price)}</span>` : `<span class="e-price na">niet gevonden</span>`; })() };
        groupsHtml += `<div class="enchant-opt"><input type="radio" name="egroup_${escapeHTML(g)}" value="${escapeHTML(e.name)}" ${checked}>
          <label><span class="e-name">${escapeHTML(e.name)}${descIconHtml(e.name)}</span></label>
          ${checked ? levelSelectsHtml(e) : `<span class="e-lvl">${romanNumeral(e.max)} max</span>`}
          ${result.priceHtml}</div>`;
      });
      groupsHtml += `</div>`;
    });
    if (solo.length){
      groupsHtml += `<div class="enchant-group"><div class="enchant-group-title">Geen conflict — automatisch meegeteld (uitvinkbaar)</div>`;
      solo.forEach(e => {
        const checked = enchantChecked[type][e.name] ? 'checked' : '';
        const result = checked ? evalEnchant(e, false) : { priceHtml: (() => { const info = guessBookPrice(e, false, enchantLevel[type][e.name] || e.max); return info ? `<span class="e-price">${fmtCoins(info.price)}</span>` : `<span class="e-price na">niet gevonden</span>`; })() };
        groupsHtml += `<div class="enchant-opt"><input type="checkbox" data-solo="${escapeHTML(e.name)}" ${checked}>
          <label><span class="e-name">${escapeHTML(e.name)}${descIconHtml(e.name)}</span></label>
          ${checked ? levelSelectsHtml(e) : `<span class="e-lvl">${romanNumeral(e.max)} max</span>`}
          ${result.priceHtml}</div>`;
      });
      groupsHtml += `</div>`;
    }
    // Ultimate-enchant selector
    const applicableUltimates = ULTIMATE_DB.filter(u => u.cats.includes(type));
    if (applicableUltimates.length){
      groupsHtml += `<div class="enchant-group"><div class="enchant-group-title">Ultimate-enchant (max 1, optioneel)</div>`;
      const noneChecked = !enchantUltimate[type] ? 'checked' : '';
      groupsHtml += `<div class="enchant-opt"><input type="radio" name="eultimate" value="" ${noneChecked}><label><span class="e-name ultimate-none">Geen</span></label></div>`;
      applicableUltimates.forEach(u => {
        const checked = enchantUltimate[type] === u.name ? 'checked' : '';
        const result = checked ? evalEnchant(u, true) : { priceHtml: (() => { const info = guessBookPrice(u, true, enchantLevel[type][u.name] || u.max); return info ? `<span class="e-price">${fmtCoins(info.price)}</span>` : `<span class="e-price na">niet gevonden</span>`; })() };
        groupsHtml += `<div class="enchant-opt"><input type="radio" name="eultimate" value="${escapeHTML(u.name)}" ${checked}>
          <label><span class="e-name">${escapeHTML(u.name)}${descIconHtml(u.name)}</span></label>
          ${checked ? levelSelectsHtml(u) : `<span class="e-lvl">${romanNumeral(u.max)} max</span>`}
          ${result.priceHtml}</div>`;
      });
      groupsHtml += `</div>`;
    }

    // gemstones & reforge stones
    const { gemHtml, reforgeHtml } = renderGemReforgeSection();
    let gemReforgeTotal = 0;
    gemList.forEach(g => { const p = gemBazaarPrice(g.tier, g.type); if (p) gemReforgeTotal += p.price; });
    reforgeList.forEach(r => { if (r.npcPrice != null) gemReforgeTotal += r.npcPrice; });
    totalCost += gemReforgeTotal;
    groupsHtml += gemHtml + reforgeHtml;

    const groupsEl = $('#enchantGroups');
    groupsEl.innerHTML = groupsHtml;
    groupsEl.querySelectorAll('input[type="radio"][name^="egroup_"]').forEach(inp => {
      inp.addEventListener('change', () => {
        const g = inp.name.replace(/^egroup_/, '');
        enchantChoices[type][g] = inp.value;
        renderEnchantOptimizer();
      });
    });
    groupsEl.querySelectorAll('input[type="checkbox"][data-solo]').forEach(inp => {
      inp.addEventListener('change', () => {
        enchantChecked[type][inp.dataset.solo] = inp.checked;
        renderEnchantOptimizer();
      });
    });
    groupsEl.querySelectorAll('input[type="radio"][name="eultimate"]').forEach(inp => {
      inp.addEventListener('change', () => {
        enchantUltimate[type] = inp.value;
        renderEnchantOptimizer();
      });
    });
    groupsEl.querySelectorAll('.e-target-lvl').forEach(sel => {
      sel.addEventListener('change', () => { enchantLevel[type][sel.dataset.ench] = Number(sel.value); renderEnchantOptimizer(); });
    });
    groupsEl.querySelectorAll('.e-current-lvl').forEach(sel => {
      sel.addEventListener('change', () => { enchantCurrent[type][sel.dataset.ench] = Number(sel.value); renderEnchantOptimizer(); });
    });
    const gemSelectEl = $('#gemPickSelect');
    const gemAddBtn = $('#gemAddBtn');
    if (gemAddBtn) gemAddBtn.addEventListener('click', () => {
      const [tier, gtype] = gemSelectEl.value.split('|');
      gemList.push({ tier, type: gtype });
      renderEnchantOptimizer();
    });
    groupsEl.querySelectorAll('[data-gem-del]').forEach(btn => {
      btn.addEventListener('click', () => { gemList.splice(Number(btn.dataset.gemDel), 1); renderEnchantOptimizer(); });
    });
    const reforgeSelectEl = $('#reforgePickSelect');
    const reforgeAddBtn = $('#reforgeAddBtn');
    if (reforgeAddBtn) reforgeAddBtn.addEventListener('click', () => {
      const r = REFORGE_STONES[Number(reforgeSelectEl.value)];
      reforgeList.push(r);
      renderEnchantOptimizer();
    });
    groupsEl.querySelectorAll('[data-reforge-del]').forEach(btn => {
      btn.addEventListener('click', () => { reforgeList.splice(Number(btn.dataset.reforgeDel), 1); renderEnchantOptimizer(); });
    });

    // "beste upgrade" — de goedkoopste enchant die je nog niet op het gewenste level hebt
    upgradeCandidates.sort((a,b) => a.price - b.price);
    const bestUpgrade = upgradeCandidates[0];

    const summaryEl = $('#enchantSummary');
    let linesHtml = lines.map(l => `<div class="e-line"><span class="e-lname">${escapeHTML(l.name)} ${romanNumeral(l.target)}</span><span>${fmtCoins(l.price)}</span></div>`).join('');
    if (gemList.length || reforgeList.length){
      linesHtml += `<div class="e-line"><span class="e-lname">/Gems + reforge</span><span>${fmtCoins(gemReforgeTotal)}</span></div>`;
    }
    if (!linesHtml) linesHtml = `<div class="e-line"><span class="e-lname">—</span><span>—</span></div>`;
    summaryEl.innerHTML = `
      <h4>Totale max-kost</h4>
      <div class="e-total">${bazaarData ? fmtCoins(totalCost) + ' coins' : '—'}</div>
      <div class="e-total-sub">${ENCHANT_TYPE_LABELS[type] || type} — som van instant-koopprijzen op de bazaar</div>
      ${linesHtml}
      ${bestUpgrade ? `<div class="e-missing" style="color:var(--green);">Beste volgende upgrade: <b>${escapeHTML(bestUpgrade.name)}</b> naar ${romanNumeral(bestUpgrade.target)} voor ${fmtCoins(bestUpgrade.price)} — dit is de goedkoopste stap richting je gekozen build.</div>` : ''}
      ${missingCount > 0 ? `<div class="e-missing">${missingCount} enchant(s) niet gevonden op de bazaar (naam wijkt af, of alleen via drops/AH verkrijgbaar) — telt niet mee in het totaal.</div>` : ''}
    `;
  }
  function romanNumeral(n){
    const map = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
    let s = '', v = n;
    for (const [val, sym] of map){ while (v >= val){ s += sym; v -= val; } }
    return s || String(n);
  }

