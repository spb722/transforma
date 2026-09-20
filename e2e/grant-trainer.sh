#!/usr/bin/env bash
# Give an account the trainer role. TRAINER_UIDS is read only at API boot, so this edits .env
# and restarts the api container. Pass an account name or uid.
#
#   ./e2e/grant-trainer.sh "My Name"
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -eq 1 ] || { echo "usage: $0 <account-name-or-uid>"; exit 1; }

UID_FOUND=$(node -e '
const d=require("./data/db.json");const q=process.argv[1];
const u=d.users.find(x=>x.id===q)||d.users.find(x=>x.name===q)||d.users.filter(x=>x.name.toLowerCase().includes(q.toLowerCase()))[0];
if(!u){console.error("no account matching: "+q);process.exit(1)}
process.stdout.write(u.id+"\t"+u.name);
' "$1")
NEW_UID=${UID_FOUND%%$'\t'*}
NEW_NAME=${UID_FOUND##*$'\t'}

CURRENT=$(grep -E '^TRAINER_UIDS=' .env | cut -d= -f2- || true)
case ",$CURRENT," in
  *",$NEW_UID,"*) echo "$NEW_NAME ($NEW_UID) is already a trainer — nothing to do."; exit 0 ;;
esac
UPDATED=$([ -n "$CURRENT" ] && echo "$CURRENT,$NEW_UID" || echo "$NEW_UID")
if grep -qE '^TRAINER_UIDS=' .env; then
  sed -i '' "s|^TRAINER_UIDS=.*|TRAINER_UIDS=$UPDATED|" .env
else
  printf '\nTRAINER_UIDS=%s\n' "$UPDATED" >> .env
fi
echo "granted trainer to $NEW_NAME ($NEW_UID)"
echo "TRAINER_UIDS=$UPDATED"
docker compose up -d api >/dev/null 2>&1
sleep 3
echo "api restarted — sign out and back in for the new capability to appear."
