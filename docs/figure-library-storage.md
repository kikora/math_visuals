# Figurbibliotek-lagring

Denne siden dokumenterer hvordan `/api/figure-library` lagrer figurer, hvilke miljøvariabler som kreves for vedvarende lagring og
hvordan klienter bør tolke API-responsene.

## Backend som sannhetskilde

`/api/figure-library` er nå eneste autoritative kilde for målefigurer og opplastede ressurser. De statiske manifestene i
`packages/figures` beholdes kun som kilde for seed-data og vil fases ut når alle klienter har tatt i bruk API-et. Benytt
seeding-skriptet (se under) for å fylle lagringen med standardfigurer når et miljø startes opp.

Når API-et mottar nye figurer eller kategorier oppdateres alle klienter ved å hente biblioteket på nytt. Ingen repo-endringer er
nødvendige for å lagre eller flytte figurer når backend er i bruk.

## Lagringsmoduser

* **Redis (vedvarende):** Når `REDIS_ENDPOINT`, `REDIS_PORT` og `REDIS_PASSWORD` er satt, bruker API-et Redis-tilkoblingen fra `infra/data` til å lagre både SVG-data og figurbibliotek-metadata. Responsene markeres med `storage: "kv"`, `mode: "kv"` og `persistent: true`. Headerne `X-Figure-Library-Store-Mode` og `X-Figure-Library-Storage-Result` settes til `kv`.
* **Minnemodus:** Uten Redis-variablene faller API-et tilbake til et delt in-memory-lager. Responsene inneholder `storage: "memory"`, `ephemeral: true` og feltet `limitation` med teksten «Denne instansen bruker midlertidig minnelagring. Figurer tilbakestilles når serveren starter på nytt.». Headerne rapporterer `memory`.
* **Redis-feil:** Hvis Redis er konfigurert, men kallet feiler, svarer API-et med `502` og samme metadatafelt slik at UI kan vise en feilmelding, samtidig som lagrede data fortsatt hentes fra minnet dersom de finnes.

## Miljøvariabler

| Variabel | Effekt |
| --- | --- |
| `REDIS_ENDPOINT` | Hostnavn til Redis-instansen som skal brukes av figurbiblioteket. |
| `REDIS_PORT` | Portnummeret til Redis-instansen. |
| `REDIS_PASSWORD` | Auth-tokenet/passordet for Redis. |
| `FIGURE_LIBRARY_ALLOWED_ORIGINS` | Kommaseparert liste over opprinnelser som får CORS-tilgang. Faller tilbake til `SVG_ALLOWED_ORIGINS`, `ALLOWED_ORIGINS` eller `EXAMPLES_ALLOWED_ORIGINS` hvis den ikke er satt. Bruk `*` for å tillate alle opprinnelser under lokal utvikling. |

> **Tips:** Sett `REDIS_*` for alle miljøer (Preview, Production, eventuelt Development) du vil at biblioteket skal huske opplastinger i. Uten disse verdiene er biblioteket nytt ved hver serverstart.

## API-kontrakt

`/api/figure-library` aksepterer og returnerer JSON. Alle responser inneholder metadata om lagringsmodus (`storage`, `mode`, `persi
stent`, `ephemeral`, `limitation`) i tillegg til selve dataene.

### `GET /api/figure-library`

* Uten query-parametere returnerer den hele biblioteket:
  ```json
  {
    "entries": [
      {
        "slug": "custom/figur",
        "title": "Tilpasset figur",
        "svg": "<svg …>",
        "png": "data:image/png;base64,…",
        "pngWidth": 120,
        "pngHeight": 90,
        "tags": ["geometri"],
        "category": {
          "id": "geometri",
          "label": "Geometri"
        }
      }
    ],
    "categories": [
      {
        "id": "geometri",
        "label": "Geometri",
        "figureSlugs": ["custom/figur"]
      }
    ],
    "storage": "kv",
    "persistent": true
  }
  ```
* Med `?slug=...` returnerer API-et én enkelt figur (404 dersom den ikke finnes).

### `POST /api/figure-library`

Oppretter en ny figur. Krav:

* `slug` – streng som identifiserer figuren. Normaliseres (små bokstaver, fjerner `.svg`/`.png`).
* `svg` – gyldig SVG-markup.
* `png` – data-URL (`data:image/png;base64,…`). Både streng og objekt `{ dataUrl, width, height }` støttes.
* `title`, `tool`, `summary`, `tags` og `category` er valgfrie, men brukes til å bygge bibliotekvisningen.

Responsen inneholder `entry` (det lagrede objektet), oppdatert `categories`-liste og lagringsmetadata.

### `PATCH /api/figure-library`

Oppdaterer en eksisterende figur. Bruk `slug` for å identifisere posten. Felter som sendes blir oppdatert – `png` kan utelates ved
 metadataendringer. Hvis `category` eller `categoryId` endres, flyttes figuren automatisk mellom kategorier.

### `DELETE /api/figure-library`

Sletter en figur. Du kan sende `slug` som query-parameter eller i JSON-body. Svaret inneholder `deleted.slug` samt en oppdatert k
ategoriliste.

## Klientintegrasjoner

Klientapper skal hente katalogen fra API-et via hjelpefunksjonene i `figure-library/measurement.js` eller `figure-library/all.js`.
Et typisk oppsett ser slik ut:

```js
import { buildFigureData, loadFigureLibrary } from './figure-library/measurement.js';

await loadFigureLibrary({ app: 'sortering' });
const figureData = buildFigureData({ app: 'sortering' });
```

`loadFigureLibrary` henter `/api/figure-library`, oppdaterer interne caches og eksponerer metadata (`storage`, `limitation` osv.).
`buildFigureData` kombinerer seed-data fra repoet med dataene som backend returnerte, slik at eksisterende logikk for figurlister kan gjenbrukes.

Når API-et ikke er tilgjengelig, faller klienten tilbake til de statiske seed-dataene. Bruk `metadata.limitation` for å vise advarsler om midlertidig lagring, og logg feil slik at tjenesten kan retrye når backend er tilbake.

## Fallback og klientatferd

* UI-et (`bibliotek.js`) leser `storage`/`mode` og viser en tydelig advarsel basert på `limitation` når data er flyktige.
* Headerne `X-Figure-Library-Store-Mode` og `X-Figure-Library-Storage-Result` gjør det enkelt å logge hvilken modus instansen kj
ører i (f.eks. i CloudWatch-loggene).
* Når kategorier endres via API-et (oppretting, oppdatering eller sletting), sørger back-end for at figurene oppdateres. Klienter
 trenger ikke å håndtere referanseoppdatering manuelt – det holder å refreshe listen.
* Minnemodus deler tilstand på tvers av alle forespørsler i samme prosess. Når serverless-funksjonen skalerer til null eller rede
ployes, startes denne tilstanden på nytt. Sørg derfor for å aktivere Redis i miljøer hvor du forventer at opplastinger skal bevares.

## Lokal testing

Playwright-testene `tests/figure-library-api.spec.js` og `tests/figure-library-ui.spec.js` dekker begge modusene. De bruker en injisert Redis-klient (`tests/helpers/kv-mock.js`) for å simulere den vedvarende lagringen og et in-memory-fallbakkscenario. Kjør `npx playwright test tests/figure-library-api.spec.js tests/figure-library-ui.spec.js` for å verifisere at både back-end og UI fungerer med den ønskede lagringskonfigurasjonen.

## Populere lagringen med standardfigurer

Skriptet `scripts/seed-figure-library.mjs` leser manifestene fra `figure-library/all.js` og pakkene i `packages/figures` og oppretter kategorier og figurer i lagringen.

### Hurtigoppsett

1. **(Valgfritt) Pek mot Redis før seeding.** Eksporter hemmelighetene i samme shell hvis du vil lagre data permanent i stedet for i minnet:
   ```sh
   export REDIS_ENDPOINT=…
   export REDIS_PORT=6379
   export REDIS_PASSWORD=…
   ```
2. **Tørrkjøring for inspeksjon:**
   ```sh
   node scripts/seed-figure-library.mjs --dry-run
   ```
   Dette viser payloaden uten å skrive til lagringen.
3. **Fyll delt minnelager (lokalt standardvalg):**
   ```sh
   node scripts/seed-figure-library.mjs
   ```
4. **Skriv direkte til Redis:**
   ```sh
   REDIS_ENDPOINT=… REDIS_PORT=6379 REDIS_PASSWORD=… node scripts/seed-figure-library.mjs
   ```
5. **Last biblioteket på nytt.** Etter seeding, oppdater UI-et eller kall `loadFigureLibrary()` i klienten for å hente dataene fra API-et.

* For å se hva som ville blitt skrevet uten å gjøre endringer: `node scripts/seed-figure-library.mjs --dry-run`.
* For å fylle den delte minnelagringen lokalt holder det å kjøre `node scripts/seed-figure-library.mjs` (uten Redis-variabler).
* For å skrive direkte til Redis setter du `REDIS_ENDPOINT`, `REDIS_PORT` og `REDIS_PASSWORD` i samme shell før skriptet kjøres, f.eks. `REDIS_ENDPOINT=… REDIS_PORT=6379 REDIS_PASSWORD=… node scripts/seed-figure-library.mjs`.

Skriptet logger hver kategori og figur som behandles, og gir en oppsummering på slutten. Alle figurer får SVG-data fra repoet, og PNG-data inkluderes automatisk dersom tilsvarende filer finnes.

Dette skriptet er den autoritative kilden til startdata i overgangsperioden. Kjør det ved nye deployer eller når minnelageret er tomt for å sikre at API-et alltid speiler manifestet. Outputen fra `--dry-run` kan arkiveres sammen med release-notater slik at andre apper har en oppdatert oversikt over tilgjengelige figurer.

## Kommunikasjon og midlertidig fallback

* **Informer teamet:** Del en kort oppsummering i `#math-visuals` om at manifestfilene fases ut, at `/api/figure-library` er ny sannhetskilde og at `loadFigureLibrary()` må kalles før `buildFigureData()`.
* **Koordiner dato:** Avklar hvilken dato manifestene fjernes helt, og påminn app-eiere minst én sprint i forkant.
* **Fallback for avhengige apper:** Hvis en app trenger statiske data i en overgangsperiode, bruk `node scripts/seed-figure-library.mjs --dry-run > figure-library.json` og del JSON-filen via Notion/Drive. Da kan appen lese fra fil midlertidig uten at API-et må mokkes manuelt.
* **Oppfølging:** Registrer en oppgave i teamets board for å bekrefte at alle apper har byttet til API-et, og kryss den av når verifisering er gjort.
