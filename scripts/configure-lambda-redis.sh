#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REGION="${DEFAULT_REGION:-eu-west-1}"

usage() {
  cat <<'USAGE'
Usage: configure-lambda-redis.sh [-a <api-stack>] [--force-function-name] [<lambda-function-name>]

Henter VPC- og Redis-verdier fra CloudFormation/SSM/Secrets Manager og oppdaterer
Lambda-funksjonen slik at den kjører inne i VPC-en og bruker Secrets-baserte
Redis-miljøvariabler. Kjør skriptet uten argumenter for å bruke API-stackens
ApiFunctionArn som sannhetskilde. Unngå å sende inn stack-navn som
funksjonsnavn: det kan konfigurerer feil Lambda.

Argumenter:
  <lambda-function-name>  (valgfritt) Navnet/ARN-en til Lambda-funksjonen som skal
                          oppdateres. Må matche ApiFunctionArn-outputen med
                          mindre du eksplisitt overstyrer med
                          --force-function-name.

Flagg:
  -a, --api-stack NAME    Navn på API-stack for automatisk oppslag av
                          ApiFunctionArn (default: math-visuals-api)
      --force-function-name
                          Tillat å bruke et annet funksjonsnavn enn det som
                          samsvarer med ApiFunctionArn. Bruk kun ved bevisste
                          overstyringer.

Miljøvariabler:
  DATA_STACK        Navn på data-stack (default: math-visuals-data)
  API_STACK         Navn på API-stack (default: math-visuals-api)
  AWS_REGION        Region for ressursene (default: verdien i
                    $AWS_REGION/$AWS_DEFAULT_REGION/$DEFAULT_REGION eller eu-west-1)
  AWS_PROFILE       Valgfritt. Brukes av AWS CLI ved behov.
  DEFAULT_REGION    Valgfritt. Eksplicit fallback-region (default: eu-west-1)

Eksempler:
  DATA_STACK=math-visuals-data \
    ./scripts/configure-lambda-redis.sh

  DATA_STACK=math-visuals-data \
    ./scripts/configure-lambda-redis.sh --api-stack math-visuals-api
USAGE
}

API_STACK=${API_STACK:-math-visuals-api}
if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "Feil: aws CLI er ikke tilgjengelig i PATH." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Feil: jq må være installert for å parse Secrets Manager-responsen." >&2
  exit 1
fi

DATA_STACK=${DATA_STACK:-math-visuals-data}
REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-$DEFAULT_REGION}}
FORCE_FUNCTION_NAME=false

POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--api-stack)
      if [[ -z ${2:-} ]]; then
        echo "Feil: --api-stack krever et navn." >&2
        usage
        exit 1
      fi
      API_STACK=$2
      shift 2
      ;;
    --force-function-name)
      FORCE_FUNCTION_NAME=true
      shift
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "Feil: Ukjent flagg: $1" >&2
      usage
      exit 1
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

if [[ ${#POSITIONAL[@]} -gt 1 ]]; then
  echo "Feil: For mange argumenter." >&2
  usage
  exit 1
fi

if [[ ${#POSITIONAL[@]} -eq 1 ]]; then
  FUNCTION_NAME=${POSITIONAL[0]}
fi

fetch_output() {
  local stack_name=$1
  local output_key=$2
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey==\`$output_key\`].OutputValue" \
    --output text
}

require_value() {
  local value=$1
  local description=$2
  if [[ -z "$value" || "$value" == "None" ]]; then
    echo "Feil: Fant ingen verdi for $description." >&2
    exit 1
  fi
}

PRIVATE_SUBNET1=$(fetch_output "$DATA_STACK" PrivateSubnet1Id)
require_value "$PRIVATE_SUBNET1" "PrivateSubnet1Id"

PRIVATE_SUBNET2=$(fetch_output "$DATA_STACK" PrivateSubnet2Id)
require_value "$PRIVATE_SUBNET2" "PrivateSubnet2Id"

LAMBDA_SECURITY_GROUP=$(fetch_output "$DATA_STACK" LambdaSecurityGroupId)
require_value "$LAMBDA_SECURITY_GROUP" "LambdaSecurityGroupId"

REDIS_ENDPOINT_PARAMETER=$(fetch_output "$DATA_STACK" RedisEndpointParameterName)
require_value "$REDIS_ENDPOINT_PARAMETER" "RedisEndpointParameterName"

REDIS_PORT_PARAMETER=$(fetch_output "$DATA_STACK" RedisPortParameterName)
require_value "$REDIS_PORT_PARAMETER" "RedisPortParameterName"

REDIS_PASSWORD_SECRET=$(fetch_output "$DATA_STACK" RedisPasswordSecretName)
require_value "$REDIS_PASSWORD_SECRET" "RedisPasswordSecretName"

API_FUNCTION_ARN=$(fetch_output "$API_STACK" ApiFunctionArn)
require_value "$API_FUNCTION_ARN" "ApiFunctionArn i stacken $API_STACK"
API_FUNCTION_NAME=${API_FUNCTION_ARN##*:}

if [[ -n ${FUNCTION_NAME:-} ]]; then
  if [[ "$FUNCTION_NAME" != "$API_FUNCTION_NAME" && "$FUNCTION_NAME" != "$API_FUNCTION_ARN" && "$FORCE_FUNCTION_NAME" != true ]]; then
    echo "Feil: Oppgitt funksjonsnavn ($FUNCTION_NAME) samsvarer ikke med ApiFunctionArn ($API_FUNCTION_NAME) fra stacken $API_STACK." >&2
    echo "Bruk --force-function-name hvis du bevisst vil overstyre dette." >&2
    exit 1
  fi
else
  FUNCTION_NAME=$API_FUNCTION_NAME
fi
require_value "$FUNCTION_NAME" "Lambda-funksjonsnavnet"

REDIS_ENDPOINT=$(aws ssm get-parameter \
  --region "$REGION" \
  --name "$REDIS_ENDPOINT_PARAMETER" \
  --query 'Parameter.Value' \
  --output text)
require_value "$REDIS_ENDPOINT" "Redis-endepunktet"

REDIS_PORT=$(aws ssm get-parameter \
  --region "$REGION" \
  --name "$REDIS_PORT_PARAMETER" \
  --query 'Parameter.Value' \
  --output text)
require_value "$REDIS_PORT" "Redis-porten"

SECRET_STRING=$(aws secretsmanager get-secret-value \
  --region "$REGION" \
  --secret-id "$REDIS_PASSWORD_SECRET" \
  --query 'SecretString' \
  --output text)
require_value "$SECRET_STRING" "Redis-passordet (SecretString)"

if ! REDIS_PASSWORD=$(printf '%s' "$SECRET_STRING" | jq -er 'try (.authToken // .password // .secret // .value // .token)'); then
  # SecretString er sannsynligvis ren tekst
  REDIS_PASSWORD=$SECRET_STRING
fi

EXISTING_ENVIRONMENT=$(aws lambda get-function-configuration \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --query 'Environment.Variables' \
  --output json)

if [[ -z "$EXISTING_ENVIRONMENT" || "$EXISTING_ENVIRONMENT" == "null" ]]; then
  EXISTING_ENVIRONMENT='{}'
fi

# Bevar alle eksisterende miljøvariabler og overstyr kun Redis-relaterte nøkler.
MERGED_VARIABLES=$(jq -n \
  --argjson existing "$EXISTING_ENVIRONMENT" \
  --arg endpoint "$REDIS_ENDPOINT" \
  --arg port "$REDIS_PORT" \
  --arg password "$REDIS_PASSWORD" \
  '$existing + {REDIS_ENDPOINT: $endpoint, REDIS_PORT: $port, REDIS_PASSWORD: $password}')

FINAL_VARIABLE_COUNT=$(printf '%s' "$MERGED_VARIABLES" | jq 'keys | length')

ENVIRONMENT_JSON=$(jq -n --argjson variables "$MERGED_VARIABLES" '{Variables: $variables}')
COMPACT_ENVIRONMENT=$(printf '%s' "$MERGED_VARIABLES" | jq -c '.')

echo "Oppdaterer Lambda-funksjon: $FUNCTION_NAME" >&2
echo "Miljøvariabler som sendes til funksjonen: $FINAL_VARIABLE_COUNT" >&2

set +e
aws lambda update-function-configuration \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --vpc-config "SubnetIds=$PRIVATE_SUBNET1,$PRIVATE_SUBNET2,SecurityGroupIds=$LAMBDA_SECURITY_GROUP" \
  --environment "Variables=$COMPACT_ENVIRONMENT"
update_status=$?

if [[ $update_status -ne 0 ]]; then
  echo "Direkte oppdatering feilet, prøver med midlertidig miljøfil..." >&2
  env_file=$(mktemp)
  printf '%s' "$ENVIRONMENT_JSON" >"$env_file"

  aws lambda update-function-configuration \
    --region "$REGION" \
    --function-name "$FUNCTION_NAME" \
    --vpc-config "SubnetIds=$PRIVATE_SUBNET1,$PRIVATE_SUBNET2,SecurityGroupIds=$LAMBDA_SECURITY_GROUP" \
    --environment "file://$env_file"
  update_status=$?
  rm -f "$env_file"
fi
set -e

if [[ $update_status -ne 0 ]]; then
  echo "Oppdateringen av $FUNCTION_NAME feilet." >&2
  exit $update_status
fi

echo "Oppdatert $FUNCTION_NAME med VPC-konfigurasjon og Redis-hemmeligheter fra $DATA_STACK i $REGION." >&2
