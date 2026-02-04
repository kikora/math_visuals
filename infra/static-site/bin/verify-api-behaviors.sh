#!/usr/bin/env bash
set -euo pipefail

STACK_NAME=${STACK_NAME:-math-visuals-static-site}
DISTRIBUTION_ID=${DISTRIBUTION_ID:-}
CLOUDFRONT_REGION=${CLOUDFRONT_REGION:-us-east-1}

usage() {
  cat <<'HELP'
Usage: verify-api-behaviors.sh [STACK_NAME] [DISTRIBUTION_ID]

Ensures the /api/* CloudFront behavior is first and targets the API Gateway
origin. When ordering or origins drift from the CloudFormation template the
script reapplies the correct configuration using aws cloudfront
update-distribution.
HELP
}

log() {
  printf '==> %s\n' "$*"
}

require_binary() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: missing required dependency '$1'" >&2
    exit 1
  fi
}

read_stack_output() {
  local key=$1
  aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue" --output text
}

resolve_distribution_id() {
  if [[ -n "$DISTRIBUTION_ID" ]]; then
    log "Using provided distribution ID $DISTRIBUTION_ID"
    return
  fi

  DISTRIBUTION_ID=$(read_stack_output "CloudFrontDistributionId")
  if [[ -z "$DISTRIBUTION_ID" || "$DISTRIBUTION_ID" == "None" ]]; then
    echo "error: unable to determine CloudFront distribution ID" >&2
    exit 1
  fi
  log "Discovered distribution ID $DISTRIBUTION_ID from stack $STACK_NAME"
}

fetch_distribution_config() {
  aws cloudfront get-distribution-config --region "$CLOUDFRONT_REGION" --id "$DISTRIBUTION_ID"
}

# Determine which origin should back /api/* by preferring execute-api hostnames.
resolve_api_origin_id() {
  local config_json=$1
  jq -r '
    .DistributionConfig.Origins.Items[]
    | select(.DomainName | test("execute-api[.]"))
    | .Id
    | select(length > 0)
  ' <<<"$config_json" | head -n1
}

summarize_behaviors() {
  local config_json=$1
  jq -r '
    ((.DistributionConfig.CacheBehaviors // .CacheBehaviors // {Items: []}).Items // [])
    | to_entries
    | map((.key | tostring) + ": " + .value.PathPattern + " -> origin '\''" + .value.TargetOriginId + "'\'' (AllowedMethods: " + ((.value.AllowedMethods // []) | join(",")) + ")")
    | .[]?
  ' <<<"$config_json"
}

summarize_origins() {
  local config_json=$1
  jq -r '((.DistributionConfig.Origins // .Origins).Items // [])[] | "- " + .Id + " => " + .DomainName' <<<"$config_json"
}

ensure_api_behavior() {
  local config_json=$1
  local etag updated_config applied_fix=false

  etag=$(jq -r '.ETag' <<<"$config_json")
  updated_config=$(jq '
    .DistributionConfig
    | .CacheBehaviors = ((.CacheBehaviors // {}) + {Items: ((.CacheBehaviors.Items // []))})
  ' <<<"$config_json")

  local api_index api_origin_id current_api_target
  api_index=$(jq -r '
    ((.CacheBehaviors // {Items: []}).Items)
    | map(.PathPattern)
    | index("/api/*")
  ' <<<"$updated_config")

  api_origin_id=$(resolve_api_origin_id "$config_json")
  current_api_target=$(jq -r '
    ((.CacheBehaviors // {Items: []}).Items)
    | map(select(.PathPattern == "/api/*"))
    | .[0].TargetOriginId // ""
  ' <<<"$updated_config")

  if [[ -z "$api_origin_id" ]]; then
    echo "error: unable to locate an execute-api origin in the distribution." >&2
    echo "Inspect the stack parameters or distribution origins before retrying." >&2
    exit 1
  fi

  if [[ "$api_index" == "null" ]]; then
    echo "error: /api/* behavior is missing from the distribution." >&2
    echo "Redeploy the stack to restore it." >&2
    exit 1
  fi

  if [[ "$api_index" -ne 0 ]]; then
    log "Reordering cache behaviors so /api/* has precedence 0"
    updated_config=$(jq '
      .CacheBehaviors.Items |= (
        (map(select(.PathPattern == "/api/*")) +
         map(select(.PathPattern != "/api/*"))))
      | .CacheBehaviors.Quantity = (.CacheBehaviors.Items | length)
    ' <<<"$updated_config")
    applied_fix=true
  fi

  if [[ -n "$api_origin_id" && "$current_api_target" != "$api_origin_id" ]]; then
    log "Pointing /api/* behavior to API origin $api_origin_id (was $current_api_target)"
    updated_config=$(jq --arg origin "$api_origin_id" '
      .CacheBehaviors.Items |= map(
        if .PathPattern == "/api/*" then .TargetOriginId = $origin else . end)
    ' <<<"$updated_config")
    applied_fix=true
  fi

  if [[ "$applied_fix" == true ]]; then
    local tmpfile
    tmpfile=$(mktemp)
    printf '%s\n' "$updated_config" > "$tmpfile"
    log "Applying CloudFront distribution update"
    aws cloudfront update-distribution --region "$CLOUDFRONT_REGION" --id "$DISTRIBUTION_ID" --if-match "$etag" --distribution-config file://"$tmpfile" >/dev/null
    rm -f "$tmpfile"
    echo "fix_applied"
  else
    echo "no_change"
  fi
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ge 1 ]]; then
  STACK_NAME=$1
fi
if [[ $# -ge 2 ]]; then
  DISTRIBUTION_ID=$2
fi

require_binary aws
require_binary jq

resolve_distribution_id

log "Fetching CloudFront distribution configuration"
config_json=$(fetch_distribution_config)

behavior_summary_before=$(summarize_behaviors "$config_json")
origin_summary=$(summarize_origins "$config_json")
result=$(ensure_api_behavior "$config_json")

if [[ "$result" == "fix_applied" ]]; then
  log "Re-fetching distribution config to report final ordering"
  config_json=$(fetch_distribution_config)
  behavior_summary_after=$(summarize_behaviors "$config_json")
else
  behavior_summary_after="$behavior_summary_before"
fi

cat <<REPORT

CloudFront distribution: $DISTRIBUTION_ID
Region: $CLOUDFRONT_REGION
Stack: $STACK_NAME

Origins:
$origin_summary

Cache behavior order (index: path -> origin):
$behavior_summary_after

Fix applied: $result
REPORT
