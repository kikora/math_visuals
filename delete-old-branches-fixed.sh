#!/usr/bin/env bash
set -euo pipefail

REMOTE="origin"
MAIN_BRANCH="main"
DAYS=2

THRESHOLD=$(( $(date +%s) - DAYS*24*60*60 ))

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Feil: Dette må kjøres i roten av et git-repo."
  exit 1
fi

echo "Henter oppdaterte refs..."
git fetch --prune

echo "Lister remote-brancher på ${REMOTE} eldre enn ${DAYS} dager (UNNTATT ${MAIN_BRANCH})..."
# Output: name\0epoch\0 name\0epoch\0 ...
git for-each-ref --format='%(refname:strip=3)%00%(committerdate:unix)%00' "refs/remotes/${REMOTE}" \
| while true; do
    # les name (null-terminert)
    if ! IFS= read -r -d '' name; then
      break
    fi
    # les epoch (null-terminert)
    if ! IFS= read -r -d '' epoch; then
      epoch=""
    fi

    # hopp over HEAD og main
    if [ "$name" = "HEAD" ] || [ "$name" = "$MAIN_BRANCH" ]; then
      continue
    fi

    # hvis epoch tomt, sett til 0 for å synliggjøre
    epoch=${epoch:-0}

    if [ "$epoch" -lt "$THRESHOLD" ]; then
      # prøv å vise lesbar dato (macOS og Linux håndteres)
      if date -r "$epoch" +"%Y-%m-%d %H:%M:%S" >/dev/null 2>&1; then
        dt=$(date -r "$epoch" +"%Y-%m-%d %H:%M:%S")
      else
        dt=$(date -d "@$epoch" +"%Y-%m-%d %H:%M:%S" 2>/dev/null || printf '?')
      fi
      printf '%s\t%s\n' "$name" "$dt"
    fi
done > /tmp/old-branches-to-delete.txt

if [ ! -s /tmp/old-branches-to-delete.txt ]; then
  echo "Ingen remote-brancher eldre enn ${DAYS} dager (utenom ${MAIN_BRANCH})."
  rm -f /tmp/old-branches-to-delete.txt
  exit 0
fi

echo
echo "Følgende remote-brancher er eldre enn ${DAYS} dager:"
cat /tmp/old-branches-to-delete.txt
echo
read -rp "Skriv 'yes' for å slette disse remote-branchene fra ${REMOTE}: " confirm
if [ "$confirm" != "yes" ]; then
  echo "Avbrutt. Ingen brancher ble slettet."
  rm -f /tmp/old-branches-to-delete.txt
  exit 0
fi

while IFS=$'\t' read -r branch _date; do
  if [ -z "$branch" ]; then
    continue
  fi
  echo "Sletter: $branch"
  if git push "$REMOTE" --delete "$branch"; then
    echo "  -> Slettet $branch"
  else
    echo "  -> FEIL ved sletting av $branch (fortsetter)"
  fi
done < /tmp/old-branches-to-delete.txt

rm -f /tmp/old-branches-to-delete.txt
echo "Ferdig."
