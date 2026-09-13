# row1.dev

Landingspagina + afgeschermde projectenlijst voor [row1.dev](https://row1.dev).

- `index.html` — publieke landingspagina
- `app/` — projectenoverzicht, afgeschermd via Cloudflare Access (alleen GitHub-login `row1dev`)
- `data/projects.json` — bron voor de projectenlijst op `/app`
- `assets/` — CSS/JS, geen build-stap nodig

## Lokaal draaien

Puur statische bestanden, dus elke simpele webserver volstaat:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Een project toevoegen

Voeg een object toe aan [`data/projects.json`](data/projects.json):

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

De broncode van projecten zelf staat **niet** in deze repo — die blijven in hun eigen
private repositories. Deze site toont alleen naam, beschrijving en (indien van
toepassing) een link naar een live demo.

## Deploy: Cloudflare Workers (static assets)

Cloudflare heeft Pages inmiddels samengevoegd met Workers. De statische site
wordt gedeployed als "static assets" via [`wrangler.jsonc`](wrangler.jsonc),
dat verwijst naar de `public/` map.

1. Log in op [Cloudflare](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Import a repository** (Git).
2. Selecteer deze repo (`row1dev/row1.dev`).
3. Bij "Set up your application":
   - **Build command**: leeg laten
   - **Deploy command**: `npx wrangler deploy` (staat al goed als placeholder)
   - **Protect with Cloudflare Access**: laat dit **uit** — dat zou de hele site
     (inclusief de publieke landingspagina) achter een login zetten. De login
     komt straks alleen op `/app/*`, zie hieronder.
4. **Deploy**. Elke push naar `main` deployt automatisch opnieuw.

## Domein koppelen (Hostnet → Cloudflare)

Cloudflare Access (stap hieronder) vereist dat het domein als *zone* in Cloudflare
zit, dus de nameservers moeten verhuizen:

1. Cloudflare dashboard → **Add a site** → `row1.dev` → kies het gratis plan.
2. Cloudflare toont 2 nameservers (bv. `xxx.ns.cloudflare.com`).
3. Bij Hostnet: ga naar het domein `row1.dev` → **Nameservers wijzigen** → vul de
   twee Cloudflare-nameservers in (dit vervangt Hostnet's eigen DNS-beheer —
   je beheert DNS-records daarna in Cloudflare, niet meer bij Hostnet).
4. Wachten tot Cloudflare "Active" toont voor de zone (kan tot 24u duren, meestal sneller).
5. In je Worker-project: **Settings → Domains & Routes → Add → Custom domain** → voeg `row1.dev` toe.

## Login afschermen: Cloudflare Zero Trust Access

1. [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com) → eenmalig een team-naam kiezen (gratis tot 50 gebruikers).
2. **Settings → Authentication → Login methods** → voeg **GitHub** toe als identity provider
   (hiervoor maak je een [GitHub OAuth App](https://github.com/settings/developers) aan onder het
   `row1dev`-account; Cloudflare geeft de exacte callback-URL die je daar invult).
3. **Access → Applications → Add an application → Self-hosted**.
   - Domain: `row1.dev`, Path: `/app*`
   - Policy: **Allow**, Include → **Login Methods** = GitHub, én een regel
     **Emails** = jouw eigen e-mailadres (zodat alleen jij binnenkomt, ook al
     staat GitHub als optie open).
4. Klaar. Bezoekers die naar `row1.dev/app` gaan krijgen nu een Cloudflare-loginscherm
   voordat ze bij de statische pagina komen — geen custom auth-code nodig.

## Code-privacy

Deze repo is publiek (nodig om als portfolio te tonen en simpel te deployen).
De daadwerkelijke projecten staan in aparte **private** repositories onder
[github.com/row1dev](https://github.com/row1dev) — hun broncode is dus niet
zichtbaar voor anderen. Zie [`LICENSE`](LICENSE) voor de voorwaarden van deze
landingspagina-code zelf.
