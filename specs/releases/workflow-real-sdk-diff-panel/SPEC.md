---
release: workflow-real-sdk-diff-panel
status: approved
---

# SPEC - workflow-real-sdk-diff-panel

**Status:** Aprovado

## Scope

Implement: real SDK output capture, unified diff controlled patches, stronger extension bash mutation detection, workflow panel visibility, and RC diff coverage doctor gates.

## Acceptance

- SDK adapter includes actual assistant/message text in `sdk.summary` when available.
- Controlled patch apply supports unified diff text/files with path write-set validation before applying.
- Pi extension detects common mutating bash commands: `mv`, `cp`, `rm`, `touch`, `mkdir`, and `tee`.
- Panel exposes workflow UI/API showing phase, missing gates, active task/write set, RC status, latest manifests/handoffs, and workflow doctor issues.
- Doctor compares RC changed files with review `reviewedPaths` for code/security and QA `acceptanceCoverage`.
