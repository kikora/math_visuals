#!/usr/bin/env bash
set -euo pipefail

# Simple helper to print all dev secrets/parameter values as KEY=VALUE lines
# for populating GitHub Actions secrets. Defaults are hard-coded to the dev
# environment in eu-west-1, with no placeholders.

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Mangler kommando: $1" >&2
    exit 1
  fi
}

get_output() {
  local stack="$1" key="$2"
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$stack" \
    --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue" \
    --output text
}

stack_exists() {
  local stack="$1"
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$stack" \
    --query 'Stacks[0].StackName' --output text >/dev/null 2>&1
}

fetch_shared_values() {
  local stack="$1"
  local pw_secret endpoint_param port_param

  if ! stack_exists "$stack"; then
    echo "Fant ikke shared stack '$stack' i region $REGION." >&2
    exit 1
  fi

  pw_secret=$(get_output "$stack" RedisPasswordSecretName)
  endpoint_param=$(get_output "$stack" RedisEndpointParameterName)
  port_param=$(get_output "$stack" RedisPortParameterName)

  if [[ -z "$pw_secret" || -z "$endpoint_param" || -z "$port_param" ]]; then
    echo "Fant ikke Redis-outputs i stacken '$stack'." >&2
    exit 1
  fi

  if ! aws secretsmanager describe-secret --region "$REGION" --secret-id "$pw_secret" >/dev/null 2>&1; then
    echo "Fant ikke Secrets Manager-secret '$pw_secret' fra stacken '$stack'." >&2
    exit 1
  fi

  REDIS_PASSWORD=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$pw_secret" --query SecretString --output text | jq -r '.authToken // .password // .auth_token')
  REDIS_ENDPOINT=$(aws ssm get-parameter --region "$REGION" --name "$endpoint_param" --with-decryption --query Parameter.Value --output text)
  REDIS_PORT=$(aws ssm get-parameter --region "$REGION" --name "$port_param" --with-decryption --query Parameter.Value --output text)

  REDIS_PASSWORD_SECRET_NAME="$pw_secret"
  REDIS_ENDPOINT_PARAM_NAME="$endpoint_param"
  REDIS_PORT_PARAM_NAME="$port_param"
}

fetch_static_values() {
  local stack="$1"
  if ! stack_exists "$stack"; then
    echo "[advarsel] Fant ikke static stack '$stack'. STATIC_SITE_* blir tomme." >&2
    STATIC_SITE_BUCKET_NAME=""
    STATIC_SITE_CLOUDFRONT_DISTRIBUTION_ID=""
    STATIC_SITE_API_DOMAIN=""
    return
  fi

  STATIC_SITE_BUCKET_NAME=$(get_output "$stack" StaticSiteBucketName)
  STATIC_SITE_CLOUDFRONT_DISTRIBUTION_ID=$(get_output "$stack" CloudFrontDistributionId)
  STATIC_SITE_API_DOMAIN=$(get_output "$stack" CloudFrontDistributionDomainName || true)
}

normalize_bucket_region() {
  local region="$1"
  case "$region" in
    ""|"None"|"null") echo "us-east-1" ;;
    "EU") echo "eu-west-1" ;;
    *) echo "$region" ;;
  esac
}

detect_artifact_bucket() {
  while read -r bucket; do
    [[ -z "$bucket" ]] && continue
    [[ "$bucket" =~ ^math-visuals.*artifacts ]] || continue
    local location
    location=$(aws s3api get-bucket-location --region "$REGION" --bucket "$bucket" --query LocationConstraint --output text)
    location=$(normalize_bucket_region "$location")
    if [[ "$location" == "$REGION" ]]; then
      echo "$bucket"
      return 0
    fi
  done < <(aws s3api list-buckets --query 'Buckets[].Name' --output text | tr '\t' '\n')
  return 1
}

detect_oidc_role() {
  aws iam list-roles --region "$REGION" --output json | jq -r '
    .Roles[]
    | select(.AssumeRolePolicyDocument | tostring | (contains("token.actions.githubusercontent.com") and contains("math_visuals")))
    | .Arn
  ' | head -n1
}

main() {
  require_cmd aws
  require_cmd jq

  REGION="eu-west-1"
  SHARED_STACK="math-visuals-shared-dev"
  STATIC_STACK="math-visuals-static-site-dev"
  API_STAGE_NAME="dev"
  STATIC_SITE_CLOUDFRONT_PRICE_CLASS="PriceClass_All"

  fetch_shared_values "$SHARED_STACK"
  fetch_static_values "$STATIC_STACK"

  API_ARTIFACT_BUCKET=""
  if detected_bucket=$(detect_artifact_bucket); then
    API_ARTIFACT_BUCKET="$detected_bucket"
  else
    echo "Kunne ikke auto-finne artefaktbøtte med prefix 'math-visuals' i $REGION." >&2
    exit 1
  fi

  AWS_IAC_ROLE_ARN=""
  if detected_role=$(detect_oidc_role); then
    AWS_IAC_ROLE_ARN="$detected_role"
  else
    echo "Kunne ikke auto-finne OIDC-rolle med token.actions.githubusercontent.com og math_visuals i policyen." >&2
    exit 1
  fi

  cat <<EOF
# Verdier hentet fra $REGION
AWS_REGION=$REGION
AWS_IAC_ROLE_ARN=$AWS_IAC_ROLE_ARN
STATIC_SITE_BUCKET_NAME=${STATIC_SITE_BUCKET_NAME:-}
STATIC_SITE_CLOUDFRONT_DISTRIBUTION_ID=${STATIC_SITE_CLOUDFRONT_DISTRIBUTION_ID:-}
STATIC_SITE_API_DOMAIN=${STATIC_SITE_API_DOMAIN:-}
STATIC_SITE_API_ORIGIN_PATH=/
STATIC_SITE_CLOUDFRONT_PRICE_CLASS=$STATIC_SITE_CLOUDFRONT_PRICE_CLASS
API_ARTIFACT_BUCKET=$API_ARTIFACT_BUCKET
API_ARTIFACT_KEY=lambda/api-lambda.zip
API_STAGE_NAME=$API_STAGE_NAME
REDIS_PASSWORD_SECRET_NAME=$REDIS_PASSWORD_SECRET_NAME
REDIS_ENDPOINT_PARAM_NAME=$REDIS_ENDPOINT_PARAM_NAME
REDIS_PORT_PARAM_NAME=$REDIS_PORT_PARAM_NAME
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_ENDPOINT=$REDIS_ENDPOINT
REDIS_PORT=$REDIS_PORT
EOF
}

main "$@"
