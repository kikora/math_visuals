#!/usr/bin/env bash

# Source-friendly helper: `source scripts/cloudshell-check-examples.sh && cloudshell_check_examples --url=...`

DEFAULT_REGION="${DEFAULT_REGION:-eu-west-1}"

usage() {
  cat <<'USAGE'
Bruk: DATA_STACK=<stack-navn> API_URL="https://<domene>/api/examples" bash scripts/cloudshell-check-examples.sh

Alternativt kan du oppgi flagg:
  --region=REGION          AWS-regionen som inneholder stacken (standard: verdien i
                           $REGION/$AWS_REGION/$AWS_DEFAULT_REGION/$DEFAULT_REGION eller eu-west-1)
  --stack=STACK            Navnet på CloudFormation-stacken for data (standard: verdien i $DATA_STACK eller math-visuals-data)
  --static-stack=STACK     Navnet på CloudFormation-stacken for statisk web (brukes når API_URL ikke er satt,
                           standard: verdien i $STATIC_STACK eller math-visuals-static-site)
  --url=URL                URL-en til /api/examples som skal testes (kan også settes via API_URL)
  --trace                  Slå på shell tracing (set -x) for feilsøking
  -h, --help               Vis denne hjelpeteksten

Eksempel:
  DATA_STACK=math-visuals-data \
    API_URL="https://eksempel.no/api/examples" \
    bash scripts/cloudshell-check-examples.sh

Kilde og kjør manuelt:
  DATA_STACK=math-visuals-data \
    API_URL="https://eksempel.no/api/examples" \
    source scripts/cloudshell-check-examples.sh && cloudshell_check_examples
USAGE
}

cloudshell_check_examples() {
  local -
  set -euo pipefail

  REGION=${REGION:-${AWS_REGION:-${AWS_DEFAULT_REGION:-$DEFAULT_REGION}}}
  DATA_STACK=${DATA_STACK:-math-visuals-data}
  STATIC_STACK=${STATIC_STACK:-math-visuals-static-site}
  API_URL=${API_URL:-}
  local trace=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --region=*)
        REGION="${1#*=}"
        ;;
      --stack=*)
        DATA_STACK="${1#*=}"
        ;;
      --static-stack=*)
        STATIC_STACK="${1#*=}"
        ;;
      --url=*)
        API_URL="${1#*=}"
        ;;
      --trace)
        trace=true
        ;;
      -h|--help)
        usage
        return 0
        ;;
      *)
        echo "Ukjent flagg: $1" >&2
        usage >&2
        return 1
        ;;
    esac
    shift
  done

  if [[ "$trace" == true ]] || [[ "${CLOUDSHELL_TRACE:-false}" == true ]]; then
    set -x
  fi

  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI mangler. Installer den (CloudShell har den ferdig installert)." >&2
    return 1
  fi

  if ! command -v jq >/dev/null 2>&1; then
    echo "jq mangler. Installer den før du kjører skriptet." >&2
    return 1
  fi

  describe_output_for_stack() {
    local stack_name="$1"
    local key="$2"
    aws cloudformation describe-stacks \
      --region "$REGION" \
      --stack-name "$stack_name" \
      --query "Stacks[0].Outputs[?OutputKey==\`$key\`].OutputValue" \
      --output text
  }

  describe_output() {
    describe_output_for_stack "$DATA_STACK" "$1"
  }

  if [[ -z "${API_URL}" ]]; then
    echo "API_URL er ikke satt. Forsøker å finne CloudFront-domenet fra stacken $STATIC_STACK ..."
    local static_domain
    static_domain=$(describe_output_for_stack "$STATIC_STACK" "CloudFrontDistributionDomainName")
    if [[ -n "$static_domain" && "$static_domain" != "None" ]]; then
      API_URL="https://${static_domain}/api/examples"
      echo "Fant CloudFrontDistributionDomainName=$static_domain i stacken $STATIC_STACK. Bruker API_URL=$API_URL"
    else
      echo "Fant ikke CloudFrontDistributionDomainName i stacken $STATIC_STACK. Angi API_URL eller --url=..." >&2
      return 1
    fi
  fi

  echo "Region:        $REGION"
  echo "Data-stack:    $DATA_STACK"
  echo "Static-stack:  $STATIC_STACK"
  echo "API-URL:       $API_URL"

  require_value() {
    local value="$1"
    local label="$2"
    if [[ -z "$value" || "$value" == "None" ]]; then
      echo "Fant ikke verdi for $label. Sjekk at stacken '$DATA_STACK' finnes i region '$REGION'." >&2
      return 1
    fi
  }

  echo "Henter Parameter Store-/Secrets Manager-navn ..."
  REDIS_ENDPOINT_PARAMETER=$(describe_output "RedisEndpointParameterName")
  REDIS_PORT_PARAMETER=$(describe_output "RedisPortParameterName")
  REDIS_PASSWORD_SECRET=$(describe_output "RedisPasswordSecretName")

  require_value "$REDIS_ENDPOINT_PARAMETER" "RedisEndpointParameterName"
  require_value "$REDIS_PORT_PARAMETER" "RedisPortParameterName"
  require_value "$REDIS_PASSWORD_SECRET" "RedisPasswordSecretName"

  echo "Leser REDIS_ENDPOINT fra $REDIS_ENDPOINT_PARAMETER ..."
  export REDIS_ENDPOINT=$(aws ssm get-parameter \
    --region "$REGION" \
    --name "$REDIS_ENDPOINT_PARAMETER" \
    --query 'Parameter.Value' \
    --output text)

  echo "Leser REDIS_PORT fra $REDIS_PORT_PARAMETER ..."
  export REDIS_PORT=$(aws ssm get-parameter \
    --region "$REGION" \
    --name "$REDIS_PORT_PARAMETER" \
    --query 'Parameter.Value' \
    --output text)

  echo "Leser REDIS_PASSWORD fra secret $REDIS_PASSWORD_SECRET ..."
  secret_payload=$(aws secretsmanager get-secret-value \
    --region "$REGION" \
    --secret-id "$REDIS_PASSWORD_SECRET" \
    --query 'SecretString' \
    --output text)

  if key_value=$(jq -er '
    if type == "object" then
      if .authToken? then ["authToken", .authToken]
      elif .password? then ["password", .password]
      elif .secret? then ["secret", .secret]
      elif .value? then ["value", .value]
      elif .token? then ["token", .token]
      else empty end
    else empty end | @tsv' <<<"$secret_payload" 2>/dev/null); then
    REDIS_PASSWORD_SOURCE=${key_value%%$'\t'*}
    REDIS_PASSWORD=${key_value#*$'\t'}
  else
    REDIS_PASSWORD_SOURCE="raw secret string"
    REDIS_PASSWORD="$secret_payload"
  fi

  if [[ -n "$REDIS_PASSWORD" ]]; then
    echo "Fant Redis-passord under nøkkelen: $REDIS_PASSWORD_SOURCE"
  else
    echo "Secret $REDIS_PASSWORD_SECRET inneholder ikke authToken, password, secret, value eller token og ingen rå tekst kunne brukes." >&2
    return 1
  fi

  export REDIS_PASSWORD

  echo "REDIS_* er eksportert i dette shell-et. Kjører npm run check-examples-api ..."
  npm run check-examples-api -- --url="$API_URL"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  cloudshell_check_examples "$@"
else
  return 0
fi
