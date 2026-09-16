# ADR-0001: Record architecture decisions

**Status:** Accepted
**Date:** 2026-09-16

## Context

Hasheem Studio is a multi-phase, multi-session implementation effort that will be picked up by
different agents (Claude Code sessions, MacBook developers, CI) over time. Decisions made about
stack, data flow, and infrastructure need to survive context resets.

## Decision

We record architecturally significant decisions as ADRs in `docs/adr/`, numbered sequentially,
using this lightweight format: Status, Date, Context, Decision, Consequences. ADRs are not revised
in place once accepted; a changed decision gets a new ADR that supersedes the old one.

## Consequences

Anyone resuming work reads `docs/STATUS.md` then relevant ADRs before re-deciding something already
settled.
