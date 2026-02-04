# CloudShell verification runbook entry

## Sist oppdatert
- **Timestamp (UTC):** 2025-11-23
- **Status:** Verifikasjonen kunne ikke kjøres fordi `aws`-CLI ikke er installert i dette miljøet. Prøv igjen i CloudShell eller installer AWS CLI lokalt før du følger stegene under.

## Logggrupper som skal brukes
- **API Lambda:** `/aws/lambda/math-visuals-api` (eksporteres som `ApiFunctionLogGroupName` i `infra/api/template.yaml`). `scripts/cloudshell-verify.sh` bruker dette som standard og forsøker også å slå opp funksjonsnavnet via `ApiFunctionArn` for å bekrefte riktige stream-er.
- **HTTP API access logs:** `/aws/apigateway/<HTTP-API-ID>-access` (eksporteres som `ApiAccessLogGroupName`). Stage-konfigurasjonen skriver JSON-linjer med `requestId`, `status`, `routeKey` og `errorMessage`, slik at 5xx kan måles med et metric filter.

Kjør `bash scripts/cloudshell-verify.sh --region eu-west-1 --api-stack math-visuals-api --data-stack math-visuals-data` fra CloudShell. Skriptet viser hvilken logggruppe som tailes i oppsummeringen (`LOG_GROUP=...`) og bruker `aws cloudwatch logs tail` eller `aws logs tail` i 15 minutter tilbake i tid. Om det ikke finner streams, sett `--log-group=/aws/lambda/math-visuals-api` manuelt.

## Metric filters og tilhørende alarmer
- **Redis KV mangler:** Metric filter `RedisKvMissingMetricFilter` matcher `"Redis KV is not configured"` i Lambda-loggene og oppdaterer metrikken `MathVisuals/API:RedisKvMissingCount`. Alarmen `RedisKvMissingAlarm` (SNS/PagerDuty) fyrer ved >0 treff.
- **Redis auth-feil:** Metric filter `RedisWrongPassMetricFilter` matcher `"WRONGPASS"` og driver `MathVisuals/API:RedisWrongPassCount`. Alarmen `RedisWrongPassAlarm` fyrer ved >0 treff.
- **Redis PING feilet:** Metric filter `RedisPingFailureMetricFilter` matcher `"Redis PING"` som ikke inneholder `"PONG"` og teller `MathVisuals/API:RedisPingFailureCount`. Alarmen `RedisPingFailureAlarm` fyrer ved første PING-feil observert i Lambda-loggene.
- **HTTP 5xx:** Access-loggene har JSON-feltet `status`; `ApiGateway5xxMetricFilter` teller `MathVisuals/API:Api5xxCount` når status >= 500. Alarmen `ApiGateway5xxAlarm` fyrer på første 5xx.
- **CloudShell PING:** `scripts/cloudshell-verify.sh` publiserer `MathVisuals/Verification:RedisPingStatus` (1 = PONG, 0 = feilet) når Redis-PING steget kjøres. `CloudshellRedisPingAlarm` fyrer når verdien er < 1. Manglende datapunkter behandles som «ikke brudd» slik at alarmen bare reagerer når skriptet faktisk kjøres.

Alle alarmene sender varsler til SNS/PagerDuty-destinasjonen som angis via parameteren `AlarmTopicArn`. Dersom parameteren er tom opprettes `math-visuals-api-alarms-<stage>` automatisk; legg til e-post eller PagerDuty-webhook som abonnement.

## Operativ prosedyre for logg-tailing
1. Kjør `aws sso login` i CloudShell og bytt til riktig region (`export AWS_REGION=eu-west-1`).
2. Start verifikasjonen: `bash scripts/cloudshell-verify.sh --region eu-west-1 --api-stack math-visuals-api --data-stack math-visuals-data`.
3. Bekreft at oppsummeringen viser `LOG_GROUP=/aws/lambda/math-visuals-api` og at tail-steget skriver ut logglinjer med `mode: "kv"` eller eventuelle Redis-advarsler.
4. For manuell tailing kan du kjøre `aws cloudwatch logs tail /aws/lambda/math-visuals-api --since 15m --region eu-west-1 --format short` (CLI v2) eller `aws logs tail ...` (CLI v1). For HTTP 5xx, kjør `aws cloudwatch logs tail /aws/apigateway/<HTTP-API-ID>-access --since 15m --region eu-west-1` og filtrer på `"status":5`.

## Alarmrespons
1. **Alarm mottatt:** Noter hvilket alarmnavn som fyrte og hvilken metrikknavn/dimensjon som er berørt.
2. **Logganalyse:** Bruk logggruppen over som korrelasjon. For `ApiGateway5xxAlarm` hent `requestId` fra access-loggen og søk etter samme ID i Lambda-loggen for feildetaljer.
3. **Redis-auth eller -konfig:** Hvis alarmen er `RedisKvMissingAlarm` eller `RedisWrongPassAlarm`, sjekk Secrets Manager/SSM-verdiene (`REDIS_ENDPOINT`, `REDIS_PORT`, `REDIS_PASSWORD`) mot data-stacken og kjør `bash scripts/cloudshell-verify.sh --trace` for å se `Redis PING`-resultatet og republish metrikken.
4. **Redis PING-feil i Lambda:** Hvis `RedisPingFailureAlarm` fyrer, finn PING-logglinjen i Lambda-logggruppen for konteksten (nettverksfeil, AUTH, timeouts). Bekreft at Redis-endepunktet svarer fra Lambda VPC-en ved å kjøre `cloudshell-verify.sh` (som også sender ny `RedisPingStatus`) og kontroller at Secrets Manager-tokenet er gyldig.
5. **5xx-feil:** Hvis `ApiGateway5xxAlarm` fyrer uten Redis-feil, sjekk applikasjonsloggene for `statusCode: 5xx` eller stakktrace. Bekreft at CloudFront peker til riktig API-url og at Redis er tilgjengelig.
6. **Tilbakestill alarm:** Etter utbedring, kjør `scripts/cloudshell-verify.sh` igjen for å få `RedisPingStatus=1` og bekrefte at loggene viser «kv»-modus. Lukk tilhørende hendelse i PagerDuty/SNS.

## CloudShell-oppdatering av Lambda-miljø via filreferanse
Bruk denne oppskriften når `NEW_ENV` allerede inneholder hele miljøblokken (inkludert CORS-variablene) og du må oppdatere Lambdaen uten å lime inn JSON manuelt:

1. Materialiser miljøblokken til en midlertidig fil i CloudShell:

   ```bash
   TMP_ENV=$(mktemp)
   echo "$NEW_ENV" > "$TMP_ENV"
   ```

2. Oppdater API-funksjonen med filreferansen slik at Lambdaen får `mode="kv"` og beholder CORS-variablene du la inn i `NEW_ENV`:

   ```bash
   aws lambda update-function-configuration \
     --region eu-west-1 \
     --function-name "$API_FN" \
     --environment "Variables=file://$TMP_ENV"
   ```

3. Rydd opp og verifiser at miljøet ble brukt:

   ```bash
   rm -f "$TMP_ENV"
   bash ./cloudshell-verify.sh --trace
   ```

   Bekreft i utskriften at `/api/examples` returnerer `mode="kv"` og at CORS-variablene (for eksempel `EXAMPLES_ALLOWED_ORIGINS`, `SVG_ALLOWED_ORIGINS` eller `FIGURE_LIBRARY_ALLOWED_ORIGINS`) fortsatt er til stede.
