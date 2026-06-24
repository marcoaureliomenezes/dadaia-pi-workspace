---
release: workflow-state-gates-write-set
status: approved
---

# PLAN - workflow-state-gates-write-set

**Status:** Aprovado

1. Add workflow governance/state-machine module for phase order, optional research, required manifest gates, ACTIVE.md read/write, task completion checks, and status/advance operations.
2. Extend workflow CLI with `status` and `advance` commands.
3. Add exact TASKS.md write-set parser/matcher and wire it into pre-commit checks.
4. Add tests for governance and pre-commit write-set enforcement.
5. Update README and memory current truth.
6. Validate with lint, typecheck, tests, build, and specs doctor.

## Risks and controls

- Risk: manifest-only gates can over-approve because verdict parsing is shallow. Control: require matching context/release/workflow and `sdk.accepted === true`; future release can add verdict schemas.
- Risk: glob parsing may be incomplete. Control: implement documented exact, `**`, and `*` behavior with tests.
- Risk: phase advancement may conflict with archived releases. Control: only updates `ACTIVE.md` for the provided release and reports clear missing gates.
