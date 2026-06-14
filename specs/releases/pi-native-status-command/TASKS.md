---
release: pi-native-status-command
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# TASKS - pi-native-status-command

**Status:** Aprovado

## Tasks

- [x] T-001 Status report service
  - Owner: software-engineer
  - Write set: `src/features/status/**`, `src/index.ts`, `tests/**`
  - Acceptance: service returns workspace root, doctor summary, context list, optional session binding, optional selected context, active release summary, task marker counts, and handoff/report counts; temp-workspace tests cover missing files gracefully.

- [x] T-002 CLI status command
  - Owner: software-engineer
  - Write set: `src/cli/**`, `src/features/status/**`, `tests/**`, `README.md`
  - Acceptance: `dadaia-pi status [--session-id <id>] [--context <name>] [--json]` works; text output is concise; JSON output is tested.

- [x] T-003 Documentation and memory update
  - Owner: product-engineer
  - Write set: `README.md`, `specs/memory/product/pi-native-status-surface.md`, `specs/memory/product/catalog.json`, `specs/backlog/pi-native-status-surface.md`, `specs/releases/pi-native-status-command/CLOSURE.md`, `specs/releases/ACTIVE.md`
  - Acceptance: memory states that CLI status is the first implemented visibility surface; backlog records remaining TUI/panel scope; closure includes validation evidence.
