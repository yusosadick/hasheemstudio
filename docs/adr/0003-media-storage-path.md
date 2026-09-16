# ADR-0003: Authoritative media storage path

**Status:** Accepted for P0 (revisit before scaling past a single host)

**Date opened:** 2026-09-16
**Date decided:** 2026-09-16

## Context

`docs/MASTER-PLAN-ORIGINAL.md` §9 requires choosing exactly ONE authoritative media upload/storage
path — either (a) private Supabase Storage backed by a supported S3-compatible backend, or (b) a
dedicated object-store integration — and explicitly forbids duplicating ownership metadata across
two independent upload systems without reconciliation.

This decision depends on:

- Resumable-upload behaviour validated against Supabase Storage's actual resumable-upload support
  (TUS-based) at the file sizes this product needs (up to 500 MB in the Pro Beta tier).
- Whether Supabase Storage's proxy/body limits, tested with a real permitted-maximum-size file
  through the actual ingress path, are compatible with the architecture in `docs/ARCHITECTURE.md`
  ("large files must bypass JSON API buffering and frontend memory").
- Available/approved off-host object storage budget (see `docs/DECISIONS.md`) if a separate
  dedicated object store is chosen instead.

## Decision

**Supabase Storage, `file` backend, single authoritative bucket `media`.** Decided with real
evidence, not from documentation alone: `apps/api`'s upload flow uses Storage's
signed-upload-URL mechanism (`POST /storage/v1/object/upload/sign/...`) so the browser/client PUTs
bytes directly to Storage, bypassing the API's own body — exactly the "upload media directly to
the media/storage path" requirement in `docs/ARCHITECTURE.md`. Verified end-to-end in
`tests/e2e/upload-to-download.mjs`: real signed upload, real finalize (server-side object
existence + size check via `POST /storage/v1/object/list`), real worker download
(`GET /storage/v1/object/authenticated/...`), real output upload, real signed download URL.

**Not yet decided/tested:** true resumable (multi-part/TUS-style) uploads for interrupted-network
recovery — this pass only proved a single-shot signed PUT. `docs/PRD.md`'s "resumable uploads;
interruption recovery" acceptance criterion is not yet met and needs its own test before P0 launch.

## Consequences

Both `apps/api` and `apps/worker` currently duplicate a small Storage HTTP client
(`src/storage.ts` in each) rather than sharing one — flagged in `docs/STATUS.md` as a
consolidation task for `packages/media-recipes` or a new shared package once resumable-upload
logic is added (better to design the shared interface once, not twice).

Revisit this ADR before scaling storage beyond what a single host's disk can hold — see
`docs/CAPACITY.md`.
