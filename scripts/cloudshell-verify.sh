#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REGION=${DEFAULT_REGION:-eu-west-1}
DEFAULT_CLOUDFRONT_REGION=${DEFAULT_CLOUDFRONT_REGION:-us-east-1}
DEFAULT_DATA_STACK=${DEFAULT_DATA_STACK:-math-visuals-data}
DEFAULT_STATIC_STACK=${DEFAULT_STATIC_STACK:-math-visuals-static-site}
DEFAULT_API_STACK=${DEFAULT_API_STACK:-math-visuals-api}
DEFAULT_LOG_GROUP=${DEFAULT_LOG_GROUP:-/aws/lambda/math-visuals-api}
DEFAULT_METRIC_NAMESPACE=${DEFAULT_METRIC_NAMESPACE:-MathVisuals/Verification}
OVERALL_STATUS=0
S3_DOMAIN_PATTERNS=(".s3." ".s3-website-" ".s3.amazonaws.com")

usage() {
  cat <<'USAGE'
Bruk: bash scripts/cloudshell-verify.sh [flagg]

Tilgjengelige flagg:
  --region=REGION              Regionen der data/API-stakkene ligger (standard: eu-west-1)
  --cloudfront-region=REGION   Regionen som brukes for CloudFront API-kall (standard: us-east-1)
  --data-stack=STACK           CloudFormation-stacken som eier Redis-outputs (standard: math-visuals-data)
  --api-stack=STACK            CloudFormation-stacken som eier API-et (for logg-lookup, standard: math-visuals-api)
  --static-stack=STACK         CloudFormation-stacken som eier CloudFront/S3-outputs (standard: math-visuals-static-site)
  --api-gateway-domain=DOMAIN  Overstyr ApiGatewayDomainName-parameteren fra stacken (f.eks. abc.execute-api.us-east-1.amazonaws.com)
  --api-url=URL                Overstyr CloudFront-oppslaget og bruk denne URL-en for /api/examples-testene (hopper over describe-stacks)
  --log-group=NAME             CloudWatch-logggruppen til Lambdaen (standard: /aws/lambda/math-visuals-api)
  --trace                      Slå på shell tracing (set -x) for å feilsøke tidlige stopp
  -h, --help                   Vis denne hjelpen

Skriptet krever at du allerede har kjørt `aws configure` eller `aws sso login`.
Logg-trinnet støtter AWS CLI v2 (`aws cloudwatch logs tail`) eller AWS CLI v1 med `aws logs tail`; eldre v1-versjoner faller tilbake til `filter-log-events`.
USAGE
}

REGION=$DEFAULT_REGION
CLOUDFRONT_REGION=$DEFAULT_CLOUDFRONT_REGION
DATA_STACK=$DEFAULT_DATA_STACK
STATIC_STACK=$DEFAULT_STATIC_STACK
API_STACK=$DEFAULT_API_STACK
LOG_GROUP=$DEFAULT_LOG_GROUP
API_URL_OVERRIDE=""
API_GATEWAY_DOMAIN_OVERRIDE=""
TRACE=false
SHOW_HELP=false
LOG_GROUP_SET=false
CF_DOMAIN=""
API_URL=""
API_GATEWAY_DOMAIN=""
HELPER_STATUS="not-run"
OVERALL_STATUS=0
AWS_TAIL_CMD=()
AWS_TAIL_NAME=""
AWS_VERSION_STRING=""
METRIC_NAMESPACE=$DEFAULT_METRIC_NAMESPACE
LOG_GROUP_WARNINGS=()

print_summary() {
  local exit_code="$1"
  local api_value="${API_URL:-<unset>}"
  local cf_value="${CF_DOMAIN:-<unset>}"
  local redis_value="${REDIS_ENDPOINT:-<unset>}"
  local helper_value="${HELPER_STATUS:-not-set}"
  local overall_value="${OVERALL_STATUS:-$exit_code}"
  local log_group_value="${LOG_GROUP:-<unset>}"

  cat <<EOF

==> Sluttstatus
API_URL=${api_value}
CF_DOMAIN=${cf_value}
REDIS_ENDPOINT=${redis_value}
HELPER_STATUS=${helper_value}
LOG_GROUP=${log_group_value}
OVERALL_STATUS=${overall_value}
EOF
}

if [[ "${CLOUDSHELL_VERIFY_LIB_ONLY:-}" != "1" ]]; then
  trap 'exit_code=$?; print_summary "$exit_code"; exit "$exit_code"' EXIT
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region=*)
      REGION="${1#*=}"
      ;;
    --cloudfront-region=*)
      CLOUDFRONT_REGION="${1#*=}"
      ;;
    --data-stack=*)
      DATA_STACK="${1#*=}"
      ;;
    --api-stack=*)
      API_STACK="${1#*=}"
      ;;
    --static-stack=*)
      STATIC_STACK="${1#*=}"
      ;;
    --api-gateway-domain=*)
      API_GATEWAY_DOMAIN_OVERRIDE="${1#*=}"
      ;;
    --api-url=*)
      API_URL_OVERRIDE="${1#*=}"
      ;;
    --log-group=*)
      LOG_GROUP="${1#*=}"
      LOG_GROUP_SET=true
      ;;
    --trace)
      TRACE=true
      ;;
    -h|--help)
      SHOW_HELP=true
      ;;
    *)
      echo "Ukjent flagg: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ "$SHOW_HELP" == true ]]; then
  usage
  exit 0
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Kommandoen '$1' er ikke tilgjengelig i PATH. Installer den før du fortsetter." >&2
    exit 1
  fi
}

for cmd in aws jq curl; do
  require_cmd "$cmd"
done

record_status() {
  local status="$1"
  local label="$2"
  local message="${3:-}"
  local severity="${4:-fail}"

  if [[ "$status" -ne 0 ]]; then
    if [[ "$severity" == "warn" ]]; then
      if [[ -n "$message" ]]; then
        echo "$label (advarsel): $message"
      else
        echo "$label (advarsel): uavklart problem"
      fi
      return
    fi

    OVERALL_STATUS=1
    if [[ -n "$message" ]]; then
      echo "$label feilet: $message" >&2
    else
      echo "$label feilet" >&2
    fi
  else
    if [[ -n "$message" ]]; then
      echo "$label: $message"
    else
      echo "$label: OK"
    fi
  fi
}

  if [[ "$TRACE" == true ]]; then
    set -x
  fi

  SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
  CHECK_SCRIPT="$SCRIPT_DIR/cloudshell-check-examples.sh"

publish_ping_metric() {
  local value="$1"
  local reason="${2:-}"

  if [[ -z "$METRIC_NAMESPACE" ]]; then
    return
  fi

  set +e
  aws cloudwatch put-metric-data \
    --namespace "$METRIC_NAMESPACE" \
    --metric-name RedisPingStatus \
    --value "$value" \
    --unit Count \
    --dimensions Stack="$DATA_STACK",ApiStack="$API_STACK" \
    --storage-resolution 60 \
    --region "$REGION" >/dev/null 2>&1
  local publish_status=$?
  set -e

  if [[ "$publish_status" -eq 0 ]]; then
    if [[ -n "$reason" ]]; then
      echo "Publiserte RedisPingStatus=$value (${reason}) til CloudWatch ($METRIC_NAMESPACE)."
    fi
  else
    echo "Klarte ikke å publisere RedisPingStatus til CloudWatch; fortsetter uten alarmhistorikk." >&2
  fi
}

if [[ ! -f "$CHECK_SCRIPT" ]]; then
  echo "Fant ikke helper-skriptet $CHECK_SCRIPT" >&2
  exit 1
fi

# Hjelpefunksjoner for CloudFormation-outputs
describe_output_for_stack() {
  local stack_name="$1"
  local output_key="$2"
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey==\`$output_key\`].OutputValue" \
    --output text
}

describe_parameter_for_stack() {
  local stack_name="$1"
  local parameter_key="$2"
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$stack_name" \
    --query "Stacks[0].Parameters[?ParameterKey==\`$parameter_key\`].ParameterValue" \
    --output text
}

stack_exists() {
  local stack_name="$1"
  if aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$stack_name" \
    --query 'length(Stacks)' \
    --output text >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

extract_domain_from_url() {
  local url="$1"
  if [[ "$url" =~ ^https?://([^/]+)/? ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    return 1
  fi
}

log_group_has_streams() {
  local log_group_name="$1"
  if [[ -z "$log_group_name" ]]; then
    return 1
  fi

  local stream_count
  local describe_status=0
  stream_count=$(aws cloudwatch logs describe-log-streams \
    --region "$REGION" \
    --log-group-name "$log_group_name" \
    --limit 1 \
    --query 'length(logStreams)' \
    --output text 2>/dev/null) || describe_status=$?

  if [[ "$describe_status" -ne 0 ]]; then
    return 1
  fi

  if [[ "$stream_count" == "0" ]]; then
    LOG_GROUP_WARNINGS+=("Logggruppen $log_group_name finnes, men har ingen loggstrømmer ennå.")
    return 2
  fi

  if [[ "$stream_count" != "0" && "$stream_count" != "None" ]]; then
    return 0
  fi
  return 1
}

discover_log_groups() {
  local results=()

  if stack_exists "$API_STACK"; then
    local api_fn_arn
    api_fn_arn=$(describe_output_for_stack "$API_STACK" "ApiFunctionArn")
    if [[ -n "$api_fn_arn" && "$api_fn_arn" != "None" ]]; then
      local api_fn_name
      api_fn_name="${api_fn_arn##*:function:}"
      if [[ -n "$api_fn_name" ]]; then
        local api_log_group
        api_log_group="/aws/lambda/${api_fn_name}"
        local api_log_status=0
        if log_group_has_streams "$api_log_group"; then
          results+=("$api_log_group")
        else
          api_log_status=$?
          if [[ "$api_log_status" -eq 2 ]]; then
            LOG_GROUP_WARNINGS+=("Fant $api_log_group via ApiFunctionArn, men det er ingen loggstrømmer ennå.")
          fi
        fi
      fi
    fi
  fi

  local described_raw
  if described_raw=$(aws logs describe-log-groups \
    --region "$REGION" \
    --log-group-name-prefix "$DEFAULT_LOG_GROUP" \
    --query 'logGroups[].logGroupName' \
    --output text 2>/dev/null); then
    local IFS=$'\n'
    local described=()
    mapfile -t described <<< "$(printf '%s\n' "$described_raw" | tr '\t' '\n')"
    for lg in "${described[@]}"; do
      if [[ -n "$lg" ]]; then
        local describe_status=0
        if log_group_has_streams "$lg"; then
          results+=("$lg")
        else
          describe_status=$?
          if [[ "$describe_status" -eq 2 ]]; then
            LOG_GROUP_WARNINGS+=("$lg ble funnet, men mangler loggstrømmer så langt.")
          fi
        fi
      fi
    done
  fi

  printf '%s\n' "${results[@]}"
}

detect_tail_command() {
  if AWS_VERSION_STRING=$(aws --version 2>/dev/null); then
    if [[ "$AWS_VERSION_STRING" =~ aws-cli/([0-9]+)\. ]]; then
      local aws_major_version
      aws_major_version="${BASH_REMATCH[1]}"

      if [[ "$aws_major_version" -ge 2 ]] && aws cloudwatch logs tail --help >/dev/null 2>&1; then
        AWS_TAIL_CMD=(aws cloudwatch logs tail)
        AWS_TAIL_NAME="aws cloudwatch logs tail (AWS CLI v${aws_major_version})"
        return 0
      fi

      if [[ "$aws_major_version" -eq 1 ]] && aws logs tail --help >/dev/null 2>&1; then
        AWS_TAIL_CMD=(aws logs tail)
        AWS_TAIL_NAME="aws logs tail (AWS CLI v${aws_major_version})"
        return 0
      fi
    fi
  fi

  if aws cloudwatch logs tail --help >/dev/null 2>&1; then
    AWS_TAIL_CMD=(aws cloudwatch logs tail)
    AWS_TAIL_NAME="aws cloudwatch logs tail"
    return 0
  fi

  if aws logs tail --help >/dev/null 2>&1; then
    AWS_TAIL_CMD=(aws logs tail)
    AWS_TAIL_NAME="aws logs tail"
    return 0
  fi

  return 1
}

resolve_log_group() {
  if [[ "$LOG_GROUP_SET" == true ]]; then
    return
  fi

  mapfile -t DISCOVERED_LOG_GROUPS < <(discover_log_groups)

  for candidate in "${DISCOVERED_LOG_GROUPS[@]}"; do
    if log_group_has_streams "$candidate"; then
      LOG_GROUP="$candidate"
      return
    fi
  done

  local api_fn_prefix
  api_fn_prefix="${DEFAULT_LOG_GROUP}-ApiFunction"
  local described_raw
  if described_raw=$(aws logs describe-log-groups \
    --region "$REGION" \
    --log-group-name-prefix "$api_fn_prefix" \
    --query 'logGroups[].logGroupName' \
    --output text 2>/dev/null); then
    local IFS=$'\n'
    local described=()
    mapfile -t described <<< "$(printf '%s\n' "$described_raw" | tr '\t' '\n')"
    for lg in "${described[@]}"; do
      if log_group_has_streams "$lg"; then
        LOG_GROUP="$lg"
        return
      fi
    done
  fi

  if log_group_has_streams "$LOG_GROUP"; then
    return
  fi

  if [[ "$?" -eq 2 ]]; then
    LOG_GROUP_WARNINGS+=("$LOG_GROUP finnes, men har ingen loggstrømmer ennå.")
  fi

  LOG_GROUP=""
}

tail_logs() {
  if [[ -z "$LOG_GROUP" ]]; then
    echo "LOG_GROUP er tom. Hopper over CloudWatch-tail."
    return
  fi

  echo "Bruker logggruppe: $LOG_GROUP"
  echo "==> Tailer de siste 15 minuttene med Lambda-logger for å se etter Redis/advarsler ..."
  local TAIL_STATUS=0
  set +e
  if detect_tail_command; then
    if [[ -n "$AWS_VERSION_STRING" ]]; then
      echo "Fant $AWS_TAIL_NAME basert på $AWS_VERSION_STRING"
    else
      echo "Fant $AWS_TAIL_NAME"
    fi

    "${AWS_TAIL_CMD[@]}" "$LOG_GROUP" \
      --region "$REGION" \
      --since 15m \
      --format short | grep -Ei 'mode|kv'
    TAIL_STATUS=$?
  else
    echo "Fant verken aws cloudwatch logs tail (AWS CLI v2) eller aws logs tail (AWS CLI v1). Prøver filter-log-events som fallback ..." >&2
    echo "Installer AWS CLI v2 eller en nyere v1 med 'aws logs tail' for raskere loggvisning." >&2
    local local_end_ts
    local local_start_ts
    local_end_ts=$(date -u +%s)
    local_start_ts=$((local_end_ts - 1800)) # 30 minutter tilbakeblikk
    aws logs filter-log-events \
      --log-group-name "$LOG_GROUP" \
      --region "$REGION" \
      --start-time $((local_start_ts * 1000)) \
      --end-time $((local_end_ts * 1000)) \
      --query 'events[].message' \
      --output text | grep -Ei 'mode|kv'
    TAIL_STATUS=$?
  fi
  set -e
  if [[ "$TAIL_STATUS" -ne 0 ]]; then
    echo "CloudWatch-loggtrinnet feilet eller ga ingen treff; fortsetter verifiseringen." >&2
  fi
}

ping_redis() {
  echo "==> Kjører direkte PING mot Redis for å validere REDIS_* verdiene ..."

  local redis_client=""
  local auth_var_name=""
  if command -v redis-cli >/dev/null 2>&1; then
    redis_client="redis-cli"
    auth_var_name="REDISCLI_AUTH"
  elif command -v valkey-cli >/dev/null 2>&1; then
    redis_client="valkey-cli"
    auth_var_name="VALKEYCLI_AUTH"
  fi

  if [[ -z "$redis_client" ]]; then
    record_status 1 "Redis PING" "redis-cli/valkey-cli mangler i PATH"
    return
  fi

  if [[ -n "$auth_var_name" && -n ${REDIS_PASSWORD:-} ]]; then
    export "$auth_var_name"="$REDIS_PASSWORD"
  fi

  set +e
  local ping_output
  ping_output=$($redis_client --tls -h "$REDIS_ENDPOINT" -p "$REDIS_PORT" PING 2>&1)
  local ping_status=$?
  set -e

  if [[ "$ping_status" -eq 0 && "$ping_output" =~ PONG ]]; then
    record_status 0 "Redis PING" "$ping_output"
    publish_ping_metric 1 "Redis PING: PONG"
  else
    local reason="ukjent feil"
    local severity="fail"
    local lower_output
    lower_output=$(echo "$ping_output" | tr '[:upper:]' '[:lower:]')
    if [[ "$lower_output" == *"wrongpass"* || "$lower_output" == *"noauth"* || "$lower_output" == *"auth"* ]]; then
      reason="Redis auth failed"
      severity="fail"
    elif [[ "$lower_output" == *"timeout"* ]]; then
      reason="network timeout"
      severity="warn"
    elif [[ "$lower_output" == *"refused"* ]]; then
      reason="connection refused"
      severity="warn"
    elif [[ "$lower_output" == *"unreachable"* || "$lower_output" == *"no route"* ]]; then
      reason="network unreachable"
      severity="warn"
    fi
    echo "$ping_output" >&2
    if [[ "$severity" == "warn" ]]; then
      reason+=" (API-testen passerte, så CloudShell kan mangle direkte tilgang til Redis. Behandle dette som en advarsel med mindre API-kallene feiler.)"
    fi
    record_status 1 "Redis PING" "$reason" "$severity"
    publish_ping_metric 0 "$reason"
  fi

  # Ikke stopp skriptet dersom PING feiler; la resten av sjekkene kjøre for mer kontekst.
  return 0
}

if [[ "${CLOUDSHELL_VERIFY_LIB_ONLY:-}" == "1" && "${BASH_SOURCE[0]}" != "$0" ]]; then
  return
fi

# 1. Hent Redis-konfig og sjekk API-et
source "$CHECK_SCRIPT"
echo "==> Verifiserer Redis-parametere og API via cloudshell_check_examples ..."
CHECK_ARGS=(--region="$REGION" --stack="$DATA_STACK" --static-stack="$STATIC_STACK")
if [[ -n "$API_URL_OVERRIDE" ]]; then
  CHECK_ARGS+=(--url="$API_URL_OVERRIDE")
fi
if [[ "$TRACE" == true ]]; then
  CHECK_ARGS+=(--trace)
fi
CHECK_LOG=$(mktemp)
CLOUDSHELL_STATUS=0
( set +e; cloudshell_check_examples "${CHECK_ARGS[@]}" >"$CHECK_LOG" 2>&1 )
CLOUDSHELL_STATUS=$?
cat "$CHECK_LOG"
HELPER_STATUS=$CLOUDSHELL_STATUS
if [[ "$CLOUDSHELL_STATUS" -ne 0 ]]; then
  echo "cloudshell_check_examples stoppet med exit $CLOUDSHELL_STATUS; sjekk loggen i $CHECK_LOG eller utskriften over." >&2
  OVERALL_STATUS="$CLOUDSHELL_STATUS"
  exit "$CLOUDSHELL_STATUS"
fi
rm -f "$CHECK_LOG"

if [[ -z ${REDIS_ENDPOINT:-} || -z ${REDIS_PORT:-} || -z ${REDIS_PASSWORD:-} ]]; then
  echo "cloudshell_check_examples satte ikke REDIS_* variablene i miljøet" >&2
  OVERALL_STATUS=1
  exit 1
fi

ping_redis

# 2. Finn CloudFront-domenet og test sluttpunkter
CF_DOMAIN=""
API_URL=""

if [[ -n "$API_URL_OVERRIDE" ]]; then
  API_URL="$API_URL_OVERRIDE"
  if ! CF_DOMAIN=$(extract_domain_from_url "$API_URL_OVERRIDE"); then
    echo "Kunne ikke lese domenet fra --api-url=$API_URL_OVERRIDE. Oppgi en URL som starter med http(s)://" >&2
    exit 1
  fi
  if stack_exists "$STATIC_STACK"; then
    API_GATEWAY_DOMAIN=$(describe_parameter_for_stack "$STATIC_STACK" "ApiGatewayDomainName")
  fi
else
  STATIC_STACK_FOUND=true
  if ! stack_exists "$STATIC_STACK"; then
    STATIC_STACK_FOUND=false
    echo "Fant ikke CloudFormation-stacken '$STATIC_STACK' i region '$REGION'." >&2
    echo "Oppgi --static-stack=<navn> eller --api-url=https://ditt-domene/api/examples for å fortsette." >&2
    exit 1
  fi

  if [[ "$STATIC_STACK_FOUND" == true ]]; then
    CF_DOMAIN=$(describe_output_for_stack "$STATIC_STACK" "CloudFrontDistributionDomainName")
    API_GATEWAY_DOMAIN=$(describe_parameter_for_stack "$STATIC_STACK" "ApiGatewayDomainName")
  fi
  if [[ -z "$CF_DOMAIN" || "$CF_DOMAIN" == "None" ]]; then
    echo "Fant ikke CloudFrontDistributionDomainName i stacken $STATIC_STACK" >&2
    exit 1
  fi
  API_URL="https://${CF_DOMAIN}/api/examples"
fi

if [[ -n "$API_GATEWAY_DOMAIN_OVERRIDE" ]]; then
  API_GATEWAY_DOMAIN="$API_GATEWAY_DOMAIN_OVERRIDE"
fi

if [[ -z "$API_GATEWAY_DOMAIN" || "$API_GATEWAY_DOMAIN" == "None" ]]; then
  echo "Fant ikke ApiGatewayDomainName-parameteren. Oppgi --api-gateway-domain=<api-endpoint> eller bekreft at stacken $STATIC_STACK har parameteren satt." >&2
  exit 1
fi

echo "==> Slår opp CloudFront-domenet (${CF_DOMAIN}) og sjekker API-responsen for mode=kv ..."
curl -fsS "$API_URL" | jq '{mode, storage, persistent, updatedAt}'

echo "==> Bekrefter at /sortering/eksempel1 fungerer via CloudFront ..."
curl -I "https://${CF_DOMAIN}/sortering/eksempel1"

# 3. Valider CloudFront-origins
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --region "$CLOUDFRONT_REGION" \
  --query "DistributionList.Items[?DomainName=='${CF_DOMAIN}'].Id" \
  --output text)

if [[ -z "$DISTRIBUTION_ID" || "$DISTRIBUTION_ID" == "None" ]]; then
  echo "Fant ikke en CloudFront-distribusjon for $CF_DOMAIN i region $CLOUDFRONT_REGION" >&2
  exit 1
fi

echo "==> Henter CloudFront-distribusjonen (${DISTRIBUTION_ID}) og viser origins ..."
distribution_config=$(aws cloudfront get-distribution-config \
  --region "$CLOUDFRONT_REGION" \
  --id "$DISTRIBUTION_ID")

API_ORIGIN_DOMAIN=$(jq -r '.DistributionConfig.Origins.Items[] | select(.Id=="ApiGatewayOrigin") | .DomainName // ""' <<<"$distribution_config")
if [[ -z "$API_ORIGIN_DOMAIN" || "$API_ORIGIN_DOMAIN" == "None" ]]; then
  echo "Fant ikke en origin med Id=ApiGatewayOrigin i CloudFront-distribusjonen. Kontroller parameterne før redeploy." >&2
  exit 1
fi

api_origin_domain_lc=${API_ORIGIN_DOMAIN,,}
for pattern in "${S3_DOMAIN_PATTERNS[@]}"; do
  if [[ "$api_origin_domain_lc" == *"$pattern"* ]]; then
    echo "ApiGatewayOrigin peker til et S3-domene (${API_ORIGIN_DOMAIN}). Dette vil sende API-trafikk til bucket-oppsettet." >&2
    echo "Oppdater ApiGatewayDomainName til API Gateway-endepunktet (f.eks. abc.execute-api.us-east-1.amazonaws.com) før du kjører deploy-skriptet." >&2
    exit 1
  fi
done

expected_api_domain_lc=${API_GATEWAY_DOMAIN,,}
if [[ "$api_origin_domain_lc" != "$expected_api_domain_lc" ]]; then
  echo "ApiGatewayOrigin peker til ${API_ORIGIN_DOMAIN}, men ApiGatewayDomainName er satt til ${API_GATEWAY_DOMAIN}." >&2
  echo "Bekreft at parameteren matcher API Gateway-domenet før redeploy for å unngå å reintrodusere regressjonen." >&2
  exit 1
fi

jq '.DistributionConfig.Origins.Items' <<<"$distribution_config"

# 4. Tail CloudWatch-loggene
resolve_log_group
if [[ -z "$LOG_GROUP" ]]; then
  if [[ "${#LOG_GROUP_WARNINGS[@]}" -gt 0 ]]; then
    printf '%s\n' "${LOG_GROUP_WARNINGS[@]}" >&2
  else
    echo "Fant ingen logggruppe med loggstrømmer." >&2
  fi
  echo "Hopper over loggtrinnet inntil Lambdaen har generert de første loggstrømmene." >&2
  echo "Tips: bruk --log-group for å overstyre automatisk oppdagelse eller trigge et Lambda-kall for å opprette initiale loggstrømmer." >&2
else
  tail_logs
fi

echo "\nAlt ferdig. Bekreft at curl/jq- og loggutskriftene viser mode=\"kv\" for å sikre at Redis brukes."
exit "$OVERALL_STATUS"
