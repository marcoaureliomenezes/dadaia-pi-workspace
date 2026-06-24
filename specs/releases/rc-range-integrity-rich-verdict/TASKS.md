---
release: rc-range-integrity-rich-verdict
status: approved
---

# TASKS - rc-range-integrity-rich-verdict

**Status:** Aprovado

- [x] T-001 Implement RC commit-range pre-push, integrity doctor, and rich verdict gates
  - Write set: `src/features/workflows/**`, `src/features/hooks/**`, `src/features/doctor/**`, `tests/workflows.test.ts`, `tests/hooks.test.ts`, `README.md`, `specs/memory/**`, `specs/releases/ACTIVE.md`, `specs/releases/rc-range-integrity-rich-verdict/**`
  - Acceptance: pre-push maps SHAs to approved RC ranges, doctor validates evidence cross-references, verdict schema includes rich fields, gates block blocking findings, validation passes.
