---
name: dadaia-task-manager
description: Reserve, execute, and complete dadaia-pi-workspace TASKS.md work using the canonical [ ], [-], and [x] lifecycle markers.
---

# Dadaia Task Manager

Use before any production write under an active release.

## Marker Contract

| Marker | State | Meaning |
|---|---|---|
| `[ ]` | OPEN | Declared and available. |
| `[-]` | IN PROGRESS | Reserved by the active implementation session. |
| `[x]` | DONE | Implemented and accepted for the release. |

Invariant: at most one `[-]` task may exist in one active `TASKS.md` unless the release explicitly defines independent segments.

## Procedure

1. Read `specs/releases/ACTIVE.md`.
2. Read the active release `SPEC.md`, `PLAN.md`, and `TASKS.md`.
3. Confirm all three artifacts contain `**Status:** Aprovado`.
4. Pick exactly one `[ ]` task whose write set covers the intended files.
5. Reserve it by changing `[ ]` to `[-]`.
6. Implement only within the task write set.
7. Record validation commands and results.
8. Mark `[-]` to `[x]` only after acceptance criteria are satisfied and required review evidence exists.

## Recovery

- Existing foreign `[-]`: stop and ask the operator before taking over.
- Two or more `[-]`: stop; task state is inconsistent.
- Need to abandon: change `[-]` back to `[ ]` and record the reason in a report or handoff.
- Gate blocks a write: do not bypass; fix binding, lease, approval, or path issue.

## Output Evidence

Use the channels defined by the constitution:

- human reports: `.dadaia-pi/reports/<context>/<role-or-session>/`;
- machine handoffs: `.dadaia-pi/handoff/<context>/`;
- committed audits: `specs/audits/<YYYYMMDDTHHMMSSZ>-<session_id_8>/`.
