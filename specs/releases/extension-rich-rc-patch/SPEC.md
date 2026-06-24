---
release: extension-rich-rc-patch
status: approved
---

# SPEC - extension-rich-rc-patch

**Status:** Aprovado

## Scope

Implement next governance hardening:

1. Parse rich verdict JSON from SDK output.
2. Upgrade RC commands with `--from/--to`, `inspect`, commits, changed files, review status, and stale detection.
3. Add doctor semantic completeness checks for active release RC reviews and closure memory evidence.
4. Enforce exact task write set at Pi extension tool-call time.
5. Add a controlled patch application CLI that validates paths against the reserved task write set, requires operator approval, applies patches, and emits audit evidence.

## Acceptance

- Workflow runner extracts rich verdict fields from structured JSON embedded in SDK summaries.
- `workflow rc create` accepts either `--commits` or `--from <base> --to <head>`.
- `workflow rc inspect` reports commits, changed files, review status, and stale status.
- Doctor reports active-release semantic gaps for RC reviews and closure memory evidence.
- Extension bootstrap shows active reserved task/write set, and tool/bash mutations outside the reserved task write set are blocked in implementation mode.
- `workflow patch apply --context --release --patch-file --approve` validates against the reserved task write set, applies patch operations, and writes audit evidence.
