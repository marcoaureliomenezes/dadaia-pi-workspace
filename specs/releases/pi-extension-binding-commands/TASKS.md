---
release: pi-extension-binding-commands
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# TASKS - pi-extension-binding-commands

**Status:** Aprovado

## Tasks

- [x] T-001 Binding command helpers and parser
  - Owner: software-engineer
  - Write set: `src/pi/**`, `extensions/**`, `tests/**`
  - Acceptance: bind argument parser handles context, mode, release, missing values, and invalid options; implementation/review modes require release through service validation.

- [x] T-002 Pi extension bind/release/status commands
  - Owner: software-engineer
  - Write set: `extensions/**`, `src/pi/**`, `tests/**`
  - Acceptance: extension registers `dadaia-bind`, `dadaia-release`, and `dadaia-status`; commands use `ctx.sessionManager.getSessionId()`; bind/release mutate only session binding state; status is read-only.

- [x] T-003 Documentation and validation closure
  - Owner: product-engineer
  - Write set: `README.md`, `skills/**`, `specs/releases/pi-extension-binding-commands/CLOSURE.md`, `specs/releases/ACTIVE.md`
  - Acceptance: docs explain Pi-native binding commands; validation evidence is recorded; release closes with no specs-doctor errors.
