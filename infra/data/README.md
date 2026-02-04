# Data plane infrastructure

Denne mappen inneholder en CloudFormation-mal (`template.yaml`) som etablerer en
fullisolert AWS-datastack for Redis. Malen oppretter

- en dedikert VPC med to private subnett,
- sikkerhetsgrupper for Lambda-funksjoner og Redis,
- et ElastiCache for Redis-subnettgruppe og -replikasjonsgruppe med TLS,
  autentisering og Multi-AZ, og
- Secrets Manager/SSM-ressurser som eksponerer endepunkter, port og passord til
  resten av plattformen.

## Parametere

| Parameter | Beskrivelse |
| --- | --- |
| `EnvironmentName` | Prefiks som brukes i ressursnavn (f.eks. `prod`). |
| `SharedParametersStackName` | Navnet på stacken som ble opprettet fra `infra/shared-parameters.yaml`. |
| `VpcCidr` | CIDR-blokk for VPC-en. Standard `10.42.0.0/16`. |
| `PrivateSubnet1Cidr` | CIDR-blokk for det første private subnettet. Standard `10.42.0.0/19`. |
| `PrivateSubnet2Cidr` | CIDR-blokk for det andre private subnettet. Standard `10.42.32.0/19`. |
| `RedisNodeType` | ElastiCache-instans (f.eks. `cache.t4g.small`). |
| `RedisEngineVersion` | Redis-versjon (standard `7.1`). |
| `RedisReplicasPerNodeGroup` | Antall replikaser per shard (0 = kun primær). |
| `RedisMaintenanceWindow` | Vedlikeholdsvindu i UTC (standard `sun:23:00-mon:01:30`). |
| `CloudShellSecurityGroupId` | (Valgfri) Security Group-ID for AWS CloudShell slik at operatører kan kjøre `redis-cli` direkte mot klyngen på port 6379. |
| `RedisAuthToken` | Auth-tokenet som sendes til ElastiCache. Oppgi dette som en [dynamic reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/dynamic-references.html) til Secrets Manager slik at hemmeligheten ikke sjekkes inn i koden. |

`SharedParametersStackName` gjør at malen kan importere de kanoniske navnene på Secrets Manager- og Systems Manager-ressursene fra `infra/shared-parameters.yaml`. `RedisAuthToken` lagres også som et Secrets Manager-secret (navnet kommer fra den delte stacken) slik at andre stacks kan slå det opp senere uten å sjekke CloudFormation-parametre.

## Deployering

Eksempel på deploy med AWS CLI:

```bash
aws cloudformation deploy \
  --region eu-west-1 \
  --stack-name math-visuals-data \
  --template-file infra/data/template.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
      EnvironmentName=prod \
      VpcCidr=10.42.0.0/16 \
      PrivateSubnet1Cidr=10.42.0.0/19 \
      PrivateSubnet2Cidr=10.42.32.0/19 \
      RedisNodeType=cache.t4g.small \
      RedisEngineVersion=7.1 \
      RedisReplicasPerNodeGroup=1 \
      RedisMaintenanceWindow=sun:23:00-mon:01:30 \
      RedisAuthToken='{{resolve:secretsmanager:math-visuals/prod/redis/auth-token:SecretString:authToken}}' \
      SharedParametersStackName=math-visuals-shared
```

Justér CIDR-blokker, node-type og vedlikeholdsvindu til verdier som passer i ditt
AWS-miljø før deploy.

## Outputs og eksporterte verdier

Stacken eksporterer følgende verdier, slik at andre stacks kan hente dem via
`Fn::ImportValue`:

- `VpcId`, `PrivateSubnet1Id`, `PrivateSubnet2Id` – brukes i Lambda `VpcConfig`.
- `LambdaSecurityGroupId`, `RedisSecurityGroupId` – sikrer at Lambda kun får
  tilgang til Redis. Redis-SG-en kan også åpnes for CloudShell ved å sette
  `CloudShellSecurityGroupId` når stacken deployes, slik at feilsøking med
  `redis-cli --tls` fungerer direkte fra CloudShell.
- `RedisPrimaryEndpoint`, `RedisReaderEndpoint`, `RedisPort`, `RedisTlsRequired`
  – beskriver hvordan klienter kobler seg til klyngen.
- `RedisEndpointParameterName`, `RedisReaderEndpointParameterName`,
  `RedisPortParameterName` – peker på SSM-parametrene hvor CI/CD kan hente
  de faktiske verdiene.
- `RedisPasswordSecretName` – navnet på Secrets Manager-secretet som inneholder
  auth-tokenet.

Alle outputs har også en CloudFormation-beskrivelse slik at de er lette å finne i
konsollet.

## Lambda-konfigurasjon

Lambda-funksjoner som skal snakke med Redis må kjøre inne i VPC-en og bruke
sikkerhetsgruppen som ble opprettet for formålet:

1. Sett `VpcConfig` på Lambda-funksjonen til å inkludere subnettene
   `!ImportValue <DataStackName>-PrivateSubnet1Id` og
   `!ImportValue <DataStackName>-PrivateSubnet2Id`, samt
   `SecurityGroupIds: [!ImportValue <DataStackName>-LambdaSecurityGroupId]`.
2. Sørg for at Lambda-rollen har tillatelse til å lese hemmeligheter fra Secrets
   Manager/Parameter Store ved å gi den policyer tilsvarende
   `secretsmanager:GetSecretValue` og `ssm:GetParameter`.

### Miljøvariabler

Applikasjonskoden forventer følgende miljøvariabler:

- `REDIS_ENDPOINT`
- `REDIS_PORT`
- `REDIS_PASSWORD`

Disse bør **ikke** hardkodes. Hent i stedet verdiene fra stacken slik:

```bash
DATA_STACK=math-visuals-data
REGION=eu-west-1

REDIS_ENDPOINT_PARAMETER=$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpointParameterName`].OutputValue' \
  --output text)

REDIS_PORT_PARAMETER=$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisPortParameterName`].OutputValue' \
  --output text)

REDIS_ENDPOINT=$(aws ssm get-parameter \
  --region "$REGION" \
  --name "$REDIS_ENDPOINT_PARAMETER" \
  --query 'Parameter.Value' \
  --output text)

REDIS_PORT=$(aws ssm get-parameter \
  --region "$REGION" \
  --name "$REDIS_PORT_PARAMETER" \
  --query 'Parameter.Value' \
  --output text)

REDIS_SECRET_NAME=$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisPasswordSecretName`].OutputValue' \
  --output text)

REDIS_PASSWORD=$(aws secretsmanager get-secret-value \
  --region "$REGION" \
  --secret-id "$REDIS_SECRET_NAME" \
  --query 'SecretString' \
  --output text | jq -r '.authToken')

PRIVATE_SUBNET1=$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnet1Id`].OutputValue' \
  --output text)

PRIVATE_SUBNET2=$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnet2Id`].OutputValue' \
  --output text)

LAMBDA_SG=$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaSecurityGroupId`].OutputValue' \
  --output text)

aws lambda update-function-configuration \
  --function-name math-visuals-api \
  --vpc-config SubnetIds=$PRIVATE_SUBNET1,$PRIVATE_SUBNET2,SecurityGroupIds=$LAMBDA_SG \
  --environment "Variables={REDIS_ENDPOINT=$REDIS_ENDPOINT,REDIS_PORT=$REDIS_PORT,REDIS_PASSWORD=$REDIS_PASSWORD}"
```

#### Automatisert oppdatering med skript

Skriptet [`scripts/configure-lambda-redis.sh`](../../scripts/configure-lambda-redis.sh)
pakker kommandoene over i ett steg. Det henter VPC-konfigurasjon og Redis-hemmeligheter
fra stacken og kaller `aws lambda update-function-configuration` med korrekte
miljøvariabler.

```bash
DATA_STACK=math-visuals-data \
  ./scripts/configure-lambda-redis.sh
```

Regresjonstest: skriptet skal default bruke `ApiFunctionArn` fra API-stacken. En
uoverstret kjøring med et feil navn skal feile tydelig:

```bash
./scripts/configure-lambda-redis.sh wrong-name
# Feiler med hint om ApiFunctionArn; bruk --force-function-name for bevisste overstyringer.
```

Skriptet forventer at du er logget inn med AWS CLI og at `jq` er tilgjengelig.

CI/CD-systemer som SAM, CDK eller Serverless Framework kan gjøre denne
miljøvariabelinjiseringen mer deklarativt. Poenget er uansett at verdiene hentes
fra CloudFormation-outputs og Secrets Manager/Parameter Store i stedet for å
hardkodes.
