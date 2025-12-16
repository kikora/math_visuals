# Deployment attempt notes

- Attempted to follow CloudShell deployment steps for static site and API distribution.
- Installed AWS CLI locally via `pip` because the binary was missing in the environment.
- Could not retrieve AWS account ID or proceed with stack lookups/deployment because AWS credentials are not configured in this environment (the AWS CLI reported `Unable to locate credentials`).
- No CloudFormation deployment or CloudFront verification was executed.

To continue, configure AWS credentials (e.g., via `aws configure`, environment variables, or an injected credentials profile) and rerun the commands from the instructions.

Redis/Lambda note:
- `scripts/configure-lambda-redis.sh` merges the current Lambda environment from `get-function-configuration` with Redis variables instead of overwriting it, so reruns should not drop unrelated configuration.

CloudShell one-liner for GitHub Actions deploy-rollen:
- Fra CloudShell kan rollen opprettes/oppdateres med én kommando (bruker standard repo/branch autodeteksjon):

```
cd math_visuals && ./scripts/cloudshell-create-oidc-role.sh
```

Dev-miljø:
- `deploy-infra-dev.yml` kjører automatisk på `push` til `dev` og oppretter dev-stakkene `math-visuals-data-dev`, `math-visuals-api-dev` og `math-visuals-static-site-dev` med egne secrets/bøtter.
- Hent CloudFront-domenet fra `CloudFrontDistributionDomainName`-outputen på `math-visuals-static-site-dev` etter første kjøring og oppdater README (dev-URL-feltet) slik at teamet vet hvor de kan teste endringene før merge til `main`.

Redis/Vercel KV for `api/examples` (prod):
- Sørg for at produksjonsmiljøet har Redis-variablene satt: `REDIS_ENDPOINT`/`REDIS_HOST`, `REDIS_PORT` og `REDIS_PASSWORD` (evt. `REDIS_URL` om Vercel KV gir én streng). For Vercel kan de legges til med `vercel env add REDIS_URL --environment=production` eller ved å bruke `REDIS_ENDPOINT`/`REDIS_PORT`/`REDIS_PASSWORD` via dashboardet. I AWS/CI-verdikjeden speiles de som GitHub Action-secrets slik at `deploy-infra.yml` kan injisere verdiene i Lambda-miljøet.
- Kjør en ny produksjonsdeploy (GitHub Actions `deploy-infra.yml` eller manuell `aws cloudformation deploy` + artefakt-opplasting). Når Lambda starter opp igjen skal `X-Examples-Store-Mode`-headeren fra `GET https://<api-host>/examples` rapportere `kv` i stedet for `memory`.
- Valider at lagringen er persistent: opprett et eksempel via POST mot `https://<api-host>/examples` (bruk liten payload), noter `path`, kjør et kontrollert restart av funksjonen (f.eks. `aws lambda update-function-configuration --function-name math-visuals-api --description "force restart"` eller kjør en ny deploy) og slå opp `GET /examples?path=<path>` etterpå. Payloaden skal fremdeles finnes, og responsen skal ha `X-Examples-Store-Mode: kv`.

Datastack-provisjonering fra GitHub Actions:
- `deploy-infra.yml` kan nå opprette data-stacken automatisk hvis `USE_EXTERNAL_REDIS` **ikke** er satt til `true` og stacken mangler. Legg til GitHub-secreten `DATA_REDIS_AUTH_TOKEN_SECRET_ARN` med ARN-en til en Secrets Manager-secret som lagrer Redis-auth-tokenet som ren tekst; workflowen bruker en dynamisk referanse `{{resolve:secretsmanager:<arn>:SecretString}}` for å sende verdien inn i CloudFormation uten å logge tokenet.

Ekstern Redis (hopper over datastack/secret-sync):
- Sett GitHub-secreten `USE_EXTERNAL_REDIS=true` for å hoppe over "Deploy data stack" og "Sync shared Redis connection parameters" i `deploy-infra.yml`. Resterende API/static deploy-steg kjører som før.
- `DATA_STACK_NAME` må fortsatt peke på en stack som eksporterer VPC/subnet/security group-ressurser og Redis-parameter-/secret-navnene som API-malen forventer (f.eks. en eksisterende `math-visuals-data`).
- Sørg for at SSM-parameterne og Secrets Manager-secretet finnes med navnene fra `infra/shared-parameters.yaml`: `/math-visuals/<env>/redis/endpoint` (writer-endpoint), `/math-visuals/<env>/redis/port` og `math-visuals/<env>/redis/password` (JSON med `{"authToken":"<pass>"}`). Når disse finnes trenger ikke workflowen å skrive Redis-hemligheter selv.

Feilsøking: Bygg som ser ut til å loope
- En «loop» i Vercel/CI-loggene (f.eks. gjentatte linjer om `palette/palette-config.js`) skyldes vanligvis at vår build-kommando (`npm run build` i `package.json`) regenererer filer hver gang den kjøres: `scripts/build-figure-manifests.mjs` lager manifestfiler under `images/`, `npm run build --workspaces` bygger pakkene i `packages/*`, og `scripts/create-public.js` sletter og kopierer hele prosjektet inn i `public/`. Når samme build-kommando kjøres både som install/postinstall og som eksplisitt build-steg vil loggen se ut som en loop selv om den egentlig bare kjører to ganger.
- Sørg for at Vercel/CI kun kjører `npm run build` én gang (typisk kun i Build-steget) og at `npm ci` eller tilsvarende ikke har ekstra hooks som trigges automatisk. Hvis du ser en loop, sjekk først at Build-kommandoen ikke er konfigurert både som install- og build-steg.

CloudFront/ApiGateway origin-konfigurasjon (prod)
- `ApiGatewayOrigin` henter nå API Gateway-domenet fra parameteren `ApiGatewayDomainName` (lagt inn som GitHub-secret). `OriginPath` er fortsatt satt til `/prod` i malen.
- Bakgrunn: det faste `/prod`-prefikset hindrer at CloudFront prøver å rute til seg selv og returnerer HTML-fallbacken i stedet for API-svarene.

Etter-deploy sjekkliste (for å fange drift i scripts/maler)
1. Åpne CloudFront-konsollet → velg produksjonsdistribusjonen → fanen «Origins» → klikk `ApiGatewayOrigin`.
2. Bekreft at **Origin domain** matcher verdien som ble gitt i `ApiGatewayDomainName` (GitHub-secret brukt av deploy-pipelinen) og at **Origin path** er `/prod`.
3. Lagre/avbryt uten å endre noe. Hvis verdiene avviker, oppdater malen/scriptet før ny deploy for å hindre regressjon.

Ekstern Redis sjekkliste (bruk eksisterende datastack + delte parametre):
- Sett GitHub-secret `USE_EXTERNAL_REDIS=true` så data-stacken og parameter-sync hoppes over i `deploy-infra.yml`.
- Legg til GitHub environment secret/variable `DATA_STACK_NAME` (Settings → Environments → Production) som peker på datasstacken som allerede eksporterer VPC-ressursene (`...-PrivateSubnet1Id`, `...-PrivateSubnet2Id`, `...-LambdaSecurityGroupId`). Redis-parameter-navnene skal eksporteres fra datasstacken (ikke legges som GitHub-secrets) slik at workflowen kan importere dem direkte.
- Kjør/oppdater `infra/shared-parameters.yaml` med korrekt `EnvironmentName` slik at SSM-parameterne `/math-visuals/<env>/redis/endpoint` og `/math-visuals/<env>/redis/port` samt Secrets Manager-secretet `math-visuals/<env>/redis/password` (JSON `{\"authToken\":\"<redis-password\"}`) peker til den eksterne serverless Redis-instansen. Se samme sjekkliste for forventede navn.
- Bekreft i CloudFormation-eksportene for datasstacken (f.eks. `math-visuals-data-RedisEndpointParameterName`) at parameter-/secret-navnene matcher outputene fra `infra/shared-parameters.yaml` før du kjører `deploy-infra.yml`; API-stacken kan da importere både nettverket og Redis-tilkoblingsverdiene uten å provisjonere ny Redis. Workflowen feiler nå tidlig om eksportene `...-PrivateSubnet1Id`, `...-PrivateSubnet2Id`, `...-LambdaSecurityGroupId`, `...-RedisEndpointParameterName`, `...-RedisPortParameterName` eller `...-RedisPasswordSecretName` mangler.
