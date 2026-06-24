---
release: workflow-state-gates-write-set
status: approved
---

# SPEC - workflow-state-gates-write-set

**Status:** Aprovado

## Problem

The workflow orchestration layer defines lifecycle workflows and emits evidence, but it does not yet govern release phase transitions or enforce exact task write sets at commit time. Operators need the first hard governance layer: a release workflow state machine, required workflow evidence gates, and exact pre-commit task write-set validation.

## Scope

Implement the approved defaults:

1. A workflow state machine with canonical phases:
   `BACKLOG -> RESEARCH -> RELEASE_DEFINITION -> SPEC_REVIEW -> IMPLEMENTATION -> QA_REVIEW -> SECURITY_REVIEW -> CODE_REVIEW -> CLOSURE -> ARCHIVED`.
2. Evidence gates based on workflow manifests for the current context/release:
   - implementation requires `spec-review` evidence;
   - QA requires `implementation-task` evidence;
   - security requires `qa-review` evidence;
   - code review requires `security-review` evidence;
   - closure requires `qa-review`, `security-review`, and `code-review` evidence plus all tasks complete/deferred;
   - archive requires `release-closure` evidence.
3. Exact task write-set validation in pre-commit:
   - find exactly one `[-]` task in active release `TASKS.md`;
   - parse the `Write set:` line for backtick paths;
   - support exact paths, `**` prefix globs, and `*` segment globs;
   - block mutating staged paths outside the reserved task write set.

## Requirements

- Add workflow status/advance CLI commands:
  - `dadaia-pi workflow status --context <name> --release <id> [--json]`
  - `dadaia-pi workflow advance --context <name> --release <id> --to <phase> [--json]`
- Keep `RESEARCH` optional when advancing from `BACKLOG` or `RELEASE_DEFINITION` toward spec review.
- Store current phase in `specs/releases/ACTIVE.md` as today.
- Workflow gates must inspect `.dadaia-pi/workflows/<context>/*.json` manifests and require `sdk.accepted === true` for matching context/release/workflow id.
- Pre-commit must keep existing lease/reserved-task checks and add exact write-set validation for mutating staged paths.
- Tests must cover phase gates, optional research behavior, manifest evidence checks, CLI status/advance, and write-set matching.

## Acceptance

- `workflow status` reports phase, allowed next phases, and missing gates.
- `workflow advance` updates `ACTIVE.md` only when required evidence is present.
- Pre-commit blocks staged mutating files outside the active `[-]` task write set.
- Existing tests and specs doctor pass.
