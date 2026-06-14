---
release: bootstrap-pi-native-specs
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# TASKS - bootstrap-pi-native-specs

**Status:** Aprovado

## Tasks

- [x] T-001 Project foundation
  - Owner: software-engineer
  - Write set: `package.json`, `package-lock.json`, `tsconfig.json`, test/lint config, `src/**`, `tests/**`, package resource roots
  - Acceptance: install/build/test/lint/typecheck scripts exist and run; package declares valid Pi resources; Pi core packages are peer dependencies.

- [x] T-002 Spec scaffold and doctor
  - Owner: software-engineer
  - Write set: `src/features/specs/**`, `src/features/memory/**`, `src/features/doctor/**`, `src/core/**`, `tests/**`
  - Acceptance: temp workspace scaffold validates with zero specs-doctor errors; workspace doctor distinguishes runtime-state checks from committed specs checks.

- [x] T-003 Context registry and lifecycle
  - Owner: software-engineer
  - Write set: `src/features/context/**`, `src/infrastructure/git/**`, `src/infrastructure/store/**`, `tests/**`
  - Acceptance: create/list/show/update/alive/dead work in temp repos; repo URL persists and can be back-filled from git origin.

- [x] T-004 Session bind and memory injection
  - Owner: software-engineer
  - Write set: `src/features/context/**`, `src/pi/**`, `extensions/**`, `tests/**`
  - Acceptance: a Pi session can bind a context using Pi session id, writes bind metadata/marker/pointer, and receives constitution plus selected memory after trust.

- [x] T-005 Gate and lease kernel
  - Owner: software-engineer
  - Write set: `src/features/gate/**`, `src/features/context/**`, `src/core/**`, `extensions/**`, `tests/**`
  - Acceptance: ADDITIVE flows without lease; MUTATING requires approved release and live lease; READ mode restricts active tools and blocks mutating writes non-acquiring; `tool_call` and `user_bash` paths are covered; stale reclaim and live foreign yield are tested.

- [x] T-006 Git chokepoints
  - Owner: software-engineer
  - Write set: `src/features/hooks/**`, `src/infrastructure/git/**`, `bin/**`, `tests/**`
  - Acceptance: pre-commit and pre-push checks run from installed hooks and fail with actionable messages.

- [x] T-007 Pi package resources
  - Owner: software-engineer
  - Write set: `extensions/**`, `skills/**`, `prompts/**`, `src/pi/**`, package manifest files, generated `.pi/**` templates if any, `tests/**`
  - Acceptance: resources install as a Pi package, package-local resources load through Pi package rules, and consumer `.pi/**` resources load only after project trust.

- [x] T-008 Documentation and security notes
  - Owner: product-engineer
  - Write set: `README.md`, `AGENTS.md`, `specs/memory/**`, release `CLOSURE.md`
  - Acceptance: first-run flow explains Pi trust, non-interactive `--approve` behavior, no-sandbox posture, package executable-code risk, and SDD workflow.
