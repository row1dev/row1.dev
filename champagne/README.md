# champagne.row1.dev

Bijhouden wat we drinken in de Champagne. Next.js (App Router) + Supabase,
deploy op Vercel.

Geen accounts: bij het eerste bezoek vul je je naam in, die wordt samen met een
gegenereerde uuid in `localStorage` bewaard. De adminpagina zit achter een
sleutel in de URL.

## Routes

| Route | Wat |
|---|---|
| `/` | Je eigen tastings, nieuwste boven, plus de knop om er een toe te voegen |
| `/admin?key=<ADMIN_KEY>` | Alle tastings van iedereen, met per rij een verhaaltje dat opslaat zodra je het veld verlaat |
| `POST /api/tastings` | Nieuwe tasting (multipart: foto, naam, cijfer, user) |
| `GET /api/tastings?user_id=` | Tastings van één gebruiker |
| `PATCH /api/admin/tastings/:id` | `note` bijwerken, met `x-admin-key` header |

De browser praat nooit rechtstreeks met Supabase. Alles loopt via de route
handlers, die de service role key gebruiken — die key staat dus alleen op de
server.

## Regels

- **Naam**: precies één woord. Meer woorden geeft een validatiefout, zowel in de
  browser als op de server, en de database heeft er een `check` voor.
- **Cijfer**: één decimaal met een komma (`8,4`). Precies `8,5` is verboden.
- **Foto**: verplicht, wordt client-side verkleind naar max 1200px op de langste
  zijde en opnieuw gecodeerd als JPEG q0.7 vóór de upload.

## Supabase

1. Maak een project aan.
2. Draai [`supabase/schema.sql`](supabase/schema.sql) in de SQL editor. Dat maakt
   de tabel `tastings`, de indexen, de checks, zet RLS aan en maakt de publieke
   bucket `champagne-photos`.
3. Haal de project-URL en de **service role** key op onder Project settings → API.

## Lokaal draaien

```bash
cd champagne
npm install
cp .env.example .env.local   # vul de waarden in
npm run dev
```

## Deploy op Vercel

Nieuw project vanaf deze repository, met:

- **Root Directory**: `champagne`
- **Framework preset**: Next.js (wordt vanzelf herkend)

Environment variables (alle drie voor Production, Preview en Development):

| Variabele | Waarde |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | de service role key |
| `ADMIN_KEY` | zelfverzonnen, lang en willekeurig |
| `SUPABASE_PHOTO_BUCKET` | optioneel, standaard `champagne-photos` |

Zet daarna het domein `champagne.row1.dev` op het project onder Settings →
Domains, en voeg in Cloudflare DNS een `CNAME` toe die Vercel je geeft.
