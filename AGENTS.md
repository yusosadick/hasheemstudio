# AGENTS.md

This file governs any autonomous or semi-autonomous coding agent (Claude Code, other CLI agents,
CI bots) operating in this repository. It restates and extends `CLAUDE.md` in agent-agnostic terms.

## Scope of authority

- You may read anything in this repository and, for discovery, the host it runs on.
- You may create/modify files inside `/home/yuso/hasheemstudio` (or wherever this repo is cloned)
  and run project-scoped Docker Compose stacks under the `hasheemstudio` project name.
- You may **not** modify anything outside this repo's own project-scoped resources without it
  being an explicitly read-only discovery command, unless the task at hand (e.g. installing a
  pinned global CLI tool needed to run this project's own scripts) is low-risk, reversible, and
  clearly scoped — record what you did and why in `docs/STATUS.md`.
- You may **not** touch other projects' containers, databases, secrets, DNS zones outside
  `hasheemstudio.com`'s own records, the shared reverse proxy's routing for other apps, or the
  host firewall.

## Required behaviour

- **Discovery before action.** Before any deploy/migration/DNS/infra step, inspect current state
  (`docker ps`, `git status`, `dig`, target DB identity) rather than assuming prior session state
  still holds.
- **Small, reviewable commits.** One logical change per commit; do not squash phases together.
- **Tests before/with implementation** where the plan calls for testable behaviour
  (`docs/IMPLEMENTATION-PLAN.md` §22 "Delivery method").
- **Never force-push.** Never rewrite shared branch history.
- **Never print secret values** in commands, logs, commit messages, or chat — only secret *names*
  and *file locations*.
- **Single migration owner, single deploy coordinator** at a time — do not let two parallel agents
  independently apply migrations or deploy to the same environment (`docs/MIGRATIONS.md`).
- **Update `docs/STATUS.md` at the end of every phase or work session**, even (especially) if
  incomplete, so the next agent — on this VPS or a MacBook — can resume without any prior chat
  context.

## Evidence standard

A requirement is "done" only with recorded evidence: a real command's output, a live HTTPS
response, a screenshot, a remote-verified migration ledger entry, or a passing test run against
real infrastructure (not a mock). See `docs/IMPLEMENTATION-PLAN.md` §23 "Definition of done —
evidence matrix" and store sanitised evidence under `docs/evidence/`.

## If something is missing

Missing credential, DNS access, budget approval, dedicated hardware, or owner decision → record it
as a named blocker in `docs/STATUS.md` and `docs/DECISIONS.md`, continue other unblocked work, and
never substitute a fake service, mocked success response, or invented value to make progress look
complete.
