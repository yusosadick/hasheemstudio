#!/usr/bin/env bash
# Turns Studio checkout ON after the Snippe credentials are in the protected env file, restarts only the API
# container and confirms the public catalogue reports checkout as available. Never prints secret values.
#
# Before running (in YOUR terminal; this repo's rules forbid copying another project's credentials, so the values
# come from the vault item you approve for Studio):
#   bw unlock                                   # exports BW_SESSION in your shell
#   ./scripts/ops/fetch-vaultwarden-secret.sh "<vault item: Snippe API key>"        SNIPPE_API_KEY        /etc/hasheemstudio/local.env
#   ./scripts/ops/fetch-vaultwarden-secret.sh "<vault item: Snippe webhook secret>" SNIPPE_WEBHOOK_SECRET /etc/hasheemstudio/local.env
# Then:  ./scripts/ops/enable-checkout.sh
set -euo pipefail
ENV_FILE="${1:-/etc/hasheemstudio/local.env}"
[ -f "$ENV_FILE" ] || { echo "Env file $ENV_FILE not found." >&2; exit 1; }
get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2-; }

KEY="$(get SNIPPE_API_KEY)"; SECRET="$(get SNIPPE_WEBHOOK_SECRET)"
case "$KEY" in snp_*) ;; *) echo "SNIPPE_API_KEY is missing or does not start with snp_ in $ENV_FILE. Nothing changed." >&2; exit 1;; esac
[ -n "$SECRET" ] || { echo "SNIPPE_WEBHOOK_SECRET is missing in $ENV_FILE. Nothing changed." >&2; exit 1; }
unset KEY SECRET

set_var() { # replace or append KEY=VALUE without echoing other values
  if grep -q "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"; fi
}
set_var STUDIO_PAYMENT_METHODS mobile
set_var STUDIO_PAYMENT_APPROVED true
set_var STUDIO_CHECKOUT_ENABLED true
chmod 600 "$ENV_FILE"

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
docker compose --env-file "$ENV_FILE" -f "$REPO/infra/compose/docker-compose.yml" -p hasheemstudio up -d --no-deps --force-recreate api
for i in $(seq 1 30); do
  if curl -fsS https://api.hasheemstudio.com/v1/payments/plans 2>/dev/null | grep -q '"available":true'; then
    echo "Checkout is LIVE: https://api.hasheemstudio.com/v1/payments/plans reports available=true."
    echo "Next: register https://api.hasheemstudio.com/webhooks/snippe in Snippe (if not already) and make one small real test payment."
    exit 0
  fi
  sleep 2
done
echo "API restarted but checkout still reports unavailable — check the api container logs." >&2; exit 1
