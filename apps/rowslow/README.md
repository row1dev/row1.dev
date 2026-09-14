# rowslow — web

De publieke website van **rowslow**: landingspagina, privacybeleid en support.
Live op `https://rowslow.row1.dev`.

> **De iOS-app staat hier niet in.** Deze map bevat alleen de website. De Swift-broncode
> hoort in een eigen repository met een eigen toolchain — zie [`../../docs/PROJECTS.md`](../../docs/PROJECTS.md).

## Inhoud

```
wrangler.jsonc      Eigen Cloudflare Worker (name: rowslow)
public/             Alles wat gedeployed wordt
  index.html        Landingspagina
  privacy/          Privacybeleid
  support/          Veelgestelde vragen
  assets/style.css  Eigen stylesheet — geen import uit row1.dev
  404.html
  robots.txt
```

## Lokaal draaien

Statische bestanden, geen build-stap:

```bash
cd apps/rowslow/public && python3 -m http.server 8080
```

Open `http://localhost:8080`. De links zijn root-relatief (`/privacy/`), dus dit werkt
alleen als je `public/` zelf als docroot serveert — precies zoals in productie.

## Deployen

Deze map is een **eigen Worker**, los van de row1.dev-site. Eenmalige setup in het
Cloudflare-dashboard:

1. **Compute → Workers & Pages → Create → Import a repository** → `row1dev/row1.dev`.
2. Bij de build-instellingen:
   - **Root directory**: `apps/rowslow`
   - **Build command**: leeg laten
   - **Deploy command**: `npx wrangler deploy`
   - **Protect with Cloudflare Access**: **uit** (de site is publiek)
3. Na de eerste deploy: **Settings → Domains & Routes → Add → Custom domain** →
   `rowslow.row1.dev`.

Zorg dat de bestaande `row1-dev` Worker een root directory van `/` houdt, anders gaan de
twee deploys elkaar overschrijven.

## Verhuizen naar een eigen domein

De map is bewust zelfstandig: geen gedeelde CSS, geen gedeelde assets, geen paden die van
`row1.dev` uitgaan. Alles wordt vanaf de root van het eigen domein geserveerd.

Naar `rowslow.com` gaan is daarom één handeling: in Cloudflare bij deze Worker een custom
domain toevoegen en `rowslow.row1.dev` eventueel laten doorverwijzen. Aan de inhoud van
`public/` verandert niets.

Naar een eigen repository gaan is een `git subtree split` van deze map; de
`wrangler.jsonc` staat al op het juiste niveau, dus de Worker blijft werken zonder
aanpassingen.
