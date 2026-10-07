# Skyblock Flip Finder

Een single-file, vanilla HTML/CSS/JS web-app (geen build-tools nodig) die livedata van de officiële, sleutelloze Hypixel Skyblock Bazaar- en Auction House-API's gebruikt om winstgevende flips te vinden.

## Starten

Open gewoon `skyblock-flip-finder.html` in je browser (dubbelklikken volstaat), of gebruik in VS Code de extensie "Live Server" voor automatisch herladen tijdens het coderen.

Er is geen `npm install` of build-stap nodig — alles (HTML, CSS, JS) staat in dat ene bestand.

## Structuur van het bestand

- `<style>` bovenaan: alle CSS, via custom properties (`--bg`, `--accent`, `--green`, ...) in `:root` voor het kleurenschema (licht, zakelijk thema). Het Auction House-tabblad en Monitor-modus herdefiniëren die variabelen lokaal naar een donker "trading terminal"-thema.
- `<body>`: de HTML voor elk tabblad (Bazaar Flips, Craft/Compact Flips, Mijn Trades, Auction House, AH Flip-scanner, NPC-verkoop, Item Maxen, Uitleg).
- `<script>` onderaan: één grote IIFE met alle logica — API-fetching (met CORS-proxy fallback-keten), berekeningen (order-book walking, manipulatie-filters, arbitrage, enchant-configurator) en rendering (losse `render*()`-functies per tabblad).

## Belangrijkste features

- **Bazaar Flips** & **Craft/Compact Flips**: vindt winstgevende instant-buy/instant-sell en craft-flips, met een manipulatie-/dunne-orderboek-filter.
- **Mijn Trades**: eigen trade-logje met winst-per-dag-grafiek, bewaard in `localStorage`.
- **Auction House**: watchlist + alerts op BIN-prijzen, met een eigen donkere "trading terminal"-stijl.
- **AH Flip-scanner**: scant de hele Auction House op herverkoop- en AH-bazaar-arbitragekansen.
- **NPC-verkoop**: zero-risk flips tegen NPC-verkoopprijzen (ingebouwde standaardlijst + eigen aanpassingen).
- **Item Maxen**: enchant-configurator met conflictgroepen, per-enchant level-keuze, "wat heb ik nu"-tracking, gemstones/reforge stones en live bazaar-kostprijzen.

## Verder coderen

Zoek functies op via de ingebouwde zoekfunctie van VS Code (Ctrl+Shift+F) — alles staat in dit ene bestand, dus een globale zoekopdracht op bv. `function renderBazaarTab` vindt je snel de juiste plek.

Tip: na een wijziging, open de Developer Tools in je browser (F12) en check de Console op foutmeldingen voor je verdergaat.
