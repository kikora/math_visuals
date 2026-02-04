#!/usr/bin/env bash
set -euo pipefail

# Konfigurer her hvis nødvendig:
REMOTE="origin"
MAIN_BRANCH="main"
DAYS=2

# Beregn terskel (epoch seconds)
THRESHOLD=$(( $(date +%s) - DAYS*24*60*60 ))

# Sikkerhet: sørg for at vi er i et git-repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Feil: Dette må kjøres i roten av et git-repo."
  exit 1
fi

echo "Henter oppdaterte refs..."
git fetch --prune

echo "Lister remote-brancher på ${REMOTE} eldre enn ${DAYS} dager (UNNTATT ${MAIN_BRANCH})..."
# Output: NUL-separerte records: <branch_name>\0<epoch>\0
# (strip=3 fjerner refs/remotes/origin/ og etterlater branch-navnet)
git for-each-ref --format='%(refname:strip=3)%00%(committerdate:unix)%00' "refs/remotes/${REMOTE}" \
  | while IFS= read -r -d '' entry; do
      # Del opp entry (name\0epoch\0)
      name=${entry%%$'\0'*}
      rest=${entry#*$'\0'}
      epoch=${rest%%$'\0'*}

      # Hopp over HEAD og hovedbranch
      if [ "$name" = "HEAD" ] || [ "$name" = "$MAIN_BRANCH" ]; then
        continue
      fi

      # Hvis eldre enn terskel, vis som kandidat
      if [ "${epoch:-0}" -lt "$THRESHOLD" ]; then
        # Vis dato også for informasjon (lesbar)
        dt=$(date -r "$epoch" +"%Y-%m-%d %H:%M:%S" 2>/dev/null || date -d "@$epoch" +"%Y-%m-%d %H:%M:%S" 2>/dev/null || printf '?')
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

# Utfør slettingen (én og én)
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
