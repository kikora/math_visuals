# Redis / API 503 "KVUnavailable" feilsøking

Når `scripts/cloudshell-verify.sh` feiler med 503 og loggene viser
`WRONGPASS invalid username-password pair`, betyr det at Redis-klusteret
ikke aksepterer auth-tokenet som brukes av Lambda.

## Hurtigsjekkliste

1. **Hent riktig `RG_ID` med `describe-stack-resources`**
   - *Advarsel:* Ikke la placeholders som `<rg-id>` eller tomme verdier slippe gjennom; `modify-replication-group` feiler hvis ID mangler. `--query` returnerer `None` når ressursen ikke finnes, så sjekk utdataen før du bruker den.
   - Kommandoer:
     ```bash
     REGION="eu-west-1"
     DATA_STACK="math-visuals-data"

     aws cloudformation describe-stack-resources \
       --region "$REGION" \
       --stack-name "$DATA_STACK" \
       --query "StackResources[?ResourceType=='AWS::ElastiCache::ReplicationGroup'].PhysicalResourceId" \
       --output text
     ```

2. **Skriv nytt token til Secrets Manager**
   - *Advarsel:* Sett `NEW_REDIS_TOKEN` til en faktisk verdi før du kjører kommandoen; ikke bruk `<ny_random_token>` som placeholder.
   - Kommandoer:
     ```bash
     SECRET_NAME="math-visuals/prod/redis/password"
     NEW_REDIS_TOKEN="<ny_random_token>"

     aws secretsmanager put-secret-value \
       --region "$REGION" \
       --secret-id "$SECRET_NAME" \
       --secret-string "{\"authToken\":\"${NEW_REDIS_TOKEN}\"}"
     ```

3. **Oppdater ElastiCache med `modify-replication-group`**
   - *Advarsel:* Bekreft at `RG_ID` ikke er tom, `None` eller en placeholder før du kjører; ellers får du feilen «ReplicationGroupId must be provided». Bruk `--output text` slik at du ikke får JSON som må parses manuelt.
   - Kommandoer:
     ```bash
     RG_ID="$(aws cloudformation describe-stack-resources \
       --region "$REGION" \
       --stack-name "$DATA_STACK" \
       --query "StackResources[?ResourceType=='AWS::ElastiCache::ReplicationGroup'].PhysicalResourceId" \
       --output text)"

     [ -z "$RG_ID" ] && echo "Fant ikke gyldig RG_ID" >&2 && exit 1

     aws elasticache modify-replication-group \
       --region "$REGION" \
       --replication-group-id "$RG_ID" \
       --auth-token "$NEW_REDIS_TOKEN" \
       --apply-immediately
     ```

4. **Bygg `ENV_JSON` med `REDIS_PASSWORD` og oppdater Lambda**
   - *Advarsel:* `aws lambda update-function-configuration` krever at `--environment` er gyldig JSON. Bruk `jq -c` for å produsere ett-linjers JSON; ikke lim inn `Variables=`-streng manuelt, og unngå å bruke `--query ... --output text` på hemmeligheten (det vil strippe anførselstegn og ødelegge JSON-parsingen).
   - Kommandoer:
     ```bash
     LAMBDA_FN="math-visuals-api-ApiFunction-o6bkBzPH7ZPu"

     aws lambda get-function-configuration \
       --region "$REGION" \
       --function-name "$LAMBDA_FN" \
       --query 'Environment.Variables' \
       --output json > /tmp/env.json

     REDIS_AUTH_TOKEN=$(aws secretsmanager get-secret-value \
       --region "$REGION" \
       --secret-id "$SECRET_NAME" \
       --query SecretString \
       --output json | jq -r 'fromjson.authToken')

     ENV_JSON=$(jq -c --arg REDIS_PASSWORD "$REDIS_AUTH_TOKEN" '{Variables:(. + {CONFIG_REFRESH:(now|tostring), REDIS_PASSWORD:$REDIS_PASSWORD})}' /tmp/env.json)

     aws lambda update-function-configuration \
       --region "$REGION" \
       --function-name "$LAMBDA_FN" \
       --environment "$ENV_JSON"
     ```

5. **Kjør verifikasjonsskriptet på nytt**
   - Kommando:
     ```bash
     bash scripts/cloudshell-verify.sh --trace
     ```

6. **Hvis det fortsatt feiler, sjekk Lambda-loggene**
   - *Advarsel:* `describe-log-groups` og `tail` krever korrekt logggruppe; bekreft navnet fra første kommando før du tailer. Bruk tidsfilter (`--since`) for å slippe store JSON-svar.
   - Verifikasjonsskriptet forsøker å autodetektere riktig gruppe ved å teste hver `describe-log-groups`-linje i `log_group_has_streams`; det håndterer dermed både tabulator- og linjeskilte svar når flere Lambdaer har samme prefiks.
   - Kommandoer:
     ```bash
     aws logs describe-log-groups \
       --region "$REGION" \
       --log-group-name-prefix "/aws/lambda/${LAMBDA_FN}" \
       --query 'logGroups[].logGroupName' \
       --output text

     aws logs tail "/aws/lambda/${LAMBDA_FN}" \
       --region "$REGION" \
       --since 1h
     ```

## 1) Les gjeldende verdier

```bash
REGION="eu-west-1"
DATA_STACK="math-visuals-data"

aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query "Stacks[0].Outputs[?OutputKey==\`RedisReplicationGroupId\`].OutputValue" \
  --output text

aws ssm get-parameter \
  --region "$REGION" \
  --name "/math-visuals/prod/redis/endpoint" \
  --query Parameter.Value --output text

aws ssm get-parameter \
  --region "$REGION" \
  --name "/math-visuals/prod/redis/port" \
  --query Parameter.Value --output text

aws secretsmanager get-secret-value \
  --region "$REGION" \
  --secret-id "math-visuals/prod/redis/password" \
  --query SecretString --output text
```

## 2) Roter tokenet (hvis du ikke kjenner det riktige)

Sett `NEW_REDIS_TOKEN` til ny verdi og oppdater både Secrets Manager og
ElastiCache-klusteret. Pass på at `RG_ID` faktisk er satt før du kjører
`modify-replication-group` (feilen `ReplicationGroupId must be provided` betyr
ofte at `RG_ID` ble tom fordi kommandoen over ikke ga utslag).

```bash
set -euo pipefail

REGION="eu-west-1"
DATA_STACK="math-visuals-data"
SECRET_NAME="math-visuals/prod/redis/password"
NEW_REDIS_TOKEN="<ny_random_token>"

# Hent ReplicationGroupId på nytt og avbryt hvis den mangler
RG_ID=$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='RedisReplicationGroupId'].OutputValue" \
  --output text)

# Alternativ kommando som henter ID fra stack-ressursene
RG_ID_RESOURCES=$(aws cloudformation describe-stack-resources \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query "StackResources[?ResourceType=='AWS::ElastiCache::ReplicationGroup'].PhysicalResourceId" \
  --output text)
echo "RG_ID_RESOURCES=${RG_ID_RESOURCES}"

# Avbryt hvis ID er tom eller placeholder – vi må være sikre på at modify-replication-group får en gyldig ID
if [ -z "$RG_ID_RESOURCES" ] || [ "$RG_ID_RESOURCES" = "None" ] || [[ "$RG_ID_RESOURCES" == *"<"*">"* ]]; then
  echo "Fant ikke gyldig ReplicationGroupId i describe-stack-resources – avbryter." >&2
  exit 1
fi

RG_ID=${RG_ID_RESOURCES:-$RG_ID}
echo "RG_ID=${RG_ID}"
if [ -z "$RG_ID" ] || [ "$RG_ID" = "None" ]; then
  echo "Fant ikke RedisReplicationGroupId – avbryter." >&2
  exit 1
fi

aws secretsmanager put-secret-value \
  --region "$REGION" \
  --secret-id "$SECRET_NAME" \
  --secret-string "{\"authToken\":\"${NEW_REDIS_TOKEN}\"}"

aws elasticache modify-replication-group \
  --region "$REGION" \
  --replication-group-id "$RG_ID" \
  --auth-token "$NEW_REDIS_TOKEN" \
  --apply-immediately
```

## 3) Bekreft og oppdater Lambda-konfig

Oppdater Parameter Store (dersom endepunkt/port er endret) og tving
Lambda til å laste miljøet på nytt. Feilen "Expected: '=', received: '"'
kan oppstå hvis `--environment`-verdien ikke er JSON. Kommandoen under
henter gjeldende environment, legger til en ny `CONFIG_REFRESH`-timestamp
for å trigge ny deploy-konfig og konstruerer et valid JSON-objekt på
formen `{"Variables":{...}}` slik AWS CLI forventer:

```bash
LAMBDA_FN="math-visuals-api-ApiFunction-o6bkBzPH7ZPu"

aws lambda get-function-configuration \\
  --region "$REGION" \\
  --function-name "$LAMBDA_FN" \\
  --query 'Environment.Variables' \\
  --output json > /tmp/env.json

REDIS_AUTH_TOKEN=$(aws secretsmanager get-secret-value \\
  --region "$REGION" \\
  --secret-id "math-visuals/prod/redis/password" \\
  --query SecretString \\
  --output json | jq -r 'fromjson.authToken')

ENV_JSON=$(jq -c '{Variables:(. + {CONFIG_REFRESH:(now|tostring)})}' /tmp/env.json)
# Hvis du også skal sette nytt Redis-passord i Lambda-environmentet, kan du
# i stedet kjøre:
# ENV_JSON=$(jq -c --arg REDIS_PASSWORD "$REDIS_AUTH_TOKEN" '{Variables:(. + {CONFIG_REFRESH:(now|tostring), REDIS_PASSWORD:$REDIS_PASSWORD})}' /tmp/env.json)

aws lambda update-function-configuration \\
  --region "$REGION" \\
  --function-name "$LAMBDA_FN" \\
  --environment "$ENV_JSON"
```

Denne varianten samsvarer med `aws lambda update-function-configuration` sine
forventninger til JSON og unngår parse-feilen som kan oppstå med
`Variables=`-prefikset. Hvis `REDIS_PASSWORD` ikke blir satt i `ENV_JSON`,
blir placeholderen liggende igjen i Lambda og den gamle hardkodede verdien
blir stående.


Hvis du bare trenger å rulle Lambda på nytt etter en secret-endring (uten å
huske parametrene til stacken), kan du bruke helperen som pakker alle
ParameterKey-er som `UsePreviousValue=true` og kaller `update-stack` med
forrige template:

```bash
bash scripts/cloudshell-redeploy-api.sh --region="$REGION" --stack="math-visuals-api"
```

Hvis CloudShell mister tilkoblingen midt i en kommando (f.eks. `[exited]`),
kjør siste kommando på nytt. Det er trygt å re-kjøre `put-secret-value` og
`modify-replication-group` med samme token.

Kjør deretter `bash scripts/cloudshell-verify.sh --trace` på nytt. Hvis
/API/EXAMPLES fremdeles gir 503 med `WRONGPASS`, verifiser at auth-tokenet
på Secrets Manager og ElastiCache matcher og at Lambda har rullet ut ny
konfigurasjon.
