# Projectconventie

Hoe projecten in deze repo staan, en hoe je ze er weer uit haalt zonder gedoe.

Uitgangspunt: een project begint als extensie van `row1.dev` op een subdomein, en moet
later zonder herschrijfwerk naar een eigen domein en een eigen repository kunnen. Dat
lukt alleen als een project vanaf dag één niets deelt met de rest van de repo.

## Indeling

```
public/                 De row1.dev-site zelf (eigen Worker, root wrangler.jsonc)
apps/<project>/         Eén map per project
  wrangler.jsonc        Eigen Worker, eigen naam, eigen custom domain
  public/               Docroot van dat project
  README.md             Wat het is, hoe je het draait, hoe je het verhuist
docs/                   Repo-brede documentatie
```

Eén project is precies één map onder `apps/`, en die map is de deploy-eenheid.

## De vier regels die verhuizen makkelijk houden

1. **Eigen Worker, eigen domein.** Elk project krijgt een eigen `wrangler.jsonc` en wordt
   bij de root van zijn eigen hostname geserveerd, niet onder een pad van `row1.dev`.
   Daardoor is een verhuizing een DNS-handeling, geen zoek-en-vervang door alle links.
2. **Niets delen.** Geen gedeelde stylesheet, geen gedeelde JS, geen gedeelde afbeeldingen,
   geen import uit `../../public/`. Liever een paar regels CSS dubbel dan een project dat
   niet los te trekken is. Een `apps/<project>/` map moet op zichzelf te serveren zijn.
3. **Links root-relatief binnen het eigen project.** `/privacy/`, niet `/rowslow/privacy/`
   en niet `../privacy/`. Verwijzingen náár row1.dev zijn absolute URL's
   (`https://row1.dev`), zodat ze blijven kloppen als het project verhuist.
4. **Geen build-stap tenzij het echt moet.** Statische bestanden overleven elke verhuizing.
   Komt er toch tooling bij, houd die dan binnen de projectmap (eigen `package.json`,
   eigen lockfile), nooit in de repo-root.

## Een project verhuizen

**Naar een eigen domein:** in Cloudflare bij de Worker van dat project een custom domain
toevoegen. Verder niets. Het oude subdomein kan blijven staan of doorverwijzen.

**Naar een eigen repository:**

```bash
git subtree split --prefix=apps/<project> -b <project>-only
# push die branch naar de nieuwe repo als main, en verwijder apps/<project> hier
```

De `wrangler.jsonc` staat in de projectmap zelf, dus in de nieuwe repo ligt hij meteen op
de root en hoeft de Cloudflare-config alleen zijn root directory terug naar `/` te zetten.

## Waar hoort broncode van een app?

Alleen webinhoud hoort in deze repo. Een native app (Swift, Kotlin) hoort in een eigen —
doorgaans private — repository: andere taal, andere toolchain, andere CI (macOS-runners
voor iOS), en meestal ander licentiebeleid. Wat hier komt te staan is de website van die
app: landingspagina, privacybeleid en support.

Zo staat het nu:

| Project | Web | App-broncode |
|---|---|---|
| row1.dev | `public/` | n.v.t. |
| willem | `public/willem/` | eigen repository |
| rowslow | `apps/rowslow/` | eigen repository (nog aan te maken) |

`public/willem/` volgt de oudere indeling en deelt de stylesheet van row1.dev. Nieuwe
projecten gaan naar `apps/`; willem kan mee verhuizen zodra daar aanleiding voor is.
