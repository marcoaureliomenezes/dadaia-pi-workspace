---
release: bootstrap-pi-native-specs
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# TASKS - bootstrap-pi-native-specs

**Status:** Aprovado

## Tasks

- [ ] T-001 Project foundation
  - Owner: software-engineer
  - Write set: `package.json`, `package-lock.json`, `tsconfig.json`, test/lint config, `src/**`, `tests/**`
  - Acceptance: install/build/test/lint/typecheck scripts exist and run.

- [ ] T-002 Spec scaffold and doctor
  - Owner: software-engineer
  - Write set: `src/features/specs/**`, `src/features/memory/**`, `src/core/**`, `tests/**`
  - Acceptance: temp workspace scaffold validates with zero doctor errors.

- [ ] T-003 Context registry and lifecycle
  - Owner: software-engineer
  - Write set: `src/features/context/**`, `src/infrastructure/git/**`, `src/infrastructure/store/**`, `tests/**`
  - Acceptance: create/list/show/alive/dead work in temp repos.

- [ ] T-004 Session bind and memory injection
  - Owner: software-engineer
  - Write set: `src/features/context/**`, `src/pi/**`, `.pi/extensions/**`, `tests/**`
  - Acceptance: a Pi session can bind a context and receive constitution plus selected memory.

- [ ] T-005 Gate and lease kernel
  - Owner: software-engineer
  - Write set: `src/features/gate/**`, `src/features/context/**`, `src/core/**`, `tests/**`
  - Acceptance: ADDITIVE flows without lease; MUTATING requires approved release and live lease; stale reclaim and live foreign yield are tested.

- [ ] T-006 Git chokepoints
  - Owner: software-engineer
  - Write set: `src/features/hooks/**`, `src/infrastructure/git/**`, `bin/**`, `tests/**`
  - Acceptance: pre-commit and pre-push checks run from installed hooks and fail with actionable messages.

- [ ] T-007 Pi package resources
  - Owner: software-engineer
  - Write set: `.pi/**`, `src/pi/**`, `skills/**`, `prompts/**`, package manifest files, `tests/**`
  - Acceptance: resources install as a Pi package and load after project trust.

- [ ] T-008 Documentation and security notes
  - Owner: product-engineer
  - Write set: `README.md`, `AGENTS.md`, `specs/memory/**`, release `CLOSURE.md`
  - Acceptance: first-run flow explains Pi trust, no-sandbox posture, and SDD workflow.
