# Post-mortem: Migrering til AWS og feilretting av Math Visuals

**Dato:** 27. november 2025  \
**Mål:** Flytte løsningen fra Vercel til AWS (CloudFront, S3, API Gateway, Lambda, ElastiCache Redis) og sikre stabil, persistent lagring av eksempler.

## 1. Frontend: håndtering av "Memory Mode"
**Problem:** Frontend viste feilmeldingen "Eksempeltjenesten mangler" selv om backend svarte 200 OK. Koden tolket `store_mode: memory` som en feil.

**Løsning:**
- Oppdaterte `examples.js` (`loadExamplesFromBackend` og `performBackendSync`).
- Godtar nå 200 OK som "Available" uavhengig av lagringsmodus.
- Viser en advarsel ("Midlertidig lagring") i stedet for en blokkerende feilmelding.

## 2. Database: Redis-autentisering og nettverk
**Problem:** Backend klarte ikke å koble til Redis og falt tilbake til minne-modus.

**Årsaker og løsninger:**
- **Passordfeil:** Secrets Manager-verdien inneholdt et skjult linjeskift (`\n`).
  - La til `.trim()` i `api/_lib/kv-client.js` for å vaske passordet.
- **Nettverk (Security Groups):** Lambda nådde ikke Redis.
  - Opprettet/verifiserte inbound-rule i Redis SG for port 6379 fra Lambdaens SG.

## 3. Logikk: lagring av eksempler (path mismatch)
**Problem:** Eksempler ble lagret, men listen var tom etter refresh. Appen lagret under hele stien (f.eks. `/nkant/eksempel1`), mens listen hentet fra roten (`/nkant`).

**Løsning:**
- Oppdaterte `api/_lib/examples-store.js` med `stripTrailingExampleSegment` som normaliserer stien (fjerner `/eksempelX`).
- Alle eksempler lagres nå i samme "mappe" i Redis og blir hentet korrekt.

## 4. CI/CD: GitHub Actions og CloudFormation
**Problem:** Deployment feilet, så ny kode nådde ikke produksjon.

**Årsaker og løsninger:**
- **IAM-rettigheter:** GitHub Actions manglet tilgang til CloudFront/S3-policies.
  - Utvidet `MathVisualsGithubDeployDeploymentPolicy` (bl.a. `s3:PutBucketPolicy`, `cloudfront:*Function`).
- **CloudFront ugyldig input:** Feil `OriginPath` verdi.
  - `deploy-infra.yml` sender nå tom streng (`""`) når API-et ligger på roten.
- **Låst stack:** CloudFormation satt i `UPDATE_ROLLBACK_FAILED`.
  - Utførte manuell "Continue update rollback" i AWS Console.

## 5. Routing: CloudFront-miskonfigurasjon (root cause for HTML-respons)
**Problem:** API-kall returnerte HTML (forsiden) i stedet for JSON; `Server: AmazonS3` viste at trafikken gikk feil.

**Årsaker og løsninger:**
- **Regelprioritet:** `/api/*` lå under default eller manglet.
  - Oppdaterte `infra/static-site/template.yaml` og script for å plassere `/api/*` øverst.
- **Origin loop (kritisk):** `ApiGatewayOrigin` pekte til CloudFront-distribusjonen (d1vgl...cloudfront.net) i stedet for API Gateway.
  - Oppdaterte origin i AWS Console til `f1c9mggyqh.execute-api.eu-west-1.amazonaws.com`.

## Status nå
- ✅ Frontend: Laster uten feilmeldinger.
- ✅ Backend: Kjører på AWS Lambda og svarer med JSON.
- ✅ Database: Koblet til ElastiCache (Redis) med TLS.
- ✅ Lagring: Oppretting og oppdatering av eksempler fungerer og er persistent.
- ✅ CI/CD: Pipeline er grønn og deployer korrekt.

Vi har nå en fullt fungerende, serverless arkitektur på AWS! 🚀
