#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
echo "[cloudshell-eni-check] starter wrapperen (scripts/cloudshell-eni-check.sh)..."

if bash "$SCRIPT_DIR/scripts/cloudshell-eni-check.sh" "$@"; then
  status=0
else
  status=$?
fi

if [[ "$status" -eq 0 ]]; then
  echo "[cloudshell-eni-check] fullført med exit 0."
else
  echo "[cloudshell-eni-check] stoppet med exit $status." >&2
fi

exit "$status"
