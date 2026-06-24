# TASKS - python-command-parity-v1

**Status:** Aprovado

## Implementation Tasks

- [x] T-001 Port handoff commands to Python
  - Write set: `src/dadaia_pi/**`, `tests_py/**`, `README.md`, `specs/releases/python-command-parity-v1/**`
  - Acceptance:
    - Python CLI supports `handoff validate`, `handoff list`, and `handoff approve-security`.
    - Tests cover valid/invalid handoffs, context filtering, and generated security approvals.

- [x] T-002 Port workflow governance status/advance to Python
  - Write set: `src/dadaia_pi/**`, `tests_py/**`, `specs/releases/python-command-parity-v1/**`
  - Acceptance:
    - Python CLI supports `workflow status` and `workflow advance`.
    - Phase transitions enforce required APPROVED zero-blocking evidence.
    - Tests cover allowed, blocked, and invalid transitions.

- [x] T-003 Port release-candidate commands to Python
  - Write set: `src/dadaia_pi/**`, `tests_py/**`, `.dadaia-pi/release-candidates/**`, `specs/releases/python-command-parity-v1/**`
  - Acceptance:
    - Python CLI supports `workflow rc create/list/inspect`.
    - RC records preserve existing schema expectations and review arrays.
    - Tests cover commit range metadata and changed-file discovery/fallback.

- [x] T-004 Port controlled patch apply to Python
  - Write set: `src/dadaia_pi/**`, `tests_py/**`, `.dadaia-pi/reports/dadaia-pi-workspace/**`, `specs/releases/python-command-parity-v1/**`
  - Acceptance:
    - Python CLI supports `workflow patch apply` with required `--approve`.
    - Patch paths are validated against the reserved task write set.
    - Full-file and exact oldText/newText patch forms are supported or unsupported forms are rejected clearly.
    - Patch audit evidence is emitted.

- [x] T-005 Port evidence bundle, readiness, and backlog hygiene to Python
  - Write set: `src/dadaia_pi/**`, `tests_py/**`, `.dadaia-pi/reports/dadaia-pi-workspace/**`, `specs/backlog/**`, `specs/releases/python-command-parity-v1/**`
  - Acceptance:
    - Python CLI supports `workflow evidence bundle`, `workflow readiness`, `workflow backlog-check`, and `workflow backlog-consume`.
    - Readiness summarizes phase, gates, RC coverage, doctor issues, push readiness, closure readiness, and score.
    - Backlog commands are additive or mark consumed truth without deleting evidence.

- [x] T-006 Add richer Python doctor checks
  - Write set: `src/dadaia_pi/**`, `tests_py/**`, `specs/releases/python-command-parity-v1/**`
  - Acceptance:
    - Python doctor checks workflow manifests, RC records, linked handoffs, active phase/evidence consistency, and authority boundary drift.
    - Current workspace passes Python doctor after implementation.

- [x] T-007 Update docs/memory and parity evidence
  - Write set: `README.md`, `package.json`, `specs/memory/**`, `.dadaia-pi/reports/dadaia-pi-workspace/**`, `.dadaia-pi/handoff/dadaia-pi-workspace/**`, `specs/releases/python-command-parity-v1/**`
  - Acceptance:
    - Docs list Python parity commands.
    - Memory reflects current truth only.
    - Evidence report and machine handoff summarize parity validation.

## Review and Closure Tasks

- [x] T-008 Close release
  - Write set: `specs/releases/python-command-parity-v1/**`, `specs/memory/**`, `specs/audits/**`
  - Acceptance:
    - `CLOSURE.md` records delivered parity, validation, risks, and follow-up work.
    - `ACTIVE.md` advances according to lifecycle rules after closure evidence exists.
