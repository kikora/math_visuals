#!/usr/bin/env bash

set -uo pipefail

DEFAULT_API_URL="https://d1vglpvtww9b2w.cloudfront.net/api/examples"
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

EXIT_INVALID_ARGS=2
EXIT_DNS_ERROR=10
EXIT_TLS_ERROR=11
EXIT_HTTP_ERROR=20
EXIT_HTTP_403=21
EXIT_HTTP_404=22
EXIT_HTTP_5XX=23
EXIT_NPM_FAILURE=30

tmp_body=""
tmp_curl_err=""

cleanup() {
  [[ -n "$tmp_body" && -f "$tmp_body" ]] && rm -f "$tmp_body"
  [[ -n "$tmp_curl_err" && -f "$tmp_curl_err" ]] && rm -f "$tmp_curl_err"
}
trap cleanup EXIT

print_usage() {
  cat <<'USAGE'
Bruk: cloudshell-prod-backend-check.sh [--url <URL>]

Alternativer:
  --url, -u   Overstyr API-endepunktet som skal sjekkes (standard prod-URL)
  --help, -h  Vis denne hjelpen

Eksempel:
  ./scripts/cloudshell-prod-backend-check.sh \
    --url https://d1vglpvtww9b2w.cloudfront.net/api/examples
USAGE
}

fail() {
  local message="$1"
  local code="${2:-1}"
  echo "❌ ${message}" >&2
  exit "$code"
}

API_URL="${API_URL:-$DEFAULT_API_URL}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url|-u)
      shift
      if [[ $# -eq 0 ]]; then
        fail "--url/-u krever en verdi." "$EXIT_INVALID_ARGS"
      fi
      API_URL="$1"
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    *)
      echo "Ukjent flagg: $1" >&2
      print_usage >&2
      exit "$EXIT_INVALID_ARGS"
      ;;
  esac
  shift
done

if [[ -z "$API_URL" ]]; then
  fail "API_URL kan ikke være tom." "$EXIT_INVALID_ARGS"
fi

API_URL="${API_URL%/}"

cd "$REPO_ROOT"

if [[ ! -d node_modules ]]; then
  echo "Installerer npm-avhengigheter (første gangs kjøring i CloudShell)..."
  npm install --ignore-scripts
fi

echo "Kjører helsesjekk mot ${API_URL} ..."

tmp_body=$(mktemp)
tmp_curl_err=$(mktemp)

http_status=$(curl -sS -w '%{http_code}' -o "$tmp_body" "$API_URL" 2>"$tmp_curl_err")
curl_exit=$?

if [[ $curl_exit -ne 0 ]]; then
  case "$curl_exit" in
    6|7)
      fail "DNS- eller tilkoblingsfeil. Klarte ikke å slå opp domenet eller nå serveren." "$EXIT_DNS_ERROR"
      ;;
    35|51|52|53|54|56|58|60|80|82|90|91)
      fail "TLS/SSL-feil under tilkobling. Sjekk sertifikatet og om CloudShell har internett-tilgang." "$EXIT_TLS_ERROR"
      ;;
    *)
      fail "Ukjent tilkoblingsfeil (curl exit-kode ${curl_exit})." "$EXIT_HTTP_ERROR"
      ;;
  esac
fi

if [[ -s "$tmp_curl_err" ]]; then
  echo "Detaljer:"
  cat "$tmp_curl_err" >&2
fi

if [[ "$http_status" -ge 400 ]]; then
  snippet=$(head -c 500 "$tmp_body" | tr -d '\0')
  case "$http_status" in
    403)
      echo "❌ Fikk status 403 (forbudt). Kontroller at API-et tillater offentlig tilgang fra CloudShell." >&2
      ;;
    404)
      echo "❌ Fikk status 404 (ikke funnet). Sjekk at URL-en peker til /api/examples i riktig miljø." >&2
      ;;
    5??)
      echo "❌ Fikk status ${http_status} (serverfeil). Backend-en returnerte en feilrespons." >&2
      ;;
    *)
      echo "❌ Fikk status ${http_status}." >&2
      ;;
  esac
  if [[ -n "$snippet" ]]; then
    echo "Svar: ${snippet}" >&2
  fi
  case "$http_status" in
    403) exit "$EXIT_HTTP_403" ;;
    404) exit "$EXIT_HTTP_404" ;;
    5??) exit "$EXIT_HTTP_5XX" ;;
    *) exit "$EXIT_HTTP_ERROR" ;;
  esac
fi

echo "✅ Endepunktet svarte med status ${http_status}. Kjører detaljert API-sjekk ..."

if ! npm run check-examples-api -- --url="$API_URL"; then
  fail "npm run check-examples-api feilet. Se loggen over for detaljer." "$EXIT_NPM_FAILURE"
fi

echo "✅ Prod-backend ser frisk ut."
