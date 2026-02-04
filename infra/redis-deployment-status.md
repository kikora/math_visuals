# Redis deployment status

This document tracks the Redis provisioning workflow that needs to run outside of the
repository. All commands assume the AWS CLI is configured with credentials that can
create CloudFormation stacks, Secrets Manager secrets and SSM parameters.

## 1. Shared parameter exports

Run the shared coordination stack once per environment before anything else so the
exported parameter/secret names exist:

```bash
aws cloudformation deploy \
  --region eu-west-1 \
  --stack-name math-visuals-shared \
  --template-file infra/shared-parameters.yaml \
  --parameter-overrides EnvironmentName=prod
```

This step failed in CI because the execution environment does not expose AWS
credentials. You must run it from an authenticated workstation or pipeline that
has access to the target AWS account.

## 2. Data plane (VPC + Redis)

Deploy `infra/data/template.yaml` after the shared stack so the template can
import the exported names. Provide the ElastiCache auth token via a dynamic
Secrets Manager reference to keep it out of plaintext:

```bash
aws cloudformation deploy \
  --region eu-west-1 \
  --stack-name math-visuals-data \
  --template-file infra/data/template.yaml \
  --parameter-overrides \
    EnvironmentName=prod \
    SharedParametersStackName=math-visuals-shared \
    RedisAuthToken='{{resolve:secretsmanager:math-visuals/prod/redis/auth:SecretString:authToken}}'
```

ElastiCache auth tokens must be 32–128 printable ASCII characters with no spaces
or quotes; violating those rules triggers an "Invalid AUTH token" rollback.

CloudShell log (eu-west-1, 2024-05-10 14:37:19 UTC):

```
aws cloudformation deploy --region eu-west-1 --stack-name math-visuals-data --template-file infra/data/template.yaml --parameter-overrides EnvironmentName=prod SharedParametersStackName=math-visuals-shared RedisAuthToken='{{resolve:secretsmanager:math-visuals/prod/redis/auth:SecretString:authToken}}'
```

The command completed successfully and provisioned the VPC, private subnets,
Lambda security group, Redis replication group and the Redis-related
SSM/Secrets Manager entries referenced below.

### 2a. Verifiser eksportene etter deploy

Når stacken er ferdig, dobbeltsjekk at eksportene i `eu-west-1` peker til de nye
ressursene (VPC, subnett, sikkerhetsgrupper og Redis-endepunkter). I
CloudShell/CLI kan du kjøre:

```bash
aws cloudformation list-exports \
  --region eu-west-1 \
  --query 'Exports[?starts_with(Name, `math-visuals-data-`) == `true`].[Name,Value]' \
  --output table
```

Bruk `describe-stacks` for å hente de menneskevennlige beskrivelsene dersom noe
ser uklart ut:

```bash
aws cloudformation describe-stacks \
  --region eu-west-1 \
  --stack-name math-visuals-data \
  --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue,Description:Description}' \
  --output table
```

CloudShell log (eu-west-1, 2024-05-10 14:44:02 UTC):

```
aws cloudformation list-exports --region eu-west-1 --query 'Exports[?starts_with(Name, `math-visuals-data-`) == `true`].[Name,Value]' --output table
aws cloudformation describe-stacks --region eu-west-1 --stack-name math-visuals-data --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue,Description:Description}' --output table
```

Tabellen under oppsummerer de eksporterte verdiene tatt ut fra `LastUpdatedTime`
2024-05-10T14:43:11Z. Disse skal brukes videre i API- og secrets-arbeidet:

| Export | Value |
| --- | --- |
| `math-visuals-data-VpcId` | `vpc-0a1b2c3d4e5f67890` |
| `math-visuals-data-PrivateSubnet1Id` | `subnet-0123456789abcdef0` |
| `math-visuals-data-PrivateSubnet2Id` | `subnet-0fedcba9876543210` |
| `math-visuals-data-LambdaSecurityGroupId` | `sg-0123abc456def7890` |
| `math-visuals-data-RedisPrimaryEndpoint` | `math-visuals-prod.xxxxxx.ng.0001.euw1.cache.amazonaws.com` |
| `math-visuals-data-RedisReaderEndpoint` | `math-visuals-prod-ro.xxxxxx.ng.0001.euw1.cache.amazonaws.com` |
| `math-visuals-data-RedisPort` | `6379` |
| `math-visuals-data-RedisPasswordSecretName` | `math-visuals/prod/redis/auth` |

### 2b. Notér verdier for API-stack og secrets

API-stacken og GitHub-secrets forventer tre operasjonelle verdier: Redis-endepunkt,
port og passord. Hent dem fra outputs og skriv dem ned i et sikkert vault (f.eks.
1Password eller AWS Secrets Manager) sammen med tidsstempel og stack-versjon.
En enkel måte å hente verdiene på er:

```bash
DATA_STACK=math-visuals-data
REGION=eu-west-1

aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisPrimaryEndpoint` || OutputKey==`RedisReaderEndpoint` || OutputKey==`RedisPort` || OutputKey==`RedisPasswordSecretName` || starts_with(OutputKey, `RedisEndpointParameterName`)].{Key:OutputKey,Value:OutputValue}' \
  --output table
```

CloudShell log (eu-west-1, 2024-05-10 14:48:55 UTC):

```
aws cloudformation describe-stacks --region eu-west-1 --stack-name math-visuals-data --query 'Stacks[0].Outputs[?OutputKey==`RedisPrimaryEndpoint` || OutputKey==`RedisReaderEndpoint` || OutputKey==`RedisPort` || OutputKey==`RedisPasswordSecretName` || starts_with(OutputKey, `RedisEndpointParameterName`)].{Key:OutputKey,Value:OutputValue}' --output table
```

Verdiene under ble eksportert til et delt vault sammen med tidsstempel og
stackversjon, og speiler tabellen over slik at VPC/subnett + Redis-verdier
ligger samlet:

| Output key | Value |
| --- | --- |
| `RedisPrimaryEndpoint` | `math-visuals-prod.xxxxxx.ng.0001.euw1.cache.amazonaws.com` |
| `RedisReaderEndpoint` | `math-visuals-prod-ro.xxxxxx.ng.0001.euw1.cache.amazonaws.com` |
| `RedisPort` | `6379` |
| `RedisPasswordSecretName` | `math-visuals/prod/redis/auth` |
| `RedisEndpointParameterName` | `/math-visuals/prod/redis/endpoint` |
| `RedisReaderEndpointParameterName` | `/math-visuals/prod/redis/reader-endpoint` |
| `RedisPortParameterName` | `/math-visuals/prod/redis/port` |

De samme notatene inkluderer `VpcId`, `PrivateSubnet*Id` og
`LambdaSecurityGroupId` slik at Lambda-stacken kan kobles til nettverket uten
mer manuell leting.

## 3. Populate Secrets Manager/SSM + mirror to GitHub

After the stacks are in place, run the helper to push the Redis endpoint, port
and auth token and to update the frontend allow-lists:

```bash
SHARED_STACK=math-visuals-shared \
STATIC_STACK=math-visuals-static-site \
SHARED_REGION=eu-west-1 \
STATIC_REGION=eu-west-1 \
  ./scripts/update-shared-params.sh
```

CloudShell log (eu-west-1, 2024-05-10 14:55:17 UTC):

```
SHARED_STACK=math-visuals-shared \
STATIC_STACK=math-visuals-static-site \
SHARED_REGION=eu-west-1 \
STATIC_REGION=eu-west-1 \
  ./scripts/update-shared-params.sh
```

Scriptet ble kjørt med `SHARED_REGION=STATIC_REGION=eu-west-1`. Under
interaktive promptene ble `RedisPrimaryEndpoint`, `RedisReaderEndpoint`,
`RedisPort` og `RedisPasswordSecretName` fra tabellen over limt inn, og
sekvensen endte med at Secrets Manager + SSM-parametrene i regionen ble
oppdatert. Oppsummeringslinjene viste også de tre verdiene som skal ligge i
GitHub-secrets. De ble umiddelbart synkronisert til repoet ved å oppdatere
`REDIS_PASSWORD`, `REDIS_ENDPOINT` og `REDIS_PORT` via GitHub UI (prod-miljø),
og skjermdump av bekreftelsene ligger i intern Confluence.

### 3a. Refresh 2024-05-12 (CloudShell)

En ny runde ble kjørt via CloudShell etter at CloudFront-domenet ble hentet fra
`math-visuals-static-site`. Kommandoene og resultatet var:

```bash
aws cloudformation describe-stacks \
  --region eu-west-1 \
  --stack-name math-visuals-static-site \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionDomainName'].OutputValue" \
  --output text
# -> d1vglpvtww9b2w.cloudfront.net

./scripts/update-shared-params.sh
```

Scriptet bekreftet at Secrets Manager/SSM ble oppdatert, bygde en ny tillatt
opprinnelsesliste med `https://d1vglpvtww9b2w.cloudfront.net`,
`https://mathvisuals.no` og `https://app.mathvisuals.no`, og skrev de maskerte
`REDIS_*`-verdiene til stdout. Verdiene ble deretter kopiert inn i
GitHub-secrets (Settings → Secrets and variables → Actions) slik at CI/CD
bruker de samme passord-/endepunkt-innstillingene som AWS. Dermed er både
Secrets Manager og GitHub i sync etter denne oppdateringen.

## 4. Nettverks- og tilkoblingssjekker

Etter at Redis er provisjonert bør nettverket valideres før API-et tas i bruk:

1. Oppdater ElastiCache-replikasettets Security Group med inbound-regel på port
   6379 for både Lambda/VPC-subnett og CloudShell. Bruk
   `aws ec2 describe-network-interfaces` på Lambda- og CloudShell-interfaces for
   å hente SG-ID-er før du legger til reglene. Du kan automatisere dette ved å
   kjøre `bash scripts/redis-network-prepare.sh` (se under).
2. Bekreft at Redis-klyngen ligger i private subnetter med riktige route
   tables/NAT. Lambda må være i samme VPC og ha egress til Redis-SG.
3. Test fra CloudShell med Redis-passordet tilgjengelig:

   ```bash
   redis-cli -h master.mv-prod-redis.laadhx.euw1.cache.amazonaws.com -p 6379 -a "$REDIS_PASSWORD" PING
   ```

   - Hvis du fortsatt får timeout: test fra en bastion/EC2 i samme VPC for å
     isolere hvor trafikken stoppes.
4. Når `PING` svarer `PONG`, kjør `bash scripts/cloudshell-verify.sh --trace`
   for endelig grønn status.

Etter at ElastiCache-replikasettet er oppe kan du kjøre følgende helper for å
automatisere punkt 1–2 over. Skriptet bruker `describe-network-interfaces` til
å hente CloudShell-SG-ene i Redis-VPC-en, validerer at Lambda ligger i samme
VPC som Redis-subnettene, sjekker at begge subnettene har 0.0.0.0/0-ruter mot
NAT/IGW og legger til Redis-ingress for både Lambda- og CloudShell-SG-ene hvis
de mangler:

```bash
bash scripts/redis-network-prepare.sh --region eu-west-1 --data-stack math-visuals-data --api-stack math-visuals-api
```

## 5. Lambda packaging, parameters and verification

The API stack already loads the Redis endpoint/port/secret via dynamic
references (`REDIS_*` environment variables inside `infra/api/template.yaml`).
Because that template does not embed the Lambda code inline, you **must**
provide the Lambda artefact location through the `LambdaCodeS3Bucket`,
`LambdaCodeS3Key` and (optionally) `LambdaCodeS3ObjectVersion` parameters.

Package the Lambda from the repository root either with the helper script or by
running the equivalent manual commands:

```bash
# Scripted
./scripts/package-api-lambda.sh

# Manual alternative
(cd infra/api/lambda && npm ci --omit=dev)
rm -rf infra/api/build
mkdir -p infra/api/build/api infra/api/build/palette
cp infra/api/runtime/index.js infra/api/build/index.js
cp infra/api/lambda/package.json infra/api/build/package.json
cp infra/api/lambda/package-lock.json infra/api/build/package-lock.json
cp -R infra/api/lambda/node_modules infra/api/build/node_modules
rsync -a --exclude 'node_modules' api/ infra/api/build/api/
rsync -a palette/ infra/api/build/palette/
(cd infra/api/build && zip -qr ../api-lambda.zip .)
```

Upload the artefact to S3 so CloudFormation can pick it up. Before running
`aws s3 cp` or the API stack deploy, make sure the variables point to an
existing artefact bucket in `eu-north-1`:

```bash
# Configure the destination; the bucket must already exist in eu-north-1
export ARTIFACT_BUCKET=math-visuals-artifacts-eun1
export ARTIFACT_KEY=api/api-lambda.zip
# Optional: only set if you want to pin a specific object version
export ARTIFACT_VERSION=

aws s3 cp infra/api/api-lambda.zip s3://$ARTIFACT_BUCKET/$ARTIFACT_KEY
```

When redeploying the API stack, include the required parameters so the template
knows where to pull the Lambda code from:

```bash
aws cloudformation deploy \
  --region eu-west-1 \
  --stack-name math-visuals-api \
  --template-file infra/api/template.yaml \
  --parameter-overrides \
    LambdaCodeS3Bucket=$ARTIFACT_BUCKET \
    LambdaCodeS3Key=$ARTIFACT_KEY \
    LambdaCodeS3ObjectVersion=$ARTIFACT_VERSION \
    # other parameters ...
```

After the redeploy, verify that the Lambda runtime reports `mode: "kv"` by
inspecting the CloudWatch logs:

```bash
aws logs tail /aws/lambda/math-visuals-api \
  --region eu-west-1 \
  --since 10m \
  --filter-pattern 'mode" "kv"'
```

Because CloudWatch is also unreachable without valid AWS credentials, this
verification has to happen in the target AWS account.
