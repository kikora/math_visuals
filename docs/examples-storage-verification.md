# Eksempellager-verifisering

Denne filen beskriver hvordan du kan verifisere lagringsmodusen for `/api/examples` i et distribuert miljø.

1. **Bekreft minnelager:**
   - Kjør `npm run check-examples-api -- --url=https://<ditt-domene>/api/examples`.
   - Eller send en GET-forespørsel til `https://<ditt-domene>/api/examples/trash`.
   - Kontroller at responsheaderen `X-Examples-Store-Mode` og JSON-feltet `mode` returnerer `memory`.
2. **Sett Redis-hemmeligheter:**
   - Bruk CloudFormation-outputsene beskrevet i `docs/examples-storage.md`/`infra/data/README.md` til å hente `REDIS_ENDPOINT`, `REDIS_PORT` og `REDIS_PASSWORD` via SSM + Secrets Manager.
   - Injiser verdiene i Lambda/GitHub Secrets (eller eksporter dem lokalt) og redeploy API-stacken. `npm run seed-examples` minner deg på hvilke nøkler som mangler dersom noe er glemt.
3. **Bekreft Redis-lager:**
   - Kjør `npm run check-examples-api -- --url=https://<ditt-domene>/api/examples` igjen (etter redeploy).
   - GET-forespørsler mot `https://<ditt-domene>/api/examples/trash` skal nå vise `mode`/`storage` som `kv`.
   - Slettede eksempler skal forbli arkivert selv om du oppdaterer siden, ettersom de ligger i Redis-lageret.

> **Merk:** Disse trinnene krever tilgang til produksjonsdistribusjonen. I dette repo-miljøet finnes ingen deployet back-end eller tilhørende miljøvariabler, så testene må kjøres mot den faktiske produksjonsdomenet.
