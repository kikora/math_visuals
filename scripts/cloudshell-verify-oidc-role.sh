#!/usr/bin/env bash
set -euo pipefail

# Simple CloudShell helper to verify the GitHub OIDC role trust policy and attached policies.
# Requirements: AWS CLI + jq installed and authenticated (e.g., via `aws sso login`).

usage() {
  cat <<'USAGE'
Bruk: bash scripts/cloudshell-verify-oidc-role.sh

Forventede miljøvariabler (må settes før kjøring):
  export AWS_IAC_ROLE_ARN="arn:aws:iam::<ACCOUNT_ID>:role/MathVisualsGithubDeploy"
  export GH_ORG="kikora"
  export GH_REPO="math_visuals"
  # valgfritt: export GH_BRANCH_PATTERN="refs/heads/main" (standard er main)

Skriptet sjekker:
  - At trust policy bruker GitHub OIDC-provider (token.actions.githubusercontent.com)
  - At sub matcher repo:<org>/<repo>:ref:<branch-mønster>
  - At aud er sts.amazonaws.com
  - Lister tilknyttede og inline IAM-policyer for rollen

Avslutter med exit-kode 0 hvis trust policy matcher, ellers 1.
USAGE
}

for cmd in aws jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Kommandoen '$cmd' er ikke tilgjengelig i PATH. Installer den før du fortsetter." >&2
    exit 1
  fi
done

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

missing=0
for var in AWS_IAC_ROLE_ARN GH_ORG GH_REPO; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing env: $var (export it before running)." >&2
    missing=1
  fi
done

if [[ "$missing" -eq 1 ]]; then
  echo "Se --help for eksempel på exports." >&2
  exit 1
fi

BRANCH_PATTERN="${GH_BRANCH_PATTERN:-refs/heads/main}"
ROLE_NAME="${AWS_IAC_ROLE_ARN##*/}"
EXPECTED_SUB="repo:${GH_ORG}/${GH_REPO}:ref:${BRANCH_PATTERN}"
EXPECTED_AUD="sts.amazonaws.com"
OIDC_PROVIDER_SUFFIX="token.actions.githubusercontent.com"

ROLE_JSON="$(mktemp)"
trap 'rm -f "$ROLE_JSON"' EXIT

echo "Checking IAM role: ${ROLE_NAME}"
echo "Expected sub: ${EXPECTED_SUB}"
echo "Expected aud: ${EXPECTED_AUD}"
echo "Fetching role definition…"
aws iam get-role --role-name "${ROLE_NAME}" --output json >"${ROLE_JSON}"

jq '.Role | {Arn, AssumeRolePolicyDocument}' "${ROLE_JSON}"

echo "Evaluating trust policy…"
TRUST_OK=1
PROVIDER_MATCH=$(jq -r --arg suf "${OIDC_PROVIDER_SUFFIX}" '
  .Role.AssumeRolePolicyDocument.Statement[]
  | select(.Principal.Federated != null)
  | (.Principal.Federated | tostring | contains($suf))' "${ROLE_JSON}" | head -n1)

SUB_MATCH=$(jq -r --arg sub "${EXPECTED_SUB}" '
  .Role.AssumeRolePolicyDocument.Statement[]
  | select(.Condition.StringLike."token.actions.githubusercontent.com:sub"? != null)
  | (.Condition.StringLike."token.actions.githubusercontent.com:sub" == $sub)' "${ROLE_JSON}" | head -n1)

AUD_MATCH=$(jq -r --arg aud "${EXPECTED_AUD}" '
  .Role.AssumeRolePolicyDocument.Statement[]
  | select(.Condition.StringEquals."token.actions.githubusercontent.com:aud"? != null)
  | (.Condition.StringEquals."token.actions.githubusercontent.com:aud" == $aud)' "${ROLE_JSON}" | head -n1)

if [[ "${PROVIDER_MATCH}" != "true" ]]; then
  echo "❌ Federated principal is not ${OIDC_PROVIDER_SUFFIX}"
  TRUST_OK=0
else
  echo "✅ Federated principal matches ${OIDC_PROVIDER_SUFFIX}"
fi

if [[ "${SUB_MATCH}" != "true" ]]; then
  echo "❌ sub condition does not match ${EXPECTED_SUB}"
  TRUST_OK=0
else
  echo "✅ sub condition matches ${EXPECTED_SUB}"
fi

if [[ "${AUD_MATCH}" != "true" ]]; then
  echo "❌ aud condition does not match ${EXPECTED_AUD}"
  TRUST_OK=0
else
  echo "✅ aud condition matches ${EXPECTED_AUD}"
fi

if [[ "${TRUST_OK}" -eq 1 ]]; then
  echo "Trust policy matches expected GitHub OIDC settings."
else
  echo "Trust policy mismatch detected. Use docs/github-actions-setup.md template to update."
fi

echo
echo "Attached AWS managed policies:"
aws iam list-attached-role-policies --role-name "${ROLE_NAME}" --output table

echo
echo "Inline role policies (names only):"
aws iam list-role-policies --role-name "${ROLE_NAME}" --output table

echo
echo "Tip: required permissions include CloudFormation, S3, Secrets Manager, SSM, CloudFront, IAM, MemoryDB/VPC as documented."

if [[ "${TRUST_OK}" -ne 1 ]]; then
  exit 1
fi
