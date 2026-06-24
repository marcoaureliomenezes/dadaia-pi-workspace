---
release: workflow-real-sdk-diff-panel
status: closed
---

# CLOSURE - workflow-real-sdk-diff-panel

**Status:** Fechado

## Summary

Implemented real SDK output capture, unified diff controlled patches, stronger extension bash mutation detection, workflow panel visibility, and RC changed-file coverage gates.

## Completed tasks

- [x] T-001 Implement SDK output capture, unified diff patches, extension bash detection, panel workflow UI, and RC diff coverage gates

## Validation

- `npm run build` — passed.
- `npm test` — passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `node dist/src/cli/main.js specs doctor` — passed.
- `node dist/src/cli/main.js doctor --json` from workspace root — passed.

## Memory updates performed

- Updated README.
- Updated `specs/memory/product/headless-workflow-orchestration.md` with current-truth behavior.

## Known risks

- SDK message extraction is best-effort over exposed message/result shapes.
- Unified diff application uses `git apply`; malformed diffs fail safely.
- Extension bash detection covers common mutating commands but remains a Pi-layer gate, not an OS sandbox.
