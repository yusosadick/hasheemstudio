#!/usr/bin/env bash
# One command, run in the SAME terminal where you unlocked Bitwarden (so BW_SESSION is set there):
#
#   ./scripts/ops/install-snippe-credentials.sh "<vault item: Snippe API key>" "<vault item: Snippe webhook secret>"
#
# It reads the two items with the official `bw` CLI straight into /etc/hasheemstudio/local.env (mode 0600; values are
# never printed, logged or passed as arguments), then runs enable-checkout.sh, which turns checkout on, recreates
# only the api container and confirms the public catalogue reports available=true.
# The item names are yours to choose (`bw list items --search snippe | jq -r '.[].name'` prints names only).
set -euo pipefail
API_ITEM="${1:?vault item name for the Snippe API key}"
HOOK_ITEM="${2:?vault item name for the Snippe webhook secret}"
ENV_FILE="${3:-/etc/hasheemstudio/local.env}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ -z "${BW_SESSION:-}" ]; then
  echo "BW_SESSION is not set in this terminal. Run:  export BW_SESSION=\$(bw unlock --raw)   then re-run this script." >&2
  exit 1
fi

"$HERE/fetch-vaultwarden-secret.sh" "$API_ITEM"  SNIPPE_API_KEY        "$ENV_FILE"
"$HERE/fetch-vaultwarden-secret.sh" "$HOOK_ITEM" SNIPPE_WEBHOOK_SECRET "$ENV_FILE"
"$HERE/enable-checkout.sh" "$ENV_FILE"
