---
release: port-dadaia-workspace-core
status: Aprovado
owner: product-engineer
created: 2026-06-14
source_contexts:
  - dadaia-workspace
---

# SPEC - port-dadaia-workspace-core

**Status:** Aprovado

## Problem

`dadaia-pi-workspace` has a Pi-native foundation, but its operating skills are still thin compared with the mature lifecycle protocols in `dadaia-workspace`. We need to bring forward the useful core ideas — Spec Context navigation, release definition discipline, task reservation, handoffs, doctor/drift guidance, and panel/workspace visibility — without reviving the old multi-harness projection model for Claude Code, Codex, or OpenCode.

## Intent

Use the newly registered `dadaia-workspace` Spec Context Project as a read-only source context for research and selective porting. The target product remains a specialized Pi-only workspace. Port behavior conceptually, not mechanically: adapt protocols to Pi extensions, Pi skills, Pi prompts, `.dadaia-pi/**` state, and the TypeScript/Node codebase.

## Source Material

Primary source context:

- `repos/dadaia-workspace/dadaia_workspace/public/skills/**`
- `repos/dadaia-workspace/dadaia_workspace/features/panel/**`
- `repos/dadaia-workspace/specs/constitution.md`
- `repos/dadaia-workspace/specs/memory/**`
- `repos/dadaia-workspace/specs/bugs/**` for known failures and anti-patterns to avoid

Initial research evidence:

- `.dadaia-pi/reports/dadaia-pi-workspace/research/20260614T200631Z-dadaia-workspace-import.md`

## Product Requirements

### PR-1: Core SDD skills become operational, not placeholder

The Pi package must include detailed skills for agents operating inside `dadaia-pi-workspace`:

- Spec Context navigation and memory bootstrap;
- release definition;
- task reservation and lifecycle discipline;
- implementation protocol;
- review protocol;
- release closure;
- handoff emission;
- workspace doctor/drift checks.

Acceptance:

- each skill states when to use it, required inputs, ordered procedure, stop conditions, and output artifacts;
- skill instructions use `.dadaia-pi/**`, Pi session binding, and current `specs/releases/**` layout;
- no skill instructs use of Claude Code, Codex, OpenCode, old projections, `.claude`, `.codex`, `.opencode`, or `.dadaia/**` as runtime state.

### PR-2: Lifecycle governance is made concrete

Agents must have concrete procedures for moving through Definition → Implementation → Review → Closure.

Acceptance:

- task marker protocol `[ ] -> [-] -> [x]` is documented for Pi workflows;
- implementation work requires approved `SPEC.md`, `PLAN.md`, `TASKS.md`, and a reserved task;
- review and closure outputs use `.dadaia-pi/reports/**`, `.dadaia-pi/handoff/**`, and `specs/audits/**` consistently;
- stop conditions are explicit when approvals, task reservation, release binding, or write-set coverage are missing.

### PR-3: Handoff and evidence contracts are ported

`dadaia-pi-workspace` needs machine-readable handoffs and human reports as first-class lifecycle artifacts.

Acceptance:

- define a Pi-native handoff JSON contract or documented minimal schema under the product source/specs;
- provide a skill that emits handoffs under `.dadaia-pi/handoff/<context>/`;
- provide validation or doctor coverage for handoff/report location and basic schema integrity.

### PR-4: Panel concept is evaluated for Pi-native fit

`dadaia-workspace` has a panel. We need a Pi-native decision: port, simplify, defer, or replace with CLI/TUI/status surfaces.

Acceptance:

- research `dadaia_workspace/features/panel/**` and document which capabilities matter: contexts, sessions, reports, kanban/tasks, memory, workflows;
- decide whether this release implements a minimal panel/status surface or only creates a future backlog item;
- no browser/server surface is added unless the plan explains security, auth, process lifecycle, and why CLI/TUI is insufficient.

### PR-5: Source-context import remains read-only and auditable

`dadaia-workspace` is a reference context, not a dependency to execute.

Acceptance:

- workspace context registry contains `dadaia-workspace` as ALIVE for research;
- ported behavior includes source notes in reports or docs;
- no runtime dependency on the old Python package is introduced.

## Non-Goals

- Reintroducing multi-harness projection.
- Supporting Claude Code, Codex, or OpenCode runtime files.
- Copying Python implementation wholesale.
- Shipping a web panel without a specific security/process design.
- Migrating all `dadaia-workspace` features blindly.

## Open Questions

1. Should the Pi-native visibility surface be CLI-only, Pi TUI extension, or a minimal local web panel?
2. How strict should handoff schema validation be in the first Pi-only iteration?
3. Which `dadaia-workspace` bugs represent lessons to encode as tests or stop conditions?
