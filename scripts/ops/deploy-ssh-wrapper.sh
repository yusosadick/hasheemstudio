#!/usr/bin/env bash
# Forced-command wrapper for the least-privilege hasheemstudio deploy SSH key. Installed as the
# `command=` restriction on that key's authorized_keys entry (see docs/DEPLOYMENT.md), this script
# runs INSTEAD OF whatever the client asked for ($SSH_ORIGINAL_COMMAND) — it allowlists an exact
# set of safe operations against `local`/`staging` only and refuses everything else (including any
# `production` migration command — that stays a deliberately separate, manual, human-approved
# action, never reachable through this automated key), so a leaked/misused deploy key cannot get
# an interactive shell or run arbitrary commands on this shared VPS.
set -euo pipefail

# Forced-command SSH sessions don't source .bashrc/.profile, so node/pnpm (installed under
# ~/.local/bin, not a default system path) aren't on PATH unless set explicitly here.
export PATH="/home/yuso/.local/bin:$PATH"

cd /home/yuso/hasheemstudio

cmd="${SSH_ORIGINAL_COMMAND:-}"

run_if_valid_sha() {
  local prefix="$1"
  local sha="${cmd#"$prefix"}"
  if [[ "$sha" =~ ^[0-9a-f]{7,40}$ ]]; then
    exec node scripts/db/remote.mjs $2 --env "$3" --sha "$sha"
  fi
}

case "$cmd" in
  "git fetch"|"git pull")
    exec $cmd
    ;;
  "node scripts/db/remote.mjs status --env local")
    exec node scripts/db/remote.mjs status --env local
    ;;
  "node scripts/db/remote.mjs status --env staging")
    exec node scripts/db/remote.mjs status --env staging
    ;;
  "node scripts/db/remote.mjs plan --env local --sha "*)
    run_if_valid_sha "node scripts/db/remote.mjs plan --env local --sha " plan local
    ;;
  "node scripts/db/remote.mjs apply --env local --sha "*)
    run_if_valid_sha "node scripts/db/remote.mjs apply --env local --sha " apply local
    ;;
  "node scripts/db/remote.mjs verify --env local --sha "*)
    run_if_valid_sha "node scripts/db/remote.mjs verify --env local --sha " verify local
    ;;
  "node scripts/db/remote.mjs plan --env staging --sha "*)
    run_if_valid_sha "node scripts/db/remote.mjs plan --env staging --sha " plan staging
    ;;
  "node scripts/db/remote.mjs apply --env staging --sha "*)
    run_if_valid_sha "node scripts/db/remote.mjs apply --env staging --sha " apply staging
    ;;
  "node scripts/db/remote.mjs verify --env staging --sha "*)
    run_if_valid_sha "node scripts/db/remote.mjs verify --env staging --sha " verify staging
    ;;
  "pnpm ops:retention-sweep")
    exec pnpm ops:retention-sweep
    ;;
esac

echo "Refused: this deploy key is restricted to a fixed allowlist of commands (see scripts/ops/deploy-ssh-wrapper.sh)." >&2
echo "Requested: ${cmd}" >&2
exit 1
