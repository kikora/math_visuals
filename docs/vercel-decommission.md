# Vercel-dekommisjonering

Denne runbooken dokumenterer hvordan vi gjør en full avvikling av Vercel-miljøene for `math_visuals`. Oppgavene må utføres med tilgang til de eksterne tjenestene (AWS, Vercel og DNS-provider). I dette repoet er ingen av operasjonene automatisert, så status må bekreftes manuelt.

> **Status:** Vercel-prosjektet er nå lukket; AWS (CloudFront + API Gateway/Lambda + Redis) er eneste operative miljø. Behold runbooken for revisjonsspor og for å kunne bekrefte tidligere DNS-/dataflytting. Konfigurasjonen for et midlertidig Vercel-miljø er arkivert som backup i [`docs/vercel-backup.json`](vercel-backup.json) – den distribueres ikke automatisk.

## 1. Verifiser CloudFront-produksjon
- Finn produksjonsdistribusjonen (se `infra`/Terraform eller AWS-kontoens CloudFront-konsoll) og noter domenet.
- Kall `https://<cloudfront-domenet>/api/examples` og bekreft at JSON-feltet `mode` er `kv` eller at headeren `X-Examples-Store-Mode` reflekterer KV-lager. En rask måte er `curl -i "https://<cloudfront-domenet>/api/examples"`.

## 2. Eksporter resterende Vercel-data
- Dersom det finnes data igjen i Vercel sitt examples-API, hent dem før sletting:
  - Bruk `examples-viewer`-verktøyet (lokalt: `npm run examples-viewer -- --url=https://<vercel-app>/api/examples`).
  - Eller hent direkte med `curl "https://<vercel-app>/api/examples?path=<sti>"` for relevante paths.
- Lagre dataene i et trygt sted (f.eks. `docs/examples-seed.sample.json`) før du fortsetter.

## 3. Rydd opp i Vercel
- Logg inn i Vercel-konsollen for prosjektet.
- Fjern Upstash-integrasjonen under "Integrations".
- Slett Upstash KV-databasen via Vercel UI når integrasjonen er fjernet.
- Slett selve Vercel-prosjektet når alle data er eksportert.

## 4. DNS-opprydding og 404-verifisering
- Fjern eller oppdater DNS-poster som peker til `*.vercel.app` eller `*.vercel-storage.com` (inkluderer CNAME/ALIAS). Bruk DNS-providerens UI eller IaC-repo om de er kodet der.
- Etter propagasjon, bekreft at de gamle Vercel-URL-ene gir HTTP 404 ved `curl -I https://<gammelt-subdomene>.vercel.app`.

## 5. Dokumentasjon og interessenter
- Oppdater intern dokumentasjon (som denne runbooken) med dato/ansvarlig og status for hvert steg.
- Send melding i relevante kanaler (Slack/e-post) om at Vercel er dekommisjonert og at trafikk går via CloudFront.

> **Merk:** Ingen av trinnene over kan kjøres fra dette repo-miljøet. Utfør dem i de respektive konsollene og noter resultatene i en driftslogg.

## Statusnotat 2025-11-23

- **CloudFront-domene:** `d1vglpvtww9b2w.cloudfront.net` (fra `math-visuals-static-site`-stacken).
- **Mode-kontroll:** Forsøk på `curl -i https://d1vglpvtww9b2w.cloudfront.net/api/examples` (og mot `mathvisuals.no`/`app.mathvisuals.no`) feilet fra dette miljøet med `CONNECT tunnel failed, response 403` via den obligatoriske proxien. Kjør samme kommando fra et nettverk med direkte utgang for å bekrefte at `mode: "kv"` returneres.
- **Vercel:** Miljøet er stengt/dekommisjonert; AWS/CloudFront er eneste kilde som skal betjene `/api/examples`.
- **Varsling:** Del følgende i Slack-kanalen for math_visuals/infra: _"CloudFront `d1vglpvtww9b2w.cloudfront.net` er aktiv kilde for `/api/examples`. Vercel er stengt, så all trafikk skal gå via AWS. Curl-verifikasjon fra sandbox ble blokkert av proxy (403 CONNECT), vennligst dobbeltsjekk fra et nettverk med direkte utgang."_
