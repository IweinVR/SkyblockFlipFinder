# Skyblock Flip Finder

Een vanilla HTML/CSS/JS web-app (geen build-tools nodig) die livedata van de officiële, sleutelloze Hypixel Skyblock Bazaar- en Auction House-API's gebruikt om winstgevende flips te vinden.

## Starten

Open gewoon `index.html` in je browser (dubbelklikken volstaat), of gebruik in VS Code de extensie "Live Server" voor automatisch herladen tijdens het coderen.

Er is geen `npm install` of build-stap nodig — alles is gewone HTML/CSS/JS, verdeeld over losse bestanden die rechtstreeks door de browser geladen worden.

## Structuur

```
index.html          de HTML-pagina zelf: <head>, alle tabblad-markup, en onderaan de <script>-tags
css/
  styles.css        alle CSS (kleurenschema via custom properties in :root, Auction House/Monitor-modus
                     herdefiniëren die lokaal naar een donker "trading terminal"-thema)
js/
  core.js           gedeelde "engine": API-fetching (met CORS-proxy fallback-keten), localStorage-
                     persistence, formatting-helpers, market-health/manipulatie-checks, order-book-
                     walking, stabiliteit-over-tijd-tracking en de generieke sorteerbare tabel-renderer.
                     Alle andere js/*.js-bestanden hangen hiervan af; dit bestand hangt van niets af.
  bazaar.js         Bazaar Flips-tabblad
  craft.js          Craft/Compact Flips-tabblad
  enchant.js        Item Maxen-tabblad (enchant/gemstone/reforge-stone-configurator)
  ahflip.js         AH Flip-scanner-tabblad (hele Auction House scannen op bazaar-achtige items)
  npcscan.js        NPC-verkoop-tabblad (zero-risk flips + de NPC-prijslijst-instellingen)
  petflip.js        Pet Flips-tabblad: force-level (Pet Cake/Chyme) + Kat rarity-upgrade calculator
  essenceflip.js    Essence Flips-tabblad: clean (0★) AH-item kopen, met bazaar-Essence naar 5★
                     upgraden, als 5★ terugverkopen
  auctions.js       Auction House-tabblad: watchlist, alerts, ticker, de gedeelde volledige AH-scan,
                     en Monitor-modus
  trades.js         Mijn Trades-tabblad: eigen trade-logje + winst-over-tijd-/winst-per-type-grafieken
  dashboard.js      Dashboard-tabblad: statcards + bar-/donutgrafieken, puur gevoed door de compute*()-
                     functies van de andere tabbladen (geen eigen API-calls of berekeningen)
  app.js            bootstrap/glue: alle DOM-event-wiring en de initiële render/fetch-aanroepen.
                     Wordt als LAATSTE geladen, zodat alle functies/state uit de andere bestanden
                     al bestaan. Dit is het enige bestand dat bewust kriskras naar andere features
                     mag verwijzen (tabbladen hangen onderling samen, bv. een AH-scan vult meteen
                     ook de AH Flip-scanner en NPC-verkoop tabbladen).
```

Alle `js/*.js`-bestanden zijn gewone scripts (geen ES modules) die via `<script src="...">`-tags in
volgorde geladen worden — dat houdt dubbelklikken-om-te-openen (`file://`) werkend, want modules
worden daar door de meeste browsers geblokkeerd. Ze delen daardoor gewoon hetzelfde globale scope
(functies/variabelen uit `core.js` zijn direct bruikbaar in de andere bestanden, enz.) — precies zoals
voorheen binnen de ene grote `(function(){ ... })()` in het oude single-file-bestand.

## Belangrijkste features

- **Live market ticker & Market Status-box**: een vaste lichtkrant onderaan scrollt continu langs recente grote bazaar-prijsbewegingen (▲/▼, echte refresh-tot-refresh %-verschillen); rechtsboven in de header toont een "server status"-paneel live API-status, requests/min, ping en geschatte markt-omzet/uur — allemaal echte, afgeleide cijfers, geen decoratie. Tabelcellen met een live prijs (Bazaar/Craft) lichten bovendien heel even groen/rood op zodra hun waarde verandert.
- **Dashboard**: live marktoverzicht — statcards (gezonde markten%, beste bazaar-/craft-margin nu, risicovrije NPC-kansen, gerealiseerde winst) plus bar-/donutgrafieken (top flips, gemiddelde margin per categorie, markt-gezondheid, winst per dag). Puur een andere weergave van cijfers die de overige tabbladen al berekenen — geen extra API-calls.
- **Bazaar Flips** & **Craft/Compact Flips**: vindt winstgevende instant-buy/instant-sell en craft-flips, met een manipulatie-/dunne-orderboek-filter. Klik op een rij om een mini orderboek-dieptegrafiek te openen (koop-/verkooporders per prijslaag, met gemarkeerd hoeveel die specifieke flip daarvan zou gebruiken). Craft Flips herkent ook échte 2-staps compacting-ketens (bv. Enchanted Iron → Enchanted Iron Block), automatisch afgeleid uit de bazaar-productnamen zelf — Hypixel's publieke item-API bevat geen crafting-recepten (meer), geverifieerd tegen de live API.
- **Mijn Trades**: eigen trade-logje met winst-over-tijd-, winst-per-dag- en winst-per-type-grafieken, bewaard in `localStorage`.
- **Auction House**: watchlist + alerts op BIN-prijzen, met een eigen donkere "trading terminal"-stijl.
- **AH Flip-scanner**: scant de hele Auction House op herverkoop- en AH-bazaar-arbitragekansen.
- **NPC-verkoop**: zero-risk flips tegen NPC-verkoopprijzen (ingebouwde standaardlijst + eigen aanpassingen).
- **Pet Flips**: force-level- en Kat rarity-upgrade-calculator op basis van dezelfde AH-scan.
- **Essence Flips**: vindt clean (0★)/5★-paren van dungeon-items via dezelfde AH-scan en rekent de winst uit (clean BIN + live Essence-kosten vs. 5★ BIN). De benodigde essence-hoeveelheid per item vul je zelf in (1x), zie uitleg in de tab.
- **Item Maxen**: enchant-configurator met conflictgroepen, per-enchant level-keuze, "wat heb ik nu"-tracking, gemstones/reforge stones en live bazaar-kostprijzen.

## Verder coderen

Elk tabblad/feature heeft nu zijn eigen bestand in `js/` — begin daar voor een gerichte wijziging
(bv. `js/bazaar.js` voor de Bazaar Flips-logica). Gedeelde hulpfuncties (fetchen, formatteren,
manipulatie-checks, tabel-rendering) staan in `js/core.js`. DOM-wiring (knoppen, event listeners,
de initiële data-load) staat in `js/app.js`.

Tip: na een wijziging, open de Developer Tools in je browser (F12) en check de Console op foutmeldingen voor je verdergaat.
