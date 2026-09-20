# Blue Dog Rekenrace

Mobiele web-app: een racespel waarin je snelheid bepaald wordt door hoe snel en goed je
rekensommen oplost. Geïnspireerd op de Nederlandse educatieve games uit de jaren 90.
Mascotte is Blue Dog, een blauwe hond. Alle namen, art en teksten zijn origineel.

Speel het liggend op een telefoon, zonder installatie uit een app store. Vanaf het
homescreen start de app ook offline.

## Commands

```bash
npm install
npm run dev      # ontwikkelserver
npm test         # unit tests
npm run build    # typecheck + productiebuild naar dist/
npm run preview  # dist/ lokaal serveren (nodig om de service worker te testen)
```

## Opzet

```
src/
  engine/     sommen, race-simulatie, moeilijkheid — puur en headless
  render/     canvas: baan, parallax, sprites
  ui/         numpad, HUD, schermen — DOM boven het canvas
  storage/    records en instellingen in localStorage
  audio/      WebAudio, alle geluid gegenereerd
  config.ts   alle tuningwaarden bij elkaar
```

Harde regel: alles onder `engine/` is puur en noemt nergens `window`, `document` of
`canvas`. De hele simulatie is daardoor headless te draaien, en dat is ook hoe de
tests hem draaien — inclusief complete races van begin tot eind.

De renderlaag leest alleen uit de engine en schrijft er nooit in.

## Snelheden zijn per seconde

Het ontwerp geeft `vBase = 3.0`, `vMax = 9.0` en een afstand van 1000 baan-eenheden.
Die getallen kloppen alleen als snelheid in eenheden **per seconde** staat:

| lezing | duur van een race op basistempo |
|---|---|
| per tick (60 Hz) | 5,5 seconde — onspeelbaar |
| per seconde | 333 seconde, met 111 seconde als ondergrens op `vMax` |

De tweede lezing sluit aan op de recordtijden in het ontwerp (01:44 tot 03:12), dus die
houden we aan. Per tick telt de simulatie `v / 60` bij de afstand op; de drag-factor van
0,98 is wél per tick.

De afstand staat per circuit in `CIRCUIT_DISTANCE`, met 1000 als standaard voor de Grand
Prix. De kortere circuits komen daarmee uit rond de recordtijden uit het ontwerp — een
sterke ronde op de Tafelbaan duurt ongeveer 01:42. Wil je kortere races, dan is die
tabel de knop om aan te draaien, niet de snelheden.

## Iconen

`public/icons/icon.svg` is de bron; de PNG's ernaast zijn daaruit gerenderd en
meegecommit, zodat de build geen beeldbewerking nodig heeft.

## Service worker

`src/sw-template.js` is de bron. Een plugin in `vite.config.ts` vult tijdens de build de
precache-lijst in met de echte bestandsnamen, inclusief hun hash, en schrijft het
resultaat naar `dist/sw.js`. Dat scheelt een externe PWA-plugin.

Let op `ignoreVary: true` bij elke `caches.match`. De server stuurt `Vary: Origin` mee, en
een module-script of stylesheet vraagt met een `Origin`-header terwijl de precache-fetch
dat niet doet. Zonder `ignoreVary` mist de cache precies die twee bestanden en start de
app offline zonder CSS en JS.

De worker wordt alleen in een productiebuild geregistreerd, dus `npm run dev` heeft er
geen last van.

## Deploy

De build is een statische map zonder backend en met een relatieve `base`, dus hij draait
onder elk pad. Om hem op row1.dev te zetten:

```bash
npm run build
cp -r dist/. ../public/rekenrace/
```

Daarmee staat het spel op `row1.dev/rekenrace/` en gaat het mee met de bestaande
Cloudflare-deploy van `public/`.
