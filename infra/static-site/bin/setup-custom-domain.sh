#!/usr/bin/env bash
set -euo pipefail

# Automates the steps outlined in docs/aws-migration/custom-domain.md for
# attaching mathvisuals.no to the CloudFront distribution.

CUSTOM_DOMAIN=${CUSTOM_DOMAIN:-mathvisuals.no}
STACK_NAME=${STACK_NAME:-math-visuals-static-site}
ACM_REGION=${ACM_REGION:-eu-west-1}
CLOUDFRONT_REGION=${CLOUDFRONT_REGION:-eu-west-1}
ALT_NAMES_DEFAULT="www.$CUSTOM_DOMAIN app.$CUSTOM_DOMAIN"
ALT_NAMES=${ALT_NAMES:-$ALT_NAMES_DEFAULT}
HOSTED_ZONE_ID=${HOSTED_ZONE_ID:-}
DISTRIBUTION_ID=${DISTRIBUTION_ID:-}

function log() {
  printf '==> %s\n' "$*"
}

function require_binary() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: missing required dependency '$1'" >&2
    exit 1
  fi
}

require_binary aws
require_binary jq

function ensure_certificate() {
  log "Ensuring ACM certificate for $CUSTOM_DOMAIN exists in $ACM_REGION"
  local existing
  existing=$(aws acm list-certificates \
    --region "$ACM_REGION" \
    --certificate-statuses ISSUED PENDING_VALIDATION \
    --query "CertificateSummaryList[?DomainName=='$CUSTOM_DOMAIN'].CertificateArn" \
    --output text)
  if [[ -n "$existing" && "$existing" != "None" ]]; then
    CERTIFICATE_ARN=$existing
    log "Reusing existing certificate $CERTIFICATE_ARN"
  else
    CERTIFICATE_ARN=$(aws acm request-certificate \
      --region "$ACM_REGION" \
      --domain-name "$CUSTOM_DOMAIN" \
      --subject-alternative-names $ALT_NAMES \
      --validation-method DNS \
      --idempotency-token mathvisuals \
      --query 'CertificateArn' \
      --output text)
    log "Requested certificate $CERTIFICATE_ARN"
  fi

  log "Saving DNS validation records to certificate-validation-records.json"
  aws acm describe-certificate \
    --certificate-arn "$CERTIFICATE_ARN" \
    --region "$ACM_REGION" \
    --query 'Certificate.DomainValidationOptions[].ResourceRecord' \
    --output json > certificate-validation-records.json
  log "Create/confirm the CNAME records shown in certificate-validation-records.json before continuing"
}

function ensure_hosted_zone() {
  if [[ -n "$HOSTED_ZONE_ID" ]]; then
    log "Using provided hosted zone ID $HOSTED_ZONE_ID"
    return
  fi
  log "Looking up Route 53 hosted zone for $CUSTOM_DOMAIN"
  local lookup
  lookup=$(aws route53 list-hosted-zones-by-name \
    --dns-name "$CUSTOM_DOMAIN" \
    --query 'HostedZones[0].{Name:Name,Id:Id}' \
    --output json)
  local zone_name
  zone_name=$(jq -r '.Name // ""' <<<"$lookup")
  if [[ "$zone_name" == "$CUSTOM_DOMAIN." ]]; then
    HOSTED_ZONE_ID=$(jq -r '.Id' <<<"$lookup" | sed 's#^/hostedzone/##')
    log "Found existing hosted zone $HOSTED_ZONE_ID"
    return
  fi
  log "Creating new hosted zone for $CUSTOM_DOMAIN"
  HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
    --name "$CUSTOM_DOMAIN" \
    --caller-reference "mathvisuals-$(date +%s)" \
    --query 'HostedZone.Id' \
    --output text)
  HOSTED_ZONE_ID=${HOSTED_ZONE_ID#/hostedzone/}
  log "Hosted zone created: $HOSTED_ZONE_ID"
  aws route53 get-hosted-zone \
    --id "$HOSTED_ZONE_ID" \
    --query 'DelegationSet.NameServers' \
    --output json > nameservers.json
  log "Nameservers saved to nameservers.json – update the registrar to use them"
}

function resolve_distribution() {
  if [[ -n "$DISTRIBUTION_ID" ]]; then
    log "Using provided CloudFront distribution ID $DISTRIBUTION_ID"
    return
  fi
  log "Reading distribution ID from CloudFormation stack $STACK_NAME"
  DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text)
  if [[ -z "$DISTRIBUTION_ID" || "$DISTRIBUTION_ID" == "None" ]]; then
    echo "error: unable to determine distribution ID" >&2
    exit 1
  fi
  log "Discovered distribution $DISTRIBUTION_ID"
}

function update_distribution() {
  resolve_distribution
  log "Fetching distribution config"
  aws cloudfront get-distribution-config \
    --id "$DISTRIBUTION_ID" \
    --region "$CLOUDFRONT_REGION" \
    > cf.json
  local etag
  etag=$(jq -r '.ETag' cf.json)
  jq '.DistributionConfig' cf.json > cf-config.json

  local alt_array
  alt_array=$(jq -Rn --arg domain "$CUSTOM_DOMAIN" --arg alt "$ALT_NAMES" '
    ($alt | split(" ") | map(select(length > 0))) as $alts | [$domain] + $alts')

  jq \
    --argjson aliases "$alt_array" \
    --arg cert "$CERTIFICATE_ARN" \
    '.Aliases = { Quantity: ($aliases | length), Items: $aliases } |
     .ViewerCertificate = { ACMCertificateArn: $cert, SSLSupportMethod: "sni-only", MinimumProtocolVersion: "TLSv1.2_2021" }' \
    cf-config.json > cf-config-updated.json

  log "Updating distribution with aliases $alt_array"
  aws cloudfront update-distribution \
    --id "$DISTRIBUTION_ID" \
    --if-match "$etag" \
    --distribution-config file://cf-config-updated.json \
    --region "$CLOUDFRONT_REGION"
  log "Distribution update submitted"
}

function upsert_alias_records() {
  resolve_distribution
  log "Fetching distribution domain"
  local dist_domain
  dist_domain=$(aws cloudfront get-distribution \
    --id "$DISTRIBUTION_ID" \
    --query 'Distribution.DomainName' \
    --output text)

  cat > change-batch.json <<JSON
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "$CUSTOM_DOMAIN",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "$dist_domain",
          "EvaluateTargetHealth": false
        }
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "$CUSTOM_DOMAIN",
        "Type": "AAAA",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "$dist_domain",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
JSON
  log "Upserting alias A/AAAA records in hosted zone $HOSTED_ZONE_ID"
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch file://change-batch.json
}

ensure_certificate
ensure_hosted_zone
update_distribution
upsert_alias_records

log "Done. Validate DNS propagation and certificate status before switching traffic."
