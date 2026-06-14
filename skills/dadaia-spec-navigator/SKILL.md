---
name: dadaia-spec-navigator
description: Load the active dadaia-pi-workspace context, memory, and release artifacts in canonical order before planning, implementation, review, or closure.
---

# Dadaia Spec Navigator

Use this skill at the start of any non-trivial workspace task.

## Inputs

- Workspace root, normally the directory containing `.dadaia-pi/` and `repos/`.
- Active Pi session id when available.
- Optional operator-selected context name.

## Procedure

1. Resolve context:
   - prefer the session binding in `.dadaia-pi/sessions/<session-id>.json`;
   - otherwise use the operator-provided context;
   - otherwise inspect `.dadaia-pi/states/spec_contexts.json` and ask before choosing among multiple ALIVE contexts.
2. Resolve specs directory:
   - ALIVE context: `repos/<repoSlug>/specs/`;
   - product repository itself: local `specs/`.
3. Read in order:
   - `AGENTS.md` at workspace and repo scope when present;
   - `specs/constitution.md`;
   - `specs/memory/architecture.md`;
   - `specs/memory/tech-stack.md`;
   - `specs/memory/product/catalog.json`;
   - `specs/memory/product/index.md`;
   - 1-3 specific product memory atoms relevant to the task.
4. Resolve release:
   - read `specs/releases/ACTIVE.md`;
   - if `release: none` or missing, stop before production edits;
   - load `SPEC.md`, `PLAN.md`, and `TASKS.md` for implementation work.
5. Verify approval before implementation:
   - each active artifact must contain `**Status:** Aprovado`;
   - a production task must be marked `[-]`;
   - every target file must be inside the task write set.

## Stop Conditions

- No context can be resolved.
- Active release is missing for production work.
- SPEC, PLAN, or TASKS is not approved.
- More than one task is marked `[-]` in the same active `TASKS.md`.
- Requested write is outside the reserved task write set.
