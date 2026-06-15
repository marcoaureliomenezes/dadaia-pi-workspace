---
release: workspace-scaffold-install
status: Aprovado
owner: product-engineer
created: 2026-06-15
---

# TASKS - workspace-scaffold-install

**Status:** Aprovado

## Tasks

- [x] T-001 Workspace scaffold/install/doctor
  - Owner: software-engineer
  - Write set: `src/features/workspace/**`, `src/cli/**`, `src/index.ts`, `tests/**`, `README.md`
  - Acceptance: workspace init/install/doctor work in sandbox and project skills/prompts/AGENTS without symlinks.

- [x] T-002 Closure and instantiated workspace repair
  - Owner: product-engineer
  - Write set: `specs/releases/workspace-scaffold-install/CLOSURE.md`, `specs/releases/ACTIVE.md`
  - Acceptance: `/home/marco/workspace/pi-agent` repaired using CLI; validation recorded.
