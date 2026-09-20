# Google Sign-In — Hasheem Studio

[IMPLEMENTED] The production frontend already uses Supabase PKCE, single-use exchange
coordination, verified-user checks and allowlisted application return paths. Google is exposed
only when the real Supabase `/auth/v1/settings` reports `external.google=true`.

| Configuration | Exact production value |
| --- | --- |
| GoTrue external auth base | https://supabase.hasheemstudio.com/auth/v1 |
| Google provider callback | https://supabase.hasheemstudio.com/auth/v1/callback |
| Frontend callback | https://hasheemstudio.com/auth/callback |
| Site URL | https://hasheemstudio.com |

[VERIFIED-LIVE] These routes/configuration were inspected on the dedicated Hasheem Studio
stack. DNS resolves and public HTTPS settings return 200. [BLOCKED] Google is still disabled;
credentials were not provisioned because the retrieved item failed the exact-name/organization
guard. No real Google consent, exchange or session is claimed. See [STATUS](STATUS.md).

## Secure provisioning

Only owner-authorized organization item `hasheemstudio-google-oauth` may be retrieved. Expected
fields: Google Client ID and Client Secret. Do not inspect unrelated items, print vault output,
source the handoff as shell code, or put values into command arguments, logs, Git or Vite.

The helper uses the installed Bitwarden **2026.8.0** at
`~/.local/share/bitwarden-cli-2026.8/node_modules/.bin/bw`. The system binary is a different
version and must not be substituted for this handoff. Provide a new protected 0600
`~/.hasheemstudio_bw_session` only after resolving the recorded metadata blocker, then run:

```sh
python3 scripts/ops/provision-google-oauth.py
```

It retrieves that exact item, requires organization assignment, extracts unambiguous Google
credential shapes, updates only `GOOGLE_ENABLED`, `GOOGLE_CLIENT_ID` and `GOOGLE_SECRET` in
`/etc/hasheemstudio/local.env` atomically, then locks Vaultwarden, clears the session and deletes
the handoff even on failure. It prints only fixed metadata/reason codes, key names and permissions.
File mode is 0600 and the directory is 0700. Never expose a rendered Compose configuration.

[IMPLEMENTED] `infra/compose/docker-compose.yml` maps the three protected variables to
`GOTRUE_EXTERNAL_GOOGLE_ENABLED`, `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID`, and
`GOTRUE_EXTERNAL_GOOGLE_SECRET`; redirect URI derives from the inspected auth base plus
`/callback`, resolving exactly to the provider callback above. Fresh stacks default disabled.
No provider credential belongs in `VITE_*` or the frontend bundle.

After successful provisioning and protected Compose validation, recreate **only Auth**:

```sh
docker compose --env-file /etc/hasheemstudio/local.env \
  -f infra/compose/docker-compose.yml -p hasheemstudio \
  up -d --no-deps --force-recreate --wait auth
```

The API/frontend dynamically use Supabase; this change does not require restarting them.
Do not execute that deployment command while provisioning is blocked. Preserve all unrelated
containers and shared routing. No Google Cloud redirect edits are part of this task.

## Tests and real acceptance

```sh
python3 tests/security/google_oauth_provisioning_test.py
pnpm typecheck
pnpm build
node tests/e2e/google-auth-browser.mjs
```

The browser probe uses fresh Chromium, checks real settings/button consistency and the callback
without a session. If Google is enabled it checks the exact frontend redirect, PKCE and provider
login page without recording query values. It deliberately cannot complete an owner's Google
consent. `BLOCKED_GOOGLE_NOT_ENABLED` or `BLOCKED_OWNER_CONSENT` is not a successful login result.
No screenshots, traces, raw provider responses or callback URLs with queries are retained.

Owner acceptance: open https://hasheemstudio.com/login in a fresh private session; complete
Google consent with the approved account; confirm return through the exact frontend callback,
a real authenticated session and intended video/upload destination; refresh; log out; verify
protected account/download requests are denied. Do not share callback URLs, codes or tokens.
Record each outcome independently. Existing paid-checkout and mail-delivery blockers are separate.
