---
release: handoff-cli-security-helper
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# SPEC - handoff-cli-security-helper

**Status:** Aprovado

## Problem

Security review and pre-push evidence currently require hand-written handoff JSON. This is error-prone and slows the safe push path.

## Goal

Add read/write CLI helpers for handoff evidence:

- validate one handoff file;
- list handoffs for a context;
- emit an approved security-reviewer handoff for a commit after the operator/reviewer has performed review.

## Requirements

### PR-1: Validate handoff

Acceptance:

- `dadaia-pi handoff validate <file> [--json]` validates the existing minimal handoff schema;
- exits non-zero for invalid handoffs;
- text output is concise and actionable.

### PR-2: List handoffs

Acceptance:

- `dadaia-pi handoff list [--context <name>] [--json]` lists `.dadaia-pi/handoff/**.handoff.json`;
- includes file path, context, agent, producedAt, verdict, release, and commit sha when available;
- malformed handoffs are listed with an error instead of crashing.

### PR-3: Emit security approval helper

Acceptance:

- `dadaia-pi handoff approve-security --context <name> --commit <sha> [--session-id <id>] [--scope <text>]` writes an APPROVED `security-reviewer` handoff;
- generated handoff satisfies existing schema and pre-push hook expectations: `agent: security-reviewer`, `verdict: APPROVED`, and `metrics.commit_sha`;
- command refuses invalid commit sha and missing context;
- command does not fabricate test results; it records only explicit metadata and optional scope.

## Non-Goals

- No full review automation.
- No claim that security approval was performed by the tool itself.
- No schema version expansion beyond the current minimal contract.
