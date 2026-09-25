#!/usr/bin/env bash
# Fetches a single named item's password/notes field from the user's own self-hosted Vaultwarden
# via the official Bitwarden CLI (`bw`), and writes it straight into a target env file — never to
# stdout, never into chat/logs. Requires BW_SESSION to already be set (via `bw unlock`, run by the
# owner in their own terminal — this script never prompts for or handles the master password).
#
# Usage:
#   BW_SESSION="..." ./scripts/ops/fetch-vaultwarden-secret.sh "hasheemstudio-resend-api" RESEND_API_KEY /etc/hasheemstudio/local.env
#   BW_SESSION="..." ./scripts/ops/fetch-vaultwarden-secret.sh "hasheem studio DNS" CLOUDFLARE_API_TOKEN /etc/hasheemstudio/local.env
set -euo pipefail

# Compatible CLI only — the newer bw (e.g. a snap/global install) fails against this
# VPS's self-hosted Vaultwarden server with a KeyIdBackfillError.
BW="/home/yuso/.local/share/bitwarden-cli-2026.8/node_modules/.bin/bw"

ITEM_NAME="${1:?item name required}"
ENV_VAR_NAME="${2:?target env var name required}"
TARGET_FILE="${3:?target env file path required}"

if [ -z "${BW_SESSION:-}" ]; then
  echo "BW_SESSION is not set. Run 'bw unlock' yourself in your own terminal (not through this" >&2
  echo "session) and export the session key it prints, then re-run this script with it set." >&2
  exit 1
fi

if [ ! -f "$TARGET_FILE" ]; then
  echo "Target file $TARGET_FILE does not exist yet — generate it first." >&2
  exit 1
fi

VALUE="$($BW get password "$ITEM_NAME" 2>/dev/null || $BW get notes "$ITEM_NAME" 2>/dev/null || true)"

if [ -z "$VALUE" ]; then
  echo "Could not read a password or notes field from Vaultwarden item '$ITEM_NAME'." >&2
  echo "Check the exact item name in the vault (case/spacing matters to 'bw get')." >&2
  exit 1
fi

# Replace or append the variable in the target file, in place, without ever echoing VALUE.
if grep -q "^${ENV_VAR_NAME}=" "$TARGET_FILE"; then
  TMP="$(mktemp)"
  awk -v key="$ENV_VAR_NAME" -v val="$VALUE" -F'=' 'BEGIN{OFS="="} $1==key{$0=key"="val} {print}' "$TARGET_FILE" > "$TMP"
  mv "$TMP" "$TARGET_FILE"
else
  printf '%s=%s\n' "$ENV_VAR_NAME" "$VALUE" >> "$TARGET_FILE"
fi
chmod 600 "$TARGET_FILE"

echo "Updated $ENV_VAR_NAME in $TARGET_FILE from Vaultwarden item '$ITEM_NAME' (value not printed)."
unset VALUE
