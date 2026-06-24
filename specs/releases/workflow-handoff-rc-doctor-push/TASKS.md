---
release: workflow-handoff-rc-doctor-push
status: approved
---

# TASKS - workflow-handoff-rc-doctor-push

**Status:** Aprovado

- [x] T-001 Implement handoff linking, RC accumulation, doctor checks, and pre-push workflow security gate
  - Write set: `src/features/workflows/**`, `src/features/hooks/**`, `src/features/doctor/**`, `src/cli/main.ts`, `tests/workflows.test.ts`, `tests/hooks.test.ts`, `README.md`, `specs/memory/**`, `specs/releases/ACTIVE.md`, `specs/releases/workflow-handoff-rc-doctor-push/**`
  - Acceptance: workflow handoffs link to manifests, RC records accumulate reviews, doctor validates workflow/RC records, pre-push accepts APPROVED security workflow evidence, validation passes.
