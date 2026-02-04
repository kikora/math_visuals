#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
echo "[cloudshell-verify] starter wrapperen (scripts/cloudshell-verify.sh)..."

if bash "$SCRIPT_DIR/scripts/cloudshell-verify.sh" "$@"; then
  status=0
else
  status=$?
fi

if [[ "$status" -eq 0 ]]; then
  echo "[cloudshell-verify] fullført med exit 0."
else
  echo "[cloudshell-verify] stoppet med exit $status." >&2
fi

exit "$status"
