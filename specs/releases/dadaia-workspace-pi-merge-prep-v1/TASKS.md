# TASKS - dadaia-workspace-pi-merge-prep-v1

**Status:** Aprovado

## Implementation Tasks

- [x] T-001 Produce read-only source-context research report
  - Write set: `.dadaia-pi/reports/dadaia-pi-workspace/**`, `specs/releases/dadaia-workspace-pi-merge-prep-v1/**`
  - Acceptance:
    - Report cites `dadaia-workspace` AGENTS, constitution, architecture, and tech-stack memory.
    - No production files in `repos/dadaia-workspace/**` are modified.

- [x] T-002 Produce compatibility matrix and merge file map
  - Write set: `.dadaia-pi/reports/dadaia-pi-workspace/**`, `specs/releases/dadaia-workspace-pi-merge-prep-v1/**`
  - Acceptance:
    - Matrix maps commands, state, hooks/gates, workflows, panel, handoffs, skills/prompts, and Pi extension resources.
    - File map classifies current modules/resources as port/adapt/keep/discard with target `dadaia-workspace` locations.

- [x] T-003 Define Pi harness adapter contract
  - Write set: `.dadaia-pi/reports/dadaia-pi-workspace/**`, `specs/releases/dadaia-workspace-pi-merge-prep-v1/**`
  - Acceptance:
    - Contract documents Pi runtime name, extension bridge, commands, context injection, gate events, trust posture, RPC/headless behavior, and limitations.

- [x] T-004 Emit handoff, update memory, validate, and close
  - Write set: `.dadaia-pi/reports/dadaia-pi-workspace/**`, `.dadaia-pi/handoff/dadaia-pi-workspace/**`, `specs/memory/**`, `specs/releases/dadaia-workspace-pi-merge-prep-v1/**`, `tests_py/test_read_only_parity.py`
  - Acceptance:
    - Machine handoff references the merge-prep report artifacts.
    - Current-truth memory records the merge-prep posture.
    - Validation passes and `CLOSURE.md` archives the release.
