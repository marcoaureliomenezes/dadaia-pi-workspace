---
release: port-dadaia-workspace-core
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# TASKS - port-dadaia-workspace-core

**Status:** Aprovado

## Tasks

- [x] T-001 Source-context research and traceability map
  - Owner: product-engineer
  - Write set: `.dadaia-pi/reports/dadaia-pi-workspace/**`, `specs/releases/port-dadaia-workspace-core/**`
  - Acceptance: report maps `dadaia-workspace` skills/panel/lifecycle concepts to `port-now`, `adapt-later`, or `reject`; source files are cited by path; multi-harness concepts to avoid are listed.

- [x] T-002 Expand Pi-native core lifecycle skills
  - Owner: software-engineer
  - Write set: `skills/**`, `tests/**`, `package.json`
  - Acceptance: package includes detailed skills for spec navigation, release definition, task management, implementation, review, closure, handoff emission, and doctor/drift operation; tests confirm required skills exist and package validation passes.

- [x] T-003 Define and validate handoff/report contracts
  - Owner: software-engineer
  - Write set: `src/features/**`, `src/core/**`, `tests/**`, `skills/**`, `specs/memory/**`
  - Acceptance: Pi-native handoff/report locations and minimal JSON contract are documented; doctor or tests validate basic schema/location integrity; handoff skill uses `.dadaia-pi/handoff/<context>/`.

- [x] T-004 Decide Pi-native panel/status surface
  - Owner: product-engineer
  - Write set: `.dadaia-pi/reports/dadaia-pi-workspace/**`, `specs/backlog/**`, `specs/memory/**`, `specs/releases/port-dadaia-workspace-core/**`
  - Acceptance: old panel capabilities are assessed; decision is recorded as implement-now/defer/reject; if deferred, a backlog item captures the future Pi-native panel/TUI/status scope.

- [x] T-005 Documentation, memory, and validation closure
  - Owner: product-engineer
  - Write set: `README.md`, `AGENTS.md`, `specs/memory/**`, `specs/releases/port-dadaia-workspace-core/CLOSURE.md`, `specs/releases/ACTIVE.md`, `tests/**`
  - Acceptance: docs explain the imported source-context role and Pi-only lifecycle skills; memory reflects current truth; validation commands are recorded; release can be closed without unresolved lifecycle contradictions.
