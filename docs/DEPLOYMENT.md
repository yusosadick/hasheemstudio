# Deployment and GitHub workflow

> Split from `docs/MASTER-PLAN-ORIGINAL.md` §21.

- Inspect existing repo before writing; empty remote gets an initial main branch, existing repo gets a scoped branch/PR. Never force-push.
- First commit: docs, CLAUDE/AGENTS, workspace scaffold, ignores, env examples and CI foundation. Scan for secrets. Push to `git@github.com:yusosadick/hasheemstudio.git` and compare local HEAD with remote branch SHA. Record proof. If push access fails, stop deployment and resolve repository access.
- Feature branches, required lint/typecheck/tests/security checks and small commits.
- CI builds/tests images, emits SBOM, scans dependencies/images and pushes immutable digests. Never run untrusted pull-request code on the production host runner.
- Staging deployment first; approved DB migrations then compatible application rollout; public health and browser smoke checks; production uses protected approval and release artifact.
- Implement `pnpm deploy:plan -- --env staging`, `pnpm deploy -- --env staging --sha <SHA>` and `pnpm verify:live -- --env staging`, with production equivalents requiring confirmation. These task interfaces must be built, tested and documented (not yet implemented — see `docs/STATUS.md`).
- No image tagged only `latest`. Store previous image digest, config version and schema compatibility for rollback. Distinguish readiness rollback from data restore.
- Before/after external health probes include Hasheem Studio and approved neighbouring apps to detect collateral impact. Never load-test unrelated apps.

## Current status

Phase 0 foundation commit only. No staging or production deployment exists. No DNS is configured. See `docs/STATUS.md` and `docs/DECISIONS.md`.
