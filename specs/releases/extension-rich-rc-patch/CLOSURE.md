---
release: extension-rich-rc-patch
status: closed
---

# CLOSURE - extension-rich-rc-patch

**Status:** Fechado

## Summary

Implemented rich SDK verdict parsing, upgraded release-candidate creation/inspection, semantic workflow doctor checks, Pi extension exact write-set enforcement, and controlled patch application.

## Completed tasks

- [x] T-001 Implement rich verdict parsing, RC inspect, semantic doctor, extension write-set gate, and controlled patch apply

## Validation

- `npm run build` — passed.
- `npm test` — passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `node dist/src/cli/main.js specs doctor` — passed.
- `node dist/src/cli/main.js doctor --json` from workspace root — passed.

## Behavior now true

- Workflow runner parses rich verdict JSON from SDK summaries.
- RC creation accepts `--commits` or `--from/--to`.
- RC inspection reports commits, changed files, review status, and stale HEAD state.
- Doctor validates active-release RC review completeness, review `reviewedPaths`, QA `acceptanceCoverage`, and closure memory evidence.
- Pi extension blocks implementation write/edit/bash mutations outside the active reserved task write set and shows active task/write set in bootstrap.
- Controlled patch application requires `--approve`, validates patch paths against the reserved task write set, applies content or oldText/newText operations, and emits audit evidence.

## Memory updates performed

- Updated README.
- Updated `specs/memory/product/headless-workflow-orchestration.md` with current-truth workflow governance behavior.

## Known risks

- Rich verdict parsing accepts JSON embedded in SDK summaries; SDK adapters that do not expose model text still use deterministic defaults.
- Controlled patch application supports simple content and exact oldText/newText operations, not arbitrary unified diff hunks.
- Extension write-set enforcement covers detected write/edit paths and redirect-style bash targets; it is not an OS sandbox.
