#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REGION=${DEFAULT_REGION:-eu-west-1}
DEFAULT_API_STACK=${DEFAULT_API_STACK:-math-visuals-api}
DEFAULT_LOG_GROUP=${DEFAULT_LOG_GROUP:-/aws/lambda/math-visuals-api}
LOOKBACK_MINUTES=${LOOKBACK_MINUTES:-30}

usage() {
  cat <<'USAGE'
Bruk: bash scripts/cloudshell-lambda-debug.sh [flagg]

Flagg:
  --region=REGION        AWS-region (standard: eu-west-1)
  --api-stack=STACK      CloudFormation-stacken for API-et (standard: math-visuals-api)
  --log-group=NAME       CloudWatch-logggruppen (standard: /aws/lambda/math-visuals-api)
  --since=MINUTTER       Hvor langt tilbake loggene skal hentes (standard: 30)
  --trace                Slå på set -x for feilsøking
  -h, --help             Vis hjelpen

Skriptet løser Lambda-funksjonsnavn fra stack-outputen `ApiFunctionArn`, viser
REDIS_* miljøvariabler og forsøker å hente Redis-relaterte logglinjer med best
mulig `aws logs`-kommando basert på CLI-versjonen.
USAGE
}

REGION="$DEFAULT_REGION"
API_STACK="$DEFAULT_API_STACK"
LOG_GROUP="$DEFAULT_LOG_GROUP"
TRACE=false
SINCE_MINUTES="$LOOKBACK_MINUTES"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region=*)
      REGION="${1#*=}"
      ;;
    --api-stack=*)
      API_STACK="${1#*=}"
      ;;
    --log-group=*)
      LOG_GROUP="${1#*=}"
      ;;
    --since=*)
      SINCE_MINUTES="${1#*=}"
      ;;
    --trace)
      TRACE=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Ukjent flagg: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ "$TRACE" == true ]]; then
  set -x
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Kommandoen '$1' mangler i PATH." >&2
    exit 1
  fi
}

for cmd in aws jq; do
  require_cmd "$cmd"
done

if [[ -z "$REGION" ]]; then
  echo "REGION er tom. Sett --region eller miljøvariabelen DEFAULT_REGION." >&2
  exit 1
fi

resolve_function_name() {
  local arn
  arn=$(aws cloudformation describe-stacks \
    --stack-name "$API_STACK" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiFunctionArn'].OutputValue" \
    --output text)
  if [[ -z "$arn" || "$arn" == "None" ]]; then
    echo "Fant ikke ApiFunctionArn i stacken '$API_STACK' i region '$REGION'." >&2
    return 1
  fi
  echo "${arn##*:function:}"
}

print_env() {
  local fn_name="$1"
  echo "\n### Environment variables (Lambda ser disse verdiene):"
  aws lambda get-function-configuration \
    --function-name "$fn_name" \
    --region "$REGION" \
    --query '{Endpoint:Environment.Variables.REDIS_ENDPOINT,Port:Environment.Variables.REDIS_PORT,Password:Environment.Variables.REDIS_PASSWORD,All:Environment.Variables}'
}

best_tail_command() {
  if aws cloudwatch logs tail --help >/dev/null 2>&1; then
    echo "cloudwatch-v2"
    return 0
  fi
  if aws logs tail --help >/dev/null 2>&1; then
    echo "logs-tail"
    return 0
  fi
  echo "filter"
}

print_logs() {
  local mode
  mode=$(best_tail_command)
  echo "\n### Redis-logglinjer (siste ${SINCE_MINUTES}m):"
  case "$mode" in
    cloudwatch-v2)
      aws cloudwatch logs tail "$LOG_GROUP" \
        --since "${SINCE_MINUTES}m" \
        --region "$REGION" \
        --filter-pattern 'Redis' \
        --format short \
        --max-items 200 || true
      ;;
    logs-tail)
      aws logs tail "$LOG_GROUP" \
        --since "${SINCE_MINUTES}m" \
        --region "$REGION" \
        --filter-pattern 'Redis' \
        --format short \
        --max-items 200 || true
      ;;
    *)
      local start_ms
      start_ms=$(($(date +%s -d "-${SINCE_MINUTES} minutes")*1000))
      aws logs filter-log-events \
        --log-group-name "$LOG_GROUP" \
        --start-time "$start_ms" \
        --filter-pattern 'Redis' \
        --limit 200 \
        --region "$REGION" \
        --output text || true
      ;;
  esac
}

main() {
  echo "Region: $REGION"
  echo "API stack: $API_STACK"
  echo "Log group: $LOG_GROUP"

  local fn_name
  fn_name=$(resolve_function_name)
  echo "Lambda function: $fn_name"

  print_env "$fn_name"
  print_logs

  cat <<'INTERP'

Tolkning:
- "Redis KV is not configured" => manglende host/port/passord.
- "Unable to establish Redis connection" med WRONGPASS => feil passord.
- "Unable to establish Redis connection" med ETIMEDOUT => nettverk/SG.
Hvis ingenting dukker opp, øk --since og/eller trigge et API-kall for ferske logger.
INTERP
}

main "$@"
