---
name: dadaia-doctor
description: Run dadaia-pi-workspace validation and drift checks for workspace state, specs, package resources, and lifecycle evidence.
---

# Dadaia Doctor

Use when checking readiness, investigating drift, or preparing handoff/closure evidence.

## Validation Ladder

Run the smallest useful set first, then expand:

1. Workspace state:
   ```bash
   node dist/src/cli/main.js doctor
   ```
2. Committed specs:
   ```bash
   node dist/src/cli/main.js specs doctor
   ```
3. Build and package resources:
   ```bash
   npm run build
   npm test
   ```
4. Full project check when available:
   ```bash
   npm run check
   ```

## What To Inspect

- `.dadaia-pi/states/spec_contexts.json` has expected ALIVE/DEAD contexts.
- Active session binding matches intended context, mode, and release.
- Active release artifacts are approved before implementation.
- Exactly one task is `[-]` during implementation.
- Reports and handoffs use the correct channels.
- Package resources under `extensions/`, `skills/`, and `prompts/` are minimal and auditable.

## Drift Checks

- Search for obsolete runtime paths or harness instructions before finishing package-resource work.
- Confirm memory is current product truth, not a changelog.
- Confirm README and AGENTS.md do not promise sandboxing.
- Confirm generated build output is not treated as source.

## Reporting

Record commands, pass/fail status, and remaining risks in one of:

- `.dadaia-pi/reports/<context>/<role-or-session>/` for human reports;
- `.dadaia-pi/handoff/<context>/` for machine handoffs;
- `specs/audits/<timestamp-session>/` for committed audit evidence.

Stop before closure if any required validation cannot run and no acceptable alternative evidence exists.
