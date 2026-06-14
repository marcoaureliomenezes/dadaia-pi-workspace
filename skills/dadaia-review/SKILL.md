---
name: dadaia-review
description: Review a dadaia-pi-workspace implementation, release artifact, package resource, or lifecycle evidence without mutating production source.
---

# Dadaia Review

Reviews are additive unless the operator explicitly assigns a definition/closure task.

## Review Types

- SPEC/PLAN/TASKS review: check approval readiness, scope, write sets, and acceptance criteria.
- Implementation review: check code, tests, task scope, and behavior.
- Security review: check trust language, package resources, hooks, extension behavior, and secret exposure.
- Evidence review: check reports, handoffs, audits, and closure readiness.

## Procedure

1. Load context and active release with `dadaia-spec-navigator`.
2. Identify review scope and expected verdict.
3. Inspect changed files and relevant memory/release artifacts.
4. Run safe validation commands when useful.
5. Emit findings with severity, path, reason, and fix recommendation.
6. Write evidence to the right channel:
   - `.dadaia-pi/reports/<context>/<role-or-session>/` for human-readable reports;
   - `.dadaia-pi/handoff/<context>/` for machine handoffs;
   - `specs/audits/<YYYYMMDDTHHMMSSZ>-<session_id_8>/` for committed audits.

## Verdicts

- `APPROVED`: scope and acceptance are satisfied.
- `NEEDS_CHANGES`: fixable issues block completion.
- `REJECTED`: scope, safety, or lifecycle violation requires redesign.

## Stop Conditions

- Review requires mutating production source.
- Evidence would include secrets or machine-local trust files.
- Release artifacts are missing, ambiguous, or conflict with constitution.
- Package resources imply sandbox guarantees or unreviewed executable-code trust.
