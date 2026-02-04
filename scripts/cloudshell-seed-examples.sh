#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Bruk: DATA_STACK=<stack-navn> API_URL="https://<domene>/api/examples" \
  bash scripts/cloudshell-seed-examples.sh [--dataset=fil] [--dry-run]

Flagg:
  --region=REGION          AWS-regionen som inneholder data-stacken (standard: verdien i
                           $REGION/$AWS_REGION/$AWS_DEFAULT_REGION/$DEFAULT_REGION eller eu-west-1)
  --stack=STACK            Navnet på CloudFormation-stacken for data (standard: verdien i $DATA_STACK eller math-visuals-data)
  --url=URL                URL-en til /api/examples som skal testes (kan også settes via API_URL)
  --dataset=FIL            JSON-fil som skal brukes når datasettene seedes (standard: docs/examples-seed.json)
  --dry-run                Validerer og loggfører operasjonene uten å skrive til Redis
  -h, --help               Vis denne hjelpeteksten

Eksempel:
  DATA_STACK=math-visuals-data \
    API_URL="https://example.org/api/examples" \
    bash scripts/cloudshell-seed-examples.sh --dataset=docs/examples-seed.json
USAGE
}

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
DATASET="$REPO_ROOT/docs/examples-seed.json"
CHECK_ARGS=()
SEED_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dataset=*)
      DATASET_PATH="${1#*=}"
      if [[ -n "$DATASET_PATH" ]]; then
        DATASET="$DATASET_PATH"
      fi
      ;;
    --dry-run)
      SEED_ARGS+=("--dry-run")
      ;;
    --region=*|--stack=*|--url=*)
      CHECK_ARGS+=("$1")
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

if [[ ! -f "$DATASET" ]]; then
  echo "Fant ikke datasettfilen: $DATASET" >&2
  exit 1
fi

# shellcheck source=cloudshell-check-examples.sh
source "$SCRIPT_DIR/cloudshell-check-examples.sh"

pushd "$REPO_ROOT" >/dev/null

cloudshell_check_examples "${CHECK_ARGS[@]}"

echo "Seed-er datasettet $DATASET ..."
npm run seed-examples -- --dataset="$DATASET" "${SEED_ARGS[@]}"

popd >/dev/null
