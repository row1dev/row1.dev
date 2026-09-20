# row1.dev

Landingspagina + afgeschermde projectenlijst voor [row1.dev](https://row1.dev).

- `public/index.html` — publieke landingspagina
- `public/app/` — projectenoverzicht, afgeschermd via Cloudflare Access (alleen GitHub-login `row1dev`)
- `public/app/data/projects.json` — bron voor de projectenlijst op `/app`
- `public/assets/` — CSS/JS, geen build-stap nodig
- `wrangler.jsonc` — Cloudflare Workers static-assets config (deploy-doelwit: `public/`)
- `champagne/` — Next.js-app voor [champagne.row1.dev](https://champagne.row1.dev), deploy op Vercel (eigen [README](champagne/README.md))
- `rekenrace/` — Blue Dog Rekenrace, een Vite-spel dat als statische map onder `public/rekenrace/` gedeployed wordt (eigen [README](rekenrace/README.md))

## Lokaal draaien

Puur statische bestanden, dus elke simpele webserver volstaat:

```bash
cd public && python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Projectpagina's

Projecten met een eigen webpagina krijgen een map onder `public/`, en staan live op
een pad van deze site:

| Project | Map | Live |
|---|---|---|
| willem | `public/willem/` | [row1.dev/willem/privacy/](https://row1.dev/willem/privacy/) |
| rowslow | `public/rowslow/` | [row1.dev/rowslow/](https://row1.dev/rowslow/) |

Links binnen zo'n map zijn absoluut vanaf de root (`/rowslow/privacy/`). De broncode van
de apps zelf staat niet hier maar in een eigen repository.

## Apps in deze repo

De meeste projecten staan in een eigen private repository. Twee staan hier wel:

### champagne

[`champagne/`](champagne/) is een Next.js-app met Supabase erachter, los van de
statische site en met een eigen deploy op Vercel (root directory `champagne`). Zie
[`champagne/README.md`](champagne/README.md) voor de omgevingsvariabelen en het
Supabase-schema.

### rekenrace

[`rekenrace/`](rekenrace/) is Blue Dog Rekenrace: een racespel op de telefoon waarin je
snelheid bepaald wordt door hoe snel je rekensommen oplost. Vite en TypeScript, geen
backend, offline speelbaar als PWA. Zie [`rekenrace/README.md`](rekenrace/README.md).

Anders dan champagne krijgt dit geen eigen deploy: de build is een statische map die
onder `public/rekenrace/` gaat en dus meelift op de Cloudflare-deploy van `public/`.

```bash
cd rekenrace && npm install && npm run build
cp -r dist/. ../public/rekenrace/
```

## Een project toevoegen

Voeg een object toe aan [`public/app/data/projects.json`](public/app/data/projects.json):

```json
{
  "name": "Naam",
  "description": "Korte omschrijving.",
  "status": "live",
  "tags": ["go", "cli"],
  "url": "https://project.row1.dev",
  "repo": "private"
}
```

De broncode van projecten zelf staat **niet** in deze repo — die blijft in een eigen
private repository. Deze site toont alleen naam, beschrijving en (indien van toepassing)
een link naar een live demo. Hoort er een webpagina bij, zet die dan onder
`public/<project>/`.

## Deploy: Cloudflare Workers (static assets)

Cloudflare heeft Pages inmiddels samengevoegd met Workers. De statische site
wordt gedeployed als "static assets" via [`wrangler.jsonc`](wrangler.jsonc),
dat verwijst naar de `public/` map.

Huidige (2026) Cloudflare-dashboard flow:

1. Log in op [Cloudflare](https://dash.cloudflare.com) → sidebar **Compute** → **Workers & Pages** → **Create** → **Import a repository** (Git).
2. Selecteer deze repo (`row1dev/row1.dev`).
3. Bij "Set up your application":
   - **Build command**: leeg laten
   - **Deploy command**: `npx wrangler deploy` (staat al goed als placeholder)
   - **Protect with Cloudflare Access**: laat dit **uit** — dat zou de hele site
     (inclusief de publieke landingspagina) achter een login zetten. De login
     komt straks alleen op `/app/*`, zie hieronder.
4. **Deploy**. Elke push naar `main` deployt automatisch opnieuw.

Live staat op: `row1-dev.<jouw-workers-subdomein>.workers.dev`.

## Domein koppelen (Hostnet → Cloudflare)

Cloudflare Access (stap hieronder) vereist dat het domein als *zone* in Cloudflare
zit, dus de nameservers moeten verhuizen:

1. Cloudflare dashboard → sidebar **Domains** → **Add a domain** → `row1.dev` → kies het gratis plan.
2. Cloudflare toont 2 nameservers (bv. `xxx.ns.cloudflare.com`).
3. Bij Hostnet: log in → domein `row1.dev` → **Nameservers wijzigen** → vul de
   twee Cloudflare-nameservers in (dit vervangt Hostnet's eigen DNS-beheer —
   je beheert DNS-records daarna in Cloudflare, niet meer bij Hostnet).
4. Wachten tot Cloudflare de zone als **Active** toont (kan tot 24u duren, meestal sneller).
5. Sidebar **Compute** → **Workers & Pages** → open `row1-dev` → **Settings** tab
   → **Domains & Routes** → **Add** → **Custom domain** → `row1.dev`.

## Login afschermen: Cloudflare Zero Trust Access

Genoemde paden zijn de actuele (2026) dashboard-navigatie, geverifieerd tegen de
officiële [Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/).

1. Sidebar (onderaan, "Protect & connect") → **Zero Trust** → eenmalig een team-naam
   kiezen (gratis tot 50 gebruikers). Je team-naam vind je terug onder
   **Settings → Team name and domain**.
2. **GitHub als identity provider**:
   - Maak een [GitHub OAuth App](https://github.com/settings/developers) aan onder
     het `row1dev`-account:
     - **Homepage URL**: `https://<team-naam>.cloudflareaccess.com`
     - **Authorization callback URL**: `https://<team-naam>.cloudflareaccess.com/cdn-cgi/access/callback`
   - Noteer de **Client ID** en genereer een **Client secret**.
   - In Cloudflare: **Zero Trust → Integrations → Identity providers → Add new
     identity provider → GitHub** → vul Client ID + secret in → **Save** → **Finish
     setup** (autoriseert de OAuth-app) → **Test** om te checken dat het werkt.
3. **De Access-applicatie**:
   - **Zero Trust → Access controls → Applications → Create new application →
     Self-hosted and private → Add public hostname**
   - **Domain**: `row1.dev` (uit de dropdown), **Path**: `app*`
     (dekt `/app`, `/app/` en alles eronder, incl. `/app/data/projects.json`)
   - Bij "Configure how users will authenticate": schakel alleen **GitHub** in
     als identity provider voor deze app
   - **Access policies**: maak een policy met **Action = Allow**, Include →
     **Emails** = jouw eigen e-mailadres (zo kan alleen jij erdoorheen, ook al
     staat GitHub als login-optie open voor iedereen met een GitHub-account)
   - **Create**
4. Klaar. Bezoekers die naar `row1.dev/app` gaan krijgen nu een Cloudflare-loginscherm
   voordat ze bij de statische pagina komen — geen custom auth-code nodig.

## Code-privacy

Deze repo is publiek (nodig om als portfolio te tonen en simpel te deployen).
De meeste projecten staan in aparte **private** repositories onder
[github.com/row1dev](https://github.com/row1dev) — hun broncode is dus niet
zichtbaar voor anderen. Uitzondering zijn `champagne/` en `rekenrace/`, die wél
hier staan en dus openbaar zijn. Zie [`LICENSE`](LICENSE) voor de voorwaarden van
de code in deze repo.
