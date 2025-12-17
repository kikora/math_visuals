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
- `deploy-infra.yml` kan nå opprette data-stacken automatisk hvis `USE_EXTERNAL_REDIS` **ikke** er satt til `true` og stacken mangler. Legg til GitHub-secreten `REDIS_PASSWORD` med Redis-passordet som ren tekst; workflowen sender den direkte inn i CloudFormation som `RedisAuthToken` og lar malen skrive verdien til Secrets Manager.
- Når `USE_EXTERNAL_REDIS=true`, speil Redis/VPC-verdier inn i GitHub-secrets slik at `math-visuals-shared` kan publisere eksportene API-stacken trenger:
  - `REDIS_ENDPOINT` (writer-endpoint eller hostname)
  - `REDIS_PORT` (heltall som streng)
  - `REDIS_PASSWORD_SECRET_ARN` (ARN eller navn på Secrets Manager-secret med Redis-passordet)
  - `PRIVATE_SUBNET_1_ID` / `PRIVATE_SUBNET_2_ID` (subnets for Lambda)
  - `LAMBDA_SECURITY_GROUP_ID` (security group for Lambda mot VPC)
  Disse verdiene skrives til SSM/Secrets Manager via `infra/shared-parameters.yaml` og eksporterer navnene API-stacken bruker.

Ekstern Redis (hopper over datastack/secret-sync):
- Sett GitHub-secreten `USE_EXTERNAL_REDIS=true` for å hoppe over "Deploy data stack" i `deploy-infra.yml`. Resterende API/static deploy-steg kjører som før.
- `math-visuals-shared` eksporterer nå VPC/Redis-parameter- og secret-navnene når du setter hemmelighetene over. Sørg for at SSM-parameterne `/math-visuals/<env>/redis/endpoint`, `/math-visuals/<env>/redis/port`, `/math-visuals/<env>/network/private-subnet-1-id`, `/math-visuals/<env>/network/private-subnet-2-id`, `/math-visuals/<env>/network/lambda-security-group-id` og Secrets Manager-secretet `math-visuals/<env>/redis/password` (JSON med `{"authToken":"<pass>"}`) enten eksisterer fra før eller kan opprettes av stacken.

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
- Legg til GitHub environment secrets/variables for `PRIVATE_SUBNET_1_ID`, `PRIVATE_SUBNET_2_ID`, `LAMBDA_SECURITY_GROUP_ID`, `REDIS_ENDPOINT`, `REDIS_PORT` og `REDIS_PASSWORD_SECRET_ARN` når du bruker ekstern Redis. Stacken `math-visuals-shared` skriver disse verdiene til SSM/Secrets Manager og eksporterer navnene (`<stack>-PrivateSubnet1Id`, `<stack>-PrivateSubnet2Id`, `<stack>-LambdaSecurityGroupId`, `<stack>-RedisEndpointParameterName`, `<stack>-RedisPortParameterName`, `<stack>-RedisPasswordSecretName`).
- Kjør/oppdater `infra/shared-parameters.yaml` med korrekt `EnvironmentName` slik at SSM-parameterne `/math-visuals/<env>/redis/endpoint` og `/math-visuals/<env>/redis/port` samt Secrets Manager-secretet `math-visuals/<env>/redis/password` (JSON `{\"authToken\":\"<redis-password\"}`) peker til den eksterne serverless Redis-instansen. Se samme sjekkliste for forventede navn.
- Workflowen bruker automatisk `math-visuals-shared` som `DataStackName` og setter `ResolveNetworkFromParameters=true` når `USE_EXTERNAL_REDIS=true`, slik at VPC-eksportene tolkes som SSM-parameternavn og løses til faktiske subnet/security group-ID-er (unngår Lambda CREATE_FAILED-feilen med `/math-visuals/.../network/*` i `VpcConfig`).
- Når `math-visuals-shared` eksporterer VPC-parameternavn (enten fordi `USE_EXTERNAL_REDIS=true` eller fordi subnet/security group-ID-er kommer inn som SSM-parameterverdier), må `ResolveNetworkFromParameters=true` settes slik at Lambda ser faktiske subnet/SG-ID-er i `VpcConfig` i stedet for `[placeholder]`-verdier.
- Bekreft i CloudFormation-eksportene for `math-visuals-shared` (f.eks. `math-visuals-shared-RedisEndpointParameterName`) at parameter-/secret-navnene matcher outputene fra `infra/shared-parameters.yaml` før du kjører `deploy-infra.yml`; API-stacken kan da importere både nettverket og Redis-tilkoblingsverdiene uten å provisjonere ny Redis. Workflowen feiler nå tidlig om eksportene `...-PrivateSubnet1Id`, `...-PrivateSubnet2Id`, `...-LambdaSecurityGroupId`, `...-RedisEndpointParameterName`, `...-RedisPortParameterName` eller `...-RedisPasswordSecretName` mangler.
