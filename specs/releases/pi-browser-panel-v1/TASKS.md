---
release: pi-browser-panel-v1
status: approved
---

# TASKS - pi-browser-panel-v1

**Status:** Aprovado

- [x] T-001 Implement local browser panel server
  - Write set: `src/features/panel/**`, `src/cli/main.ts`, `src/index.ts`, `extensions/dadaia-pi.ts`, `tests/panel.test.ts`
  - Acceptance: server starts on loopback, exposes read-only routes, rejects non-loopback bind.

- [x] T-002 Update docs and memory
  - Write set: `README.md`, `specs/backlog/pi-native-status-surface.md`, `specs/memory/product/**`, `specs/releases/pi-browser-panel-v1/**`
  - Acceptance: current truth names `dadaia-pi panel` as shipped.
