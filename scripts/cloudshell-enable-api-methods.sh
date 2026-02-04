#!/usr/bin/env bash
set -euo pipefail

# This helper updates the CloudFront behaviours backing the API origin so
# PUT/POST/PATCH/DELETE requests can reach the Lambda/API Gateway backend.
# It is intended for use from AWS CloudShell where the AWS CLI is already
# authenticated.

DEFAULT_STACK_NAME=${DEFAULT_STACK_NAME:-math-visuals-static-site}
DEFAULT_REGION=${DEFAULT_REGION:-eu-west-1}
DEFAULT_CLOUDFRONT_REGION=${DEFAULT_CLOUDFRONT_REGION:-us-east-1}

usage() {
  cat <<'USAGE'
Bruk: bash scripts/cloudshell-enable-api-methods.sh [flagg]

Oppdaterer CloudFront-distribusjonen slik at alle API-bane-mønstre støtter
GET, HEAD, OPTIONS, PUT, POST, PATCH og DELETE. Skriptet henter
CloudFront-ID-en fra math-visuals-static-site-stacken med mindre du
overstyrer den.

Tilgjengelige flagg:
  --stack-name=NAME           CloudFormation-stack med CloudFront-distribusjonen (standard: math-visuals-static-site)
  --region=REGION             Regionen stacken ligger i (standard: eu-west-1)
  --cloudfront-region=REGION  Regionen som brukes for CloudFront API-kall (standard: us-east-1)
  --distribution-id=ID        Oppgi CloudFront-distribusjons-ID direkte og hopp over describe-stacks
  --trace                     Slå på shell tracing (set -x)
  -h, --help                  Vis denne hjelpen

Forutsetninger: aws, jq og bash må være tilgjengelig, og AWS-legitimasjon må
ha rettigheter til å lese og oppdatere distribusjonen.
USAGE
}

STACK_NAME=$DEFAULT_STACK_NAME
REGION=$DEFAULT_REGION
CLOUDFRONT_REGION=$DEFAULT_CLOUDFRONT_REGION
DISTRIBUTION_ID=""
TRACE=false
SHOW_HELP=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stack-name=*)
      STACK_NAME="${1#*=}"
      ;;
    --region=*)
      REGION="${1#*=}"
      ;;
    --cloudfront-region=*)
      CLOUDFRONT_REGION="${1#*=}"
      ;;
    --distribution-id=*)
      DISTRIBUTION_ID="${1#*=}"
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

if [[ "$TRACE" == true ]]; then
  set -x
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Kommandoen '$1' er ikke tilgjengelig i PATH. Installer den før du fortsetter." >&2
    exit 1
  fi
}

for cmd in aws jq; do
  require_cmd "$cmd"
done

if [[ -z "$DISTRIBUTION_ID" ]]; then
  DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text)

  if [[ -z "$DISTRIBUTION_ID" || "$DISTRIBUTION_ID" == "None" ]]; then
    echo "Fant ingen CloudFrontDistributionId-output på stacken '$STACK_NAME' i region '$REGION'." >&2
    exit 1
  fi
fi

echo "Oppdaterer CloudFront-distribusjon: $DISTRIBUTION_ID"

RAW_CONFIG=$(mktemp)
PATCHED_CONFIG=$(mktemp)

aws cloudfront get-distribution-config \
  --region "$CLOUDFRONT_REGION" \
  --id "$DISTRIBUTION_ID" > "$RAW_CONFIG"

ETAG=$(jq -r '.ETag' "$RAW_CONFIG")
if [[ -z "$ETAG" || "$ETAG" == "null" ]]; then
  echo "Klarte ikke å hente ETag for distribusjon $DISTRIBUTION_ID." >&2
  exit 1
fi

jq '
  .DistributionConfig
  | (.DefaultCacheBehavior? // {}) |= (
      .AllowedMethods.Items = ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"]
      | .AllowedMethods.Quantity = 7
    )
  | (.CacheBehaviors.Items? // []) |= map(
      if .TargetOriginId == "ApiGatewayOrigin" then
        .AllowedMethods.Items = ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"]
        | .AllowedMethods.Quantity = 7
      else . end
    )
  | if .CacheBehaviors? then .CacheBehaviors.Quantity = (.CacheBehaviors.Items | length) else . end
' "$RAW_CONFIG" > "$PATCHED_CONFIG"

aws cloudfront update-distribution \
  --region "$CLOUDFRONT_REGION" \
  --id "$DISTRIBUTION_ID" \
  --if-match "$ETAG" \
  --distribution-config file://"$PATCHED_CONFIG"

echo "Tillatte metoder for API-opprinnelsen er nå oppdatert. Det kan ta noen minutter før endringen er propagert."
