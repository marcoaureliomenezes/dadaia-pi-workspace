---
release: extension-rich-rc-patch
status: approved
---

# TASKS - extension-rich-rc-patch

**Status:** Aprovado

- [x] T-001 Implement rich verdict parsing, RC inspect, semantic doctor, extension write-set gate, and controlled patch apply
  - Write set: `src/features/workflows/**`, `src/features/doctor/**`, `src/cli/main.ts`, `extensions/dadaia-pi.ts`, `tests/workflows.test.ts`, `tests/hooks.test.ts`, `README.md`, `specs/memory/**`, `specs/releases/ACTIVE.md`, `specs/releases/extension-rich-rc-patch/**`
  - Acceptance: rich verdict JSON parsed, RC inspect works, doctor semantic checks exist, extension blocks out-of-write-set mutation, patch apply validates/applies/audits, validation passes.
