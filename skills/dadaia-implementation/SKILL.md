---
name: dadaia-implementation
description: Implement an approved dadaia-pi-workspace SDD task under a bound Pi session, reserved TASKS.md marker, and explicit write set.
---

# Dadaia Implementation

Use only for production changes under an approved active release.

## Entry Gate

1. Load context with `dadaia-spec-navigator`.
2. Confirm session binding is for the intended context and implementation/review mode when mutating.
3. Confirm `SPEC.md`, `PLAN.md`, and `TASKS.md` contain `**Status:** Aprovado`.
4. Reserve one task with `dadaia-task-manager` (`[ ]` to `[-]`).
5. Confirm all target paths are included in the reserved task write set.

## Work Protocol

- Make the smallest coherent change that satisfies the task acceptance criteria.
- Keep source-context repositories read-only unless they are the active implementation context.
- Keep runtime state under `.dadaia-pi/**`, not inside managed repos.
- Add or update tests with the behavior change.
- Do not widen public behavior beyond SPEC without returning to definition.

## Validation

Run task-relevant checks, normally:

```bash
npm run build
npm test
node dist/src/cli/main.js specs doctor
```

Record command results in the final response and in a handoff/report when the task changes lifecycle behavior.

## Completion

Before marking `[x]`:

- acceptance criteria are met;
- tests or alternative validation are recorded;
- known risks are documented;
- required review evidence exists or the operator explicitly asks to leave review pending.

## Stop Conditions

- Missing approval, binding, release, or task reservation.
- Requested file is outside write set.
- Change needs new dependency or surface not covered by SPEC.
- Validation cannot run and no alternative evidence is available.
