# tests/security

`rls.cross-tenant.mjs` — real cross-tenant RLS negative test against a live environment (creates
two throwaway users via the GoTrue admin API, exercises PostgREST with their real tokens, cleans
up after itself). Run with:

```bash
node tests/security/rls.cross-tenant.mjs --env local
```

Covers, as of `docs/STATUS.md` Phase 3: registration-trigger correctness (exactly one personal
workspace per user), cross-tenant read denial on `workspaces` and `profiles`, privilege-escalation
denial on `workspace_members`, and self-promotion denial on `platform_admins`. Does not yet cover:
job/media/usage tables (they don't exist yet — Phase 4/5), admin-role negative tests beyond
self-promotion, or a broader automated suite (this is one focused script, not yet wired into CI).
