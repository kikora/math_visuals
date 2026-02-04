#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: cloudshell-check-cognito-domain.sh --domain=<cognito-domain>

Checks whether the current AWS identity can call cognito-idp:DescribeUserPoolDomain
for the given domain. Intended for quick CloudShell triage when deployments fail
with AccessDenied errors around DescribeUserPoolDomain.

Options:
  --domain   Cognito user pool domain prefix or full domain name (required)
USAGE
}

DOMAIN=""
for arg in "$@"; do
  case "$arg" in
    --domain=*)
      DOMAIN="${arg#*=}"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Ukjent argument: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac

done

if [[ -z "$DOMAIN" ]]; then
  echo "--domain må settes" >&2
  usage >&2
  exit 1
fi

CALLER=$(aws sts get-caller-identity --query 'Arn' --output text)
echo "Bruker AWS-identitet: $CALLER" >&2

echo "Prøver describe-user-pool-domain for '$DOMAIN'..." >&2
aws cognito-idp describe-user-pool-domain --domain "$DOMAIN" --output json

echo "✔️ describe-user-pool-domain lyktes. Rollen har nødvendig tilgang." >&2
