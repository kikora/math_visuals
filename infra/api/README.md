# API infrastructure

Dette kataloget inneholder en AWS SAM-mal som oppretter en Node.js 18 Lambda-funksjon og eksponerer den via en HTTP API (API Gateway). Lambdaen bruker `@vendia/serverless-express` til å montere alle handlerne i [`api/`](../../api), slik at eksisterende Vercel-endepunkter kan kjøres uendret i AWS.

## Hva malen oppretter

- IAM-rolle med CloudWatch-loggføring og leseadgang til Secrets Manager og Parameter Store.
- Lambda-funksjon som kjører `infra/api/runtime/index.js` (aggregerer alle `/api`-ruter).
- API Gateway HTTP API med `ANY`-ruter for `/api/examples`, `/api/examples/{proxy+}`,
  `/api/svg/raw`, `/api/figure-library/raw`, `/svg`, `/svg/{proxy+}`, `/bildearkiv`,
  `/bildearkiv/{proxy+}`, `/figure-library` og `/figure-library/{proxy+}` slik at
  vennlige URL-er treffer samme Lambda som `/api`-endepunktene.
- CORS-oppsett som tillater at `Access-Control-Allow-*`-headerne som settes i handlerne videreformidles til klientene.

## Pakking av Lambda-koden

Lambda-artefakten består av tre deler: runtime-filen (`infra/api/runtime/index.js`), `api/`-mappen og avhengighetene som er definert i `infra/api/lambda/package.json`. Følgende skript viser hvordan du kan produsere en zip-fil klar for opplasting til S3:

```bash
# Installer bare produksjonsavhengighetene for Lambda-runtime
npm ci --omit=dev --prefix infra/api/lambda

# Bygg en isolert mappe med runtime, avhengigheter og api/
rm -rf infra/api/build
mkdir -p infra/api/build/palette
# Inkluderer hele `palette/` slik at `palette-config.js` og hjelpetjenestene er tilgjengelige i `/var/task/palette/`
cp infra/api/runtime/index.js infra/api/build/index.js
cp infra/api/lambda/package.json infra/api/build/package.json
cp infra/api/lambda/package-lock.json infra/api/build/package-lock.json 2>/dev/null || true
cp -R infra/api/lambda/node_modules infra/api/build/node_modules
rsync -a --exclude 'node_modules' api/ infra/api/build/api/
rsync -a palette/ infra/api/build/palette/

# Verifiser at `palette-config.js` ble kopiert
test -f infra/api/build/palette/palette-config.js

# Lag en zip som kan lastes opp til S3
cd infra/api/build
zip -r ../api-lambda.zip .
cd -
```

Disse stegene finnes også automatisert i `scripts/package-api-lambda.sh`, som brukes til å produsere en zip hvor `palette/`-mappen alltid er inkludert.

### Preflight: bekreft at artefakten er tilgjengelig i S3

1. Last opp `infra/api/api-lambda.zip` til ønsket S3-bucket og nøkkel.
2. Kjør deretter `head-object` på nøkkelen for å bekrefte at artefakten (og
   ev. versjonen) finnes:

   ```bash
   aws s3api head-object \
     --bucket <artefakt-bucket> \
     --key <sti>/api-lambda.zip [--version-id <versjon-id>]
   ```

   Hvis `head-object` feiler på grunn av ugyldig bøtte-/nøkkel-/versjons-
   kombinasjon, vil CloudFormation stoppe med
   `AWS::EarlyValidation::ResourceExistenceCheck`.
3. Ikke inkluder `LambdaCodeS3ObjectVersion` i `--parameter-overrides` før
   `head-object` returnerer suksess for versjonen du planlegger å bruke. En
   utdatert `LambdaCodeS3ObjectVersion` kan hindre opprettelse av
   endringssett.

Når `head-object` validerer artefakten, bruk CloudFormation/SAM til å deploye.
SAM-transformasjonen krever `CAPABILITY_AUTO_EXPAND` når stacken oppdateres:

```bash
aws s3 cp infra/api/api-lambda.zip s3://<artefakt-bucket>/<sti>/api-lambda.zip

aws cloudformation deploy \
      --stack-name math-visuals-api \
      --template-file infra/api/template.yaml \
      --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
      --parameter-overrides \
          LambdaCodeS3Bucket=<artefakt-bucket> \
          LambdaCodeS3Key=<sti>/api-lambda.zip \
          LambdaSecurityGroupIdOverride="" \
          StageName=prod \
          DataStackName=math-visuals-data \
          SharedParametersStackName=math-visuals-shared \
          LambdaCodeS3ObjectVersion=""

# Hvis du bruker versjonerte objekter i S3 kan du sette `LambdaCodeS3ObjectVersion`
# etter at `head-object` har bekreftet nøkkelen. La parameteren være en tom streng
# dersom du vil deploye uten versjonering for å unngå at en gammel verdi blokkerer
# endringssettet:
# aws cloudformation deploy \
#       --stack-name math-visuals-api \
#       --template-file infra/api/template.yaml \
#       --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
#       --parameter-overrides \
#           LambdaCodeS3Bucket=<artefakt-bucket> \
#           LambdaCodeS3Key=<sti>/api-lambda.zip \
#           LambdaSecurityGroupIdOverride="" \
#           LambdaCodeS3ObjectVersion=<versjon-id eller \"\"> \
#           StageName=prod \
#           DataStackName=math-visuals-data \
#           SharedParametersStackName=math-visuals-shared
```

> **Merk:** Erstatt alle plassholdere (inkludert hakeparenteser) med faktiske verdier før du kjører kommandoene, og pass på at `LambdaCodeS3Bucket` og `LambdaCodeS3Key` peker til samme artefakt som ble lastet opp i første steg.

> **Regionkrav for LambdaCodeS3Bucket:** CloudFormation-stacken i produksjon kjøres i `eu-west-1`, og `LambdaCodeS3Bucket` må
> peke til en bøtte i samme region (eller en region-spesifikk endpoint). Hvis bøtta ligger i en annen region svarer `aws
> cloudformation deploy` med `PermanentRedirect`. Opprett bøtta i riktig region før du laster opp artefaktet:
>
> ```bash
> aws s3api create-bucket \
>   --bucket <artefakt-bucket> \
>   --region eu-west-1 \
>   --create-bucket-configuration LocationConstraint=eu-west-1
> ```
>
> Husk å oppdatere `<artefakt-bucket>` med navnet på bøtta du faktisk skal bruke før kommandoen kjøres.

Hvis du bruker versjonerte objekter i S3, kan du sette `LambdaCodeS3ObjectVersion=<versjon-id>` i `--parameter-overrides`.

`DataStackName` må peke på stacken som deployes fra `infra/data` (produksjon
bruker `math-visuals-data`). Denne verdien brukes til å importere VPC-ID,
private subnett, Lambda-sikkerhetsgruppen og Redis-endepunkter slik at
Lambdaen kan kjøre bak samme nettverk/firewall som Redis.

### Direkte overstyring av Lambda-sikkerhetsgruppen

Hvis Lambdaen må bruke en allerede eksisterende security group (f.eks.
`sg-0d4bd79e8a4e01832`) kan du sette
`LambdaSecurityGroupIdOverride=<sg-id>` i `--parameter-overrides`. Når denne
er satt hopper stacken over importen fra datastacken og bruker ID-en du oppgir
som eneste security group. Subnettene importeres fortsatt fra `DataStackName`.

GitHub Actions-workflowen `deploy-infra.yml` plukker opp hemmeligheten
`LAMBDA_SECURITY_GROUP_ID` og sender den som `LambdaSecurityGroupIdOverride`
automatisk, slik at du kan legge den endelige sg-ID-en i repoets secrets og
slippe placeholders i `VpcConfig`.

GitHub Action-secrets (`REDIS_PASSWORD`, `REDIS_ENDPOINT`, `REDIS_PORT`) trenger
ikke å endres bare fordi du overstyrer security groupen – de brukes kun til å
speile Redis-verdier inn i Secrets Manager/SSM.

`SharedParametersStackName` gjør at malen kan importere Secrets Manager- og
Parameter Store-navn fra `infra/shared-parameters.yaml`. Sørg for at
shared-stacken er deployet og at verdiene er oppdatert før du kjører kommandoen.

### Manuell verifisering av Lambda-konfigurasjonen

Etter en `aws cloudformation deploy` kan du verifisere at Lambdaen bruker de to
private subnettene, Lambda-sikkerhetsgruppen og Secrets Manager/SSM-ressursene i
samme region ved å kjøre:

```bash
cd math_visuals
AWS_REGION=eu-west-1 \
STACK_NAME=math-visuals-api \
DATA_STACK_NAME=math-visuals-data \
  ./scripts/verify-api-lambda.sh
```

Skriptet feiler hvis subnett eller security groups ikke matcher
CloudFormation-outputsene fra datastacken, eller hvis Lambdaens
miljøvariabler ikke peker til de forventede Redis-secretene og -parameterne.
Kjør skriptet igjen etter hver deploy for å bekrefte at Lambdaen er koblet til
de riktige ressursene i `eu-west-1`.

## CloudShell-vennlig deployskript med verifikasjon

Når du jobber i AWS CloudShell kan du automatisere hele flyten (pakke Lambda,
opprette S3-bøtte i `eu-west-1`, laste opp artefaktet, kjøre `aws cloudformation
deploy` og validere Lambda-konfigurasjonen) med
[`scripts/cloudshell-deploy-api.sh`](../../scripts/cloudshell-deploy-api.sh).
Skriptet krever at du har `jq` tilgjengelig og at du er autentisert med AWS CLI.

> **Merk:** CloudShell-miljøet starter uten `rsync`. Kjør `sudo yum install -y rsync`
> én gang per sesjon før du starter `scripts/cloudshell-deploy-api.sh`, ellers feiler
> pakking av Lambda-artefakten.

```bash
# Kjør bare denne hvis du ikke allerede er i repo-katalogen
cd math_visuals

AWS_REGION=eu-west-1 \
STACK_NAME=math-visuals-api \
DATA_STACK_NAME=math-visuals-data \
SHARED_PARAMETERS_STACK_NAME=math-visuals-shared \
  ./scripts/cloudshell-deploy-api.sh math-visuals-artifacts-eu-west-1
```

_Husk å erstatte alle plassholdere (inkludert hakeparenteser) med faktiske verdier og hopp over `cd math_visuals` dersom du allerede står i repoet._

**Valgfritt:** Dersom du vil overstyre S3-nøkkelen for zip-filen, kan du sende inn et ekstra argument med ønsket sti:

```bash
./scripts/cloudshell-deploy-api.sh math-visuals-artifacts-eu-west-1 team-builds/prod/api-lambda.zip
```

I eksemplet over lastes zip-filen opp til `s3://math-visuals-artifacts-eu-west-1/team-builds/prod/api-lambda.zip`, men du kan erstatte stien med en hvilken som helst katalogstruktur i samme bøtte.

Skriptet gjør følgende:

1. Sørger for at artefakt-bøtta eksisterer i `eu-west-1` (oppretter den hvis
   den mangler, og feiler hvis den finnes i feil region).
2. Kjører `scripts/package-api-lambda.sh` slik at `infra/api/api-lambda.zip`
   alltid inneholder `api/`, runtime og `palette/`.
3. Laster opp zip-filen til S3 og kjører samme `aws cloudformation deploy`
   kommando som beskrevet over (med `StageName`, `DataStackName` og
   `SharedParametersStackName`).
4. Kaller `scripts/verify-api-lambda.sh`, som henter `ApiFunction`-navnet fra
   stacken, leser stack-outputs fra datastacken og bekrefter at
   Lambda-funksjonen bruker de to private subnettene, Lambda-sikkerhetsgruppen
   og Secrets Manager/SSM-ressursene i samme region.

Hvis en av verifikasjonene feiler (manglende subnett, feil security group eller
miljøvariabler som ikke peker til de forventede secret-/parameter-navnene)
avslutter skriptet med en forklarende feilmelding.

Etter deploy kan API-endepunktet finnes i stack-utsnittene:

```bash
aws cloudformation describe-stacks \
  --stack-name math-visuals-api \
  --query 'Stacks[0].Outputs'
```

## Post-deploy sjekkliste

- Bekreft at CloudFormation-outputsene finnes i stacken. Forventede
  outputs etter deploy er:
  - `ApiFunctionLogGroupName`
  - `ApiAccessLogGroupName`

  ```bash
  aws cloudformation describe-stacks \
    --stack-name math-visuals-api \
    --query 'Stacks[0].Outputs'
  ```

- Hvis en av disse outputene mangler er stacken enten ikke opprettet med
  den nåværende malen, eller så feilet deployen. Kjør en ny deploy før du
  forventer at CloudWatch-loggene blir tilgjengelige i de riktige logg-
  gruppene.

### Oppdatere allowed-origins-parametere

For å sette `math-visuals/prod/config/examples-allowed-origins` eller `math-visuals/prod/config/svg-allowed-origins` til en ordrett verdi (f.eks. en kommaseparert liste) kan du skrive verdien til en tempfil og referere til den som `file://` i `aws ssm put-parameter`:

```bash
cat > /tmp/allowed-origins.txt <<'EOF'
https://foo.example
https://bar.example
EOF

aws ssm put-parameter \
  --name /math-visuals/prod/config/examples-allowed-origins \
  --value file:///tmp/allowed-origins.txt \
  --type String \
  --overwrite

aws ssm put-parameter \
  --name /math-visuals/prod/config/svg-allowed-origins \
  --value file:///tmp/allowed-origins.txt \
  --type String \
  --overwrite
```

> Merk: AWS CLI tolker uinnpakkede `https://`-verdier som filbaner (parameter store støtter `file://`-referanser) og svarer med `Unable to retrieve …` hvis URL-en ikke er tilgjengelig. Bruk derfor `file://` med en tempfil for ordrette URL-verdier.
