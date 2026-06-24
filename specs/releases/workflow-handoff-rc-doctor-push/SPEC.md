---
release: workflow-handoff-rc-doctor-push
status: approved
---

# SPEC - workflow-handoff-rc-doctor-push

**Status:** Aprovado

## Scope

Implement the operator-approved recommendations:

1. Review/closure workflows automatically emit handoffs and link them from workflow manifests.
2. Workflow runs with `--rc-id` automatically accumulate review manifest paths on the RC record.
3. Workspace doctor validates workflow manifests and RC records.
4. Pre-push accepts APPROVED security-review workflow evidence, preferably tied to an RC, in addition to legacy security handoffs.

## Acceptance

- `spec-review`, `qa-review`, `security-review`, `code-review`, and `release-closure` workflow runs emit `.handoff.json` files and record them in `manifest.linkedHandoffs`.
- QA/security/code workflow runs with `--rc-id` update the RC record review arrays.
- `dadaia-pi doctor` reports malformed workflow manifests and RC records.
- Pre-push passes when APPROVED security-review workflow evidence exists for the workspace context/release/RC.
- Tests and specs doctor pass.
