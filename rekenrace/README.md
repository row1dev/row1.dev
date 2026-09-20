# Blue Dog Rekenrace

Mobiele web-app: een top-down racespel waarin je bij de Rekengarage sommen maakt
om aan benzine, raketten en turbo te komen. Geïnspireerd op de Nederlandse
educatieve games uit de jaren 90. Alle namen, art en teksten zijn origineel.

Speel het **rechtop** op een telefoon, zonder installatie uit een app store.
Vanaf het homescreen start de app ook offline.

## Commands

```bash
npm install
npm run dev      # ontwikkelserver
npm test         # unit tests
npm run build    # typecheck + productiebuild naar dist/
npm run preview  # dist/ lokaal serveren (nodig om de service worker te testen)
```

## Hoe het spel werkt

Je rijdt een baan af die van bovenaf in beeld is. Gas gaat vanzelf; jij stuurt,
remt, geeft turbo en schiet raketten. Twee dingen lopen intussen leeg:

- **Benzine** gaat op afstand. Is de tank leeg, dan ga je te voet verder, en dat
  is veel langzamer.
- **Conditie** gaat achteruit van raketten en, veel langzamer, van botsingen.
  Op nul raak je je kart kwijt en loop je ook.

Bijvullen doe je bij een **Rekengarage**, een poort dwars over de baan. Rijd
naar binnen en elke som die je goed hebt levert één item op. Wat je aangeboden
krijgt hangt af van waar je het krapst in zit: een lege tank geeft benzine, een
gedeukte kart een reparatie. Je kart terugwinnen kan alleen bij een
**finishstation**, en kost een som die een niveau hoger ligt.

De race loopt buiten gewoon door zolang je binnen staat. Dat is de hele
afweging: elke extra som levert voorraad op maar kost baanpositie. Er is geen
quotum — je rijdt naar buiten wanneer jij vindt dat je genoeg hebt.

Je tegenstanders — Bram de Bever, Kaat de Kraai en Sil de Slang — stoppen bij
elke garage net zo goed, maar ze rekenen niet: ze staan er een vaste tijd.
**Daar wordt de race beslist.** Reken je sneller dan hun pauze, dan win je bij
elke garage tijd; doe je er langer over, dan verlies je hem. Een zwakkere rijder
staat langer stil en rijdt ook langzamer.

Zonder die pauze kon je de race niet winnen: stoppen voor benzine is verplicht,
dus elke seconde die je binnen stond was er één cadeau aan het veld. Headless
doorgerekend kwam een speler dan in élk scenario als laatste binnen, ook een
foutloze die in anderhalve seconde antwoordde.

Zo loopt het nu, gemeten over hele races:

| speler | tijd | plaats |
|---|---|---|
| 1,5 s per som, foutloos | 1:55 | 1e |
| 3 s per som, foutloos, kort tanken | 2:06 | 1e |
| 3 s per som, 90% goed | 2:37 | 3e |
| 4 s per som, 80% goed | 2:50 | 4e |
| 3 s per som, maar veel te lang tanken | 3:09 | 4e |

## Opzet

```
src/
  engine/     baan, karts, garage, tegenstanders, raketten, race — puur en headless
  render/     canvas: baan van bovenaf, sprites in code getekend
  ui/         besturing, numpad, HUD, schermen — DOM boven het canvas
  storage/    records en instellingen in localStorage
  audio/      WebAudio, alle geluid gegenereerd
  config.ts   alle tuningwaarden bij elkaar
```

Harde regel: alles onder `engine/` is puur en noemt nergens `window`,
`document` of `canvas`. De hele simulatie is daardoor headless te draaien, en
dat is ook hoe de tests hem draaien — inclusief complete races van begin tot
eind, met tegenstanders, raketten en garagebezoeken.

De renderlaag leest alleen uit de engine en schrijft er nooit in.

## De baan

De baan is een corridor: een slingerende middellijn met een halve breedte
eromheen, plus stenen, cactusvelden, richtingspijlen en garages. Alles seeded,
dus dezelfde seed geeft dezelfde baan.

Twee dingen die de generator garandeert, allebei met een test erop:

- De middellijn vraagt nergens een scherpere bocht dan een kart op topsnelheid
  kan draaien.
- Naast elk obstakel blijft een gat over dat breder is dan een kart. Zonder die
  marge klemt een kart zich vast tussen de steen en de muur, die elkaars
  correctie elke tick ongedaan maken.

Botsingen lossen op door langs het oppervlak te **schuiven**, niet door te
stuiteren. Een kart met automatisch gas ramt anders dezelfde steen eindeloos
opnieuw. Cactussen zijn een plafond op je snelheid, geen rem die elke tick
opnieuw aangrijpt — dat laatste laat je binnen een halve seconde stilvallen.

## Iconen

`public/icons/icon.svg` is de bron; de PNG's ernaast zijn daaruit gerenderd en
meegecommit, zodat de build geen beeldbewerking nodig heeft.

## Service worker

`src/sw-template.js` is de bron. Een plugin in `vite.config.ts` vult tijdens de
build de precache-lijst in met de echte bestandsnamen, inclusief hun hash, en
schrijft het resultaat naar `dist/sw.js`. Dat scheelt een externe PWA-plugin.

Let op `ignoreVary: true` bij elke `caches.match`. De server stuurt
`Vary: Origin` mee, en een module-script of stylesheet vraagt met een
`Origin`-header terwijl de precache-fetch dat niet doet. Zonder `ignoreVary`
mist de cache precies die twee bestanden en start de app offline zonder CSS en
JS.

De worker wordt alleen in een productiebuild geregistreerd, dus `npm run dev`
heeft er geen last van.

## Deploy

De build is een statische map zonder backend en met een relatieve `base`, dus
hij draait onder elk pad. Om hem op row1.dev te zetten:

```bash
npm run build
rm -rf ../public/rekenrace/* && cp -r dist/. ../public/rekenrace/
```

Daarmee staat het spel op `row1.dev/rekenrace/` en gaat het mee met de bestaande
Cloudflare-deploy van `public/`. Bewerk niets rechtstreeks in
`public/rekenrace/`; dat wordt bij de volgende build overschreven.
