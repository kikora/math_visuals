# Math Visuals

Math Visuals er en samling digitale matematikklaboratorier utviklet for klasserom. Prosjektet springer ut av behovet for fleksible, visuelt rike representasjoner som kan tilpasses ulike undervisningssituasjoner uten å være bundet til én bestemt plattform. Repositoriet samler både selve appene og støttebibliotekene som trengs for å bygge, dele og videreutvikle disse ressursene.

## Visjon og designprinsipper

* **Tilgjengelighet og universell utforming.** Appene skal fungere med tastatur, skjermleser og høy kontrast, og alternative tekstbeskrivelser genereres automatisk der det er mulig.
* **Åpen og modulær arkitektur.** Hver modul kan brukes alene eller kombineres med andre i samme økosystem, noe som gjør det enkelt å plukke og tilpasse elementer til ulike læringsplattformer.
* **Utforskende matematikk.** Visualiseringene er bygget for å støtte samtale, hypotesetesting og resonnering heller enn forhåndsdefinerte løypeplaner.

## Arkitektur

### Statiske apper

De fleste ressursene er statiske HTML/JS/CSS-applikasjoner i rotmappen. Felles komponenter ligger i `base.css`, `router.js`, `description-renderer.js` og `vendor/`, slik at hvert verktøy kan rendres både direkte i nettleseren og som innebygde komponenter i læringsplattformer.

### Oppgavemodus (preview-only)

`task-mode.html` er en egen entry som viser oppgavemodus uten editor-UI. Den bruker den eksisterende rutingen i `router.js`, men tvinger modusen til `task` og rendrer kun iframe-innholdet. For å laste en bestemt figur kan du bruke:

* `task-mode.html?entry=graftegner&example=2` (query-parametre)
* `task-mode.html#graftegner/2` (hash)
* `task-mode.html?path=/graftegner?example=2` (direkte path-override som `router.js` allerede støtter)

Preview-only krever følgende ressurser:

* `task-mode.html` + `task-mode.js` (inngang og URL-normalisering for oppgavemodus)
* `router.js` (init og routing til riktig app/eksempel)
* `base.css` (grunnstil for bakgrunn/iframe)
* Den valgte appens egne HTML/JS/CSS-filer (f.eks. `graftegner.html` + `graftegner.js`)
* Delt logikk for oppgavebeskrivelser og preview (inkludert `examples.js`, `description-renderer.js` og nødvendige `vendor/`-biblioteker som appen allerede refererer til)

### Delte pakker

Mapper under `packages/` inneholder gjenbrukbare moduler som distribueres som både ESM og CommonJS via Rollup. Dokumentasjonen i [`docs/shared-packages.md`](docs/shared-packages.md) beskriver hvordan disse modulene organiseres, og hvordan de er tenkt brukt i og utenfor prosjektet.

### Serverløse funksjoner

`api/`-mappen rommer de serverløse handlerne som nå kjøres i AWS Lambda (via `infra/api/template.yaml`). `api/examples` er kjernen for lagrede elevprodukter og deler en lagringsmodell beskrevet i [`docs/examples-storage.md`](docs/examples-storage.md). Øvrige endepunkter forsyner appene med analyser, beskrivelser og eksportmuligheter. All ordinær trafikk går via CloudFront → API Gateway/Lambda; Vercel er avviklet og kun beholdt som nødsbackup i [`docs/vercel-backup.json`](docs/vercel-backup.json) dersom vi må spinne opp et midlertidig miljø.

## Domenespesifikke verktøy

Appene er gruppert etter matematiske hovedområder, men kan fint brukes på tvers av temaer:

* **Tallforståelse og aritmetikk** – Brøkpizza, Brøkfigurer, Brøkvegg, Figurtall, Kvikkbilder, Tenkeblokker, Tallinje, Perlesnor, Kuler, Prikk til prikk og Sortering dekker representasjoner av brøk, strukturering av tall, kombinatorikk og klassifisering.
* **Geometri, måling og visualisering** – Graftegner, nKant, Diagram, Arealmodell-serien, Trefigurer, Fortegnsskjema, Måling og SVG-arkiv utforsker koordinatsystemer, regulære figurer, datasett, flateinnhold, romgeometri og funksjonsanalyse.
* **Støtteverktøy** – Bibliotek, Settings, Alt-tekst UI, Trash archive viewer og Examples viewer gir administrativ oversikt, styring av brukerprofiler og direkte innsikt i lagrede datasett.

Flere apper har historiske eller eksperimentelle varianter som bevares side om side med hovedversjonen for å dokumentere utviklingsløp og alternative arbeidsmåter.

## Dataflyt og lagring

Eksempeltjenesten er navet som binder appene sammen. Den gjør det mulig å lagre elevprodukter, hente dem opp igjen og eksportere dem som JSON eller SVG. Distribusjonen bruker nå ElastiCache/MemoryDB for Redis og forventer `REDIS_ENDPOINT`, `REDIS_PORT` og `REDIS_PASSWORD` fra CloudFormation/SSM/Secrets Manager. Uten disse hemmelighetene faller tjenesten tilbake til et midlertidig minne som er egnet for lokale prototyper.

Detaljer om hvordan hemmelighetene hentes, injiseres og verifiseres finner du i [`docs/examples-storage.md`](docs/examples-storage.md) og [verifiseringsguiden](docs/examples-storage-verification.md). Seeding og manuell import skjer via den nye AWS-stacken – `npm run seed-examples` minner deg på hvilke `REDIS_*`-nøkler som trengs før du bruker `examples-viewer`/`scripts/check-examples-api.mjs`.

Struktur og versjonering av lagrede eksempel-JSON-er (v2) er beskrevet i [`docs/storage.md`](docs/storage.md), inkludert hvordan Map/Set/Date/RegExp blir serialisert og rehydrert når klientene henter data.

Flere funksjoner (for eksempel `api/diagram-alt-text.js` og `api/figurtall-alt-text.js`) bygger videre på de lagrede dataene for å gjøre materialet tilgjengelig i universelle utformingskontekster.

### Figurbiblioteket

`/api/figure-library` er kilden til figurbiblioteket som brukes i flere apper. For å fylle opp startdataene lokalt kan du kjøre `node scripts/seed-figure-library.mjs --dry-run` for å inspisere payloaden, deretter `node scripts/seed-figure-library.mjs` for å fylle minnelageret eller `REDIS_ENDPOINT=… REDIS_PORT=6379 REDIS_PASSWORD=… node scripts/seed-figure-library.mjs` for å skrive direkte til Redis. Se [`docs/figure-library-storage.md`](docs/figure-library-storage.md) for full oversikt over miljøvariabler, lagringsmoduser og tips til videre integrasjon.

## Teknologivalg

* **Frontend:** Vanilla HTML, CSS og JavaScript supplert med JSXGraph, MathLive og skreddersydde UI-komponenter.
* **Bygg og deling:** Rollup for pakkene i `packages/`, `npm`-skript for utvikleropplevelsen og et AWS-oppsett der statiske apper lever på S3 bak CloudFront, mens backend-endepunkter eksponeres via API Gateway og Lambda.
* **Testing og kvalitet:** Playwright-scenarier og interne verktøy i `scripts/` sikrer at appene leverer konsistent oppførsel og at API-kontraktene opprettholdes.

## Testing

* Røyktestene for figur-sidene sjekker nå at SVG-er/canvas faktisk rendrer synlig innhold uten å lagre binære snapshots. Strukturelle feil dukker opp som vanlige testfeil, og kan kjøres med `npx playwright test tests/figures-visibility.spec.js`.
* Ved behov kan man fortsatt hente fullsidig skjermbilde gjennom `attachScreenshot`-hjelperen i test-fixtures, men snapshots lagres ikke i repoet.
## Videre arbeid

Math Visuals videreutvikles i tett dialog med lærere, elever og spesialpedagoger. Nye konsepter prototypers ofte i dedikerte mapper (`old_projects/`, `kvikkbilder`, `tallinje` m.fl.) før de flyttes inn i hovedkatalogen. Prosjektet søker å balansere eksperimentell utforskning med robuste, dokumenterte verktøy, og inviterer til samskaping gjennom issues, pull requests og deling av undervisningsopplegg.

## Drift og distribusjon

Produksjonsmiljøet deployes via GitHub Actions-workflowen [`deploy-infra.yml`](.github/workflows/deploy-infra.yml). Den trigges enten manuelt (`workflow_dispatch`) eller automatisk av `push` til `main`, slik at GitHub Secrets er tilgjengelige. Workflowen kjører et enkelt `deploy-iac`-jobbløp som

- konfigurerer AWS-legitimasjon ved hjelp av OIDC-rollens ARN,
- pakker Lambda-koden (`scripts/package-api-lambda.sh`) og laster artefaktet opp i `API_ARTIFACT_BUCKET` med commit-hash i nøkkelen,
- oppdaterer datastrukturen i [`infra/data/template.yaml`](infra/data/template.yaml),
- synkroniserer `REDIS_*`-hemmelighetene inn i Secrets Manager og Systems Manager-parameterne som er definert i [`infra/shared-parameters.yaml`](infra/shared-parameters.yaml),
- ruller ut API-stacken fra [`infra/api/template.yaml`](infra/api/template.yaml) ved å sende inn `LambdaCodeS3Bucket`, `LambdaCodeS3Key`, `DataStackName` og `SharedParametersStackName`,
- henter API-endepunktet (`ApiEndpoint`-output) og injiserer domenet/stien i `infra/static-site/template.yaml`,
- kjører en helse-sjekk (`npm run check-examples-api -- --url=https://<endpoint>/api/examples`) mot det nydeployede API-et,
- oppdaterer den statiske nettsiden gjennom CloudFormation-malen [`infra/static-site/template.yaml`](infra/static-site/template.yaml),
- bygger frontendene (`npm run build`) og synkroniserer `public/` til bøtta `STATIC_SITE_BUCKET_NAME`, og
- avslutter med CloudFront-invalidering dersom distribusjons-ID er konfigurert.

Når alle stacker er oppdatert kan workflowen (valgfritt) invalidere CloudFront-distribusjonen slik at nye filer serveres umiddelbart.

For utviklingsmiljøet finnes nå en egen GitHub Actions-pipeline [`deploy-infra-dev.yml`](.github/workflows/deploy-infra-dev.yml) som kjører på `push` til `dev`. Den deployer dedikerte dev-stacker med prefiksene `math-visuals-*-dev`, bruker `API_STAGE_NAME=dev`, dev-spesifikke Redis-hemmeligheter og en egen statisk bøtte/CloudFront-distribusjon. Flyten er: push til `dev` → workflowen oppretter/oppdaterer dev-data, API og statisk side → verifiser den eksponerte CloudFront-URL-en fra `math-visuals-static-site-dev`-stacken (`CloudFrontDistributionDomainName`-outputen) → merge til `main` for produksjonsutrulling. Dev-distribusjonen bruker samme CloudFront-funksjon og cache-/origin-policy som produksjon fordi konfigurasjonen er parameterisert (bøttenavn, origin-path og prisnivå settes via secrets), og `SiteEnvironmentName`-parameteren i `infra/static-site/template.yaml` merker ressursene med riktig miljø.

Dev-URL (oppdater med domenet fra første `deploy-infra-dev`-kjøring): `https://<cloudfront-domain-for-math-visuals-static-site-dev>`.

> **Vercel er avviklet:** Produksjonen kjører nå kun i AWS (CloudFront + API Gateway/Lambda + Redis). Vercel-prosjektet er stengt, så alle nye deployer og feilrettinger må rulles ut via AWS-stackene. Sjekk `docs/examples-storage.md` hvis du trenger historikk over dekommisjoneringen eller vil bekrefte DNS-/dataflyttingen.

### Manuell opplasting

Hvis CI/CD ikke er tilgjengelig kan du følge stegene i [`docs/manual-static-deploy.md`](docs/manual-static-deploy.md) for å bygge lokalt, synkronisere `public/` til S3 og koble bøtta til CloudFront med Origin Access Control.

### Påkrevde secrets

Følgende GitHub Secrets må være definert for at workflowen skal lykkes:

| Secret | Beskrivelse |
| --- | --- |
| `AWS_REGION` | AWS-regionen alle stackene deployes i. |
| `AWS_IAC_ROLE_ARN` | ARN til IAM-rollen som Actions skal anta via OIDC. |
| `STATIC_SITE_BUCKET_NAME` | Navnet på S3-bøtta som huser de statiske filene. Prod skal bruke den eksisterende bøtta `math-visuals-static-site-796063593326-202512172100921`; workflowen faller tilbake til dette navnet hvis secret mangler, men sett gjerne secreten for å gjøre intensjonen eksplisitt. |
| `STATIC_SITE_CLOUDFRONT_DISTRIBUTION_ID` | ID til CloudFront-distribusjonen som skal invaliders etter opplasting. |
| `STATIC_SITE_API_DOMAIN` | *(Valgfritt)* Overstyr domene til API Gateway-opprinnelsen. Standardverdi hentes fra `ApiEndpoint`-outputen i API-stacken. |
| `STATIC_SITE_API_ORIGIN_PATH` | *(Valgfritt)* Overstyr origin-path (f.eks. `/prod`). Standardverdi er stien som `ApiEndpoint`-outputen returnerer. |
| `STATIC_SITE_CLOUDFRONT_PRICE_CLASS` | Prisnivå for CloudFront (`PriceClass_100`, `PriceClass_200` eller `PriceClass_All`). |
| `API_ARTIFACT_BUCKET` | S3-bøtta som inneholder det pakkede Lambda-artefaktet. |
| `API_ARTIFACT_KEY` | Objekt-nøkkel til Lambda-pakken i S3. |
| `API_ARTIFACT_VERSION` | Valgfritt objektversjon for Lambda-pakken. |
| `API_STAGE_NAME` | HTTP API-staget som skal oppdateres (for eksempel `prod`). |
| `REDIS_PASSWORD` | Passordet/autentiseringstokenet som workflowen både injiserer i datastacken (`RedisAuthToken`) og skriver til det delte Secrets Manager-navnet fra `infra/shared-parameters.yaml`. |
| `REDIS_ENDPOINT` | Redis-endepunktet som workflowen skriver til Parameter Store før API-stacken deployes. |
| `REDIS_PORT` | Redis-porten som workflowen skriver til Parameter Store før API-stacken deployes. |
| `CLOUDFRONT_INVALIDATION_PATHS` | *(Valgfritt)* Mellomromsseparert liste over stier som skal invaliders (standard `/*`). Kan overstyres ved `workflow_dispatch` med `cloudfront_invalidation_paths`-input. |

Secretsene over injiseres som miljøvariabler i de respektive deploy-stegene. Dersom `STATIC_SITE_CLOUDFRONT_DISTRIBUTION_ID` er tom hoppes invalidasjonssteget over automatisk.

Dev-workflowen speiler kravene over, men forventer dedikerte `_DEV`-hemmeligheter så dev-stacker, Redis-verdier og artefakt-bøtter holdes adskilt fra produksjon:

| Secret | Beskrivelse |
| --- | --- |
| `AWS_REGION_DEV` | Region for dev-stakkene. |
| `AWS_IAC_ROLE_ARN_DEV` | IAM-rollen som OIDC-oppsettet antar for dev-miljøet. |
| `STATIC_SITE_BUCKET_NAME_DEV` | S3-bøttenavn for dev-nettsiden. |
| `STATIC_SITE_CLOUDFRONT_DISTRIBUTION_ID_DEV` | Dev-distribusjonens ID (brukes for invalidasjon). |
| `STATIC_SITE_API_DOMAIN_DEV` | *(Valgfritt)* Overstyr API-domene for dev. |
| `STATIC_SITE_API_ORIGIN_PATH_DEV` | *(Valgfritt)* Overstyr origin-path for dev (f.eks. `/dev`). |
| `STATIC_SITE_CLOUDFRONT_PRICE_CLASS_DEV` | Prisnivå for dev-distribusjonen (standard `PriceClass_100`). |
| `API_ARTIFACT_BUCKET_DEV` | Bøtten der dev-Lambda-artefaktet lastes opp. |
| `API_ARTIFACT_KEY_DEV` | Nøkkel prefiks for dev-Lambda-artefaktet. |
| `API_STAGE_NAME_DEV` | HTTP API-staget for dev (standard `dev`). |
| `REDIS_PASSWORD_DEV` | Dev-passordet som brukes både for Secrets Manager og data-stacken. |
| `REDIS_ENDPOINT_DEV` | Redis-endepunkt for dev som skrives til Parameter Store før API-deploy. |
| `REDIS_PORT_DEV` | Redis-porten for dev. |
| `CLOUDFRONT_INVALIDATION_PATHS_DEV` | *(Valgfritt)* Dev-invalideringsstier (standard `/*`). |

Se også den dedikerte veiledningen i [`docs/github-actions-setup.md`](docs/github-actions-setup.md) for en komplett gjennomgang av hvordan du aktiverer Actions, oppretter OIDC-rollen i AWS og verifiserer at workflowene kjører som forventet.

## Drift og feilsøking

Se [docs/redis-troubleshooting.md](docs/redis-troubleshooting.md) for Redis/Lambda 503- og WRONGPASS-feilsøking fra CloudShell.

### CloudShell-sjekk av produksjons-backend

Skriptet `scripts/cloudshell-prod-backend-check.sh` gjør en rask sanity check mot eksempeltjenesten i produksjon.

Standardendepunktet er `https://d1vglpvtww9b2w.cloudfront.net/api/examples`, men du kan overstyre det med flagg eller miljøvariabel.

```bash
# Standard prod-sjekk
./scripts/cloudshell-prod-backend-check.sh

# Overstyr URL via flagg
./scripts/cloudshell-prod-backend-check.sh --url https://<annet-endepunkt>/api/examples

# Overstyr via miljøvariabel
API_URL=https://<annet-endepunkt>/api/examples ./scripts/cloudshell-prod-backend-check.sh
```

Forventet output viser først HTTP-status fra en enkel curl-test, deretter resultatet fra `npm run check-examples-api`. Eksempel:

```
Kjører helsesjekk mot https://d1vglpvtww9b2w.cloudfront.net/api/examples ...
✅ Endepunktet svarte med status 200. Kjører detaljert API-sjekk ...
Sjekker https://d1vglpvtww9b2w.cloudfront.net/api/examples ...
✅ Fikk 2 post(er). Lagres i varig lagring (KV).
✅ Prod-backend ser frisk ut.
```
