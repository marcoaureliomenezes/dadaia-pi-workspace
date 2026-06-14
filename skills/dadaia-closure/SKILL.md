---
name: dadaia-closure
description: Close a dadaia-pi-workspace release by validating tasks, recording evidence, updating current-truth memory, and advancing ACTIVE.md.
---

# Dadaia Closure

Closure is mutating product-truth work. Use only when implementation tasks and required review evidence are complete.

## Preconditions

- Active release is in CLOSURE or operator explicitly requests closure preparation.
- All required tasks are `[x]` or intentionally deferred with explanation.
- Validation evidence exists.
- Review/security evidence required by the release exists.

## Procedure

1. Load context with `dadaia-spec-navigator`.
2. Verify `SPEC.md`, `PLAN.md`, `TASKS.md`, and task markers.
3. Run final validation:
   ```bash
   npm test
   npm run build
   node dist/src/cli/main.js specs doctor
   node dist/src/cli/main.js doctor
   ```
4. Write `CLOSURE.md` with:
   - summary;
   - completed tasks;
   - validation commands and results;
   - review/evidence links;
   - known risks or `none`;
   - memory updates performed.
5. Update `specs/memory/**` as current product truth only. Do not write changelog prose there.
6. Update `specs/memory/product/catalog.json` if product atoms changed.
7. Update `specs/releases/ACTIVE.md` to the next intended state.
8. Emit handoff if another agent or operator action is needed.

## Stop Conditions

- Any required task remains `[-]` or unresolved `[ ]` without explicit deferral.
- Validation fails and no accepted waiver exists.
- Memory update would duplicate release history instead of current truth.
- Closure would hide unresolved security or trust issues.
