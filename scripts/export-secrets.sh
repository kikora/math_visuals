#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/export-secrets.sh --secret <secret-id> [--secret <secret-id> ...] --ssm <parameter-name> [--ssm <parameter-name> ...]

Fetch AWS Secrets Manager secrets and SSM Parameter Store values and emit KEY=VALUE lines to stdout.
Use this to populate a .env file:

  ./scripts/export-secrets.sh --secret my/app/secret --ssm /my/app/parameter > .env

Arguments:
  --secret   Secrets Manager secret ID. Can be repeated.
  --ssm      SSM Parameter Store name (path). Can be repeated.
  -h, --help Show this help text.
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

normalize_key() {
  local name="$1"
  name="${name##*/}"          # take last path part
  name="${name^^}"            # uppercase
  name="${name//[^A-Z0-9]/_}" # replace non-alnum
  echo "$name"
}

print_kv() {
  local name="$1"
  local value="$2"
  local parsed

  if parsed=$(jq -e . <<<"$value" 2>/dev/null); then
    if jq -e 'type == "object"' <<<"$parsed" >/dev/null; then
      jq -r 'to_entries[] | "\(.key)=\(.value|tostring)"' <<<"$parsed"
      return
    fi
  fi

  local key
  key=$(normalize_key "$name")
  echo "$key=$value"
}

fetch_secret() {
  local secret_id="$1"
  local output
  if ! output=$(aws secretsmanager get-secret-value \
    --secret-id "$secret_id" \
    --query SecretString \
    --output text 2>&1); then
    echo "Failed to fetch secret '$secret_id': $output" >&2
    return 1
  fi
  print_kv "$secret_id" "$output"
}

fetch_parameter() {
  local param_name="$1"
  local output
  if ! output=$(aws ssm get-parameter \
    --name "$param_name" \
    --with-decryption \
    --query Parameter.Value \
    --output text 2>&1); then
    echo "Failed to fetch parameter '$param_name': $output" >&2
    return 1
  fi
  print_kv "$param_name" "$output"
}

main() {
  require_cmd aws
  require_cmd jq

  local secrets=()
  local params=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --secret)
        [[ $# -lt 2 ]] && { echo "--secret requires an argument" >&2; exit 1; }
        secrets+=("$2")
        shift 2
        ;;
      --ssm)
        [[ $# -lt 2 ]] && { echo "--ssm requires an argument" >&2; exit 1; }
        params+=("$2")
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        usage
        exit 1
        ;;
    esac
  done

  if [[ ${#secrets[@]} -eq 0 && ${#params[@]} -eq 0 ]]; then
    echo "Provide at least one --secret or --ssm value" >&2
    usage
    exit 1
  fi

  for secret in "${secrets[@]}"; do
    fetch_secret "$secret" || true
  done

  for param in "${params[@]}"; do
    fetch_parameter "$param" || true
  done
}

main "$@"
