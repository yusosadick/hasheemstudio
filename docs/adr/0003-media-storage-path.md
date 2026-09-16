# ADR-0003: Authoritative media storage path

**Status:** Proposed — NOT yet decided or implemented

**Date opened:** 2026-09-16

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

Not yet made. This is a Phase 2/4 decision that requires an actual resumable-upload test against
the dedicated Supabase Storage instance once it exists, not a decision made from documentation
alone.

## Consequences

No upload code should be written against two different storage backends "just in case." Phase 4
(`docs/IMPLEMENTATION-PLAN.md`) blocks on this ADR being resolved with real test evidence.
