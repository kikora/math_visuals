#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REGION="${DEFAULT_REGION:-eu-west-1}"
DEFAULT_STACK="${DEFAULT_API_STACK:-math-visuals-api}"
TRACE=${TRACE:-false}

usage() {
  cat <<'USAGE'
Bruk: bash scripts/cloudshell-redeploy-api.sh [flagg]

Tvinger en CloudFormation update-stack med forrige template og eksisterende
parameterverdier for API-stacken, slik at Lambda henter ny Secret/SSM-konfig
uten at du trenger å vite parameterverdiene.

Flagg:
  --region=REGION    AWS-region (standard: verdien i $REGION/$AWS_REGION/$AWS_DEFAULT_REGION/DEFAULT_REGION)
  --stack=STACK      Navn på API-stacken (standard: verdien i $API_STACK/$DEFAULT_API_STACK eller math-visuals-api)
  --trace            Slå på shell tracing (set -x)
  -h, --help         Vis denne hjelpen

Skriptet henter alle ParameterKey-er fra den eksisterende stacken og sender
ParameterKey=<key>,UsePreviousValue=true til update-stack, sammen med
--use-previous-template og CAPABILITY_NAMED_IAM. Feilen "No updates are to be
performed" tolkes som suksess (stacken er allerede oppdatert).
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

REGION=${REGION:-${AWS_REGION:-${AWS_DEFAULT_REGION:-$DEFAULT_REGION}}}
STACK_NAME=${API_STACK:-$DEFAULT_STACK}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region=*)
      REGION="${1#*=}"
      ;;
    --stack=*)
      STACK_NAME="${1#*=}"
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
    echo "Mangler kommandoen '$1' i PATH" >&2
    exit 1
  fi
}

require_cmd aws
require_cmd jq

stack_parameters_json=$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Parameters' \
  --output json)

if [[ -z "$stack_parameters_json" || "$stack_parameters_json" == "null" ]]; then
  echo "Fant ingen parametere for stacken $STACK_NAME i region $REGION" >&2
  exit 1
fi

mapfile -t PARAM_KEYS < <(jq -r '.[].ParameterKey' <<<"$stack_parameters_json")

if [[ ${#PARAM_KEYS[@]} -eq 0 ]]; then
  echo "Stacken $STACK_NAME har ingen ParameterKey-er å gjenbruke." >&2
  exit 1
fi

PARAM_ARGS=()
for key in "${PARAM_KEYS[@]}"; do
  PARAM_ARGS+=("ParameterKey=${key},UsePreviousValue=true")
done

echo "Trigger update-stack på ${STACK_NAME} i ${REGION} med eksisterende parametere ..."
set +e
UPDATE_OUTPUT=$(aws cloudformation update-stack \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --use-previous-template \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters "${PARAM_ARGS[@]}" 2>&1)
UPDATE_STATUS=$?
set -e

if [[ "$UPDATE_STATUS" -ne 0 ]]; then
  if grep -qi "No updates are to be performed" <<<"$UPDATE_OUTPUT"; then
    echo "Ingen endringer å rulle ut (stacken er allerede oppdatert)."
    exit 0
  fi
  echo "$UPDATE_OUTPUT" >&2
  exit "$UPDATE_STATUS"
fi

echo "Oppdatering startet. Venter på stack-update-complete ..."
aws cloudformation wait stack-update-complete \
  --region "$REGION" \
  --stack-name "$STACK_NAME"

echo "Stack-oppdatering fullført. Siste parameterliste:"
jq -r '.Parameters[] | "- " + .ParameterKey + ": " + (.ParameterValue // "<UsePreviousValue>")' <<<"$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0]' \
  --output json)"
