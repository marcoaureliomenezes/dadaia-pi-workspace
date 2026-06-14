---
name: dadaia-spec-definition
description: Define or refine a dadaia-pi-workspace SDD release by turning operator intent, bugs, backlog, and source-context research into SPEC, PLAN, and TASKS.
---

# Dadaia Spec Definition

Use before implementation, when opening or refining a release.

## Inputs

- Operator intent and constraints.
- `specs/bugs/**` and `specs/backlog/**` when relevant.
- Current memory under `specs/memory/**`.
- Source-context research reports under `.dadaia-pi/reports/<context>/research/` when the release ports ideas from another context.

## Procedure

1. Load context with `dadaia-spec-navigator`.
2. Sanitize inputs:
   - identify stale bugs/backlog;
   - mark invalid assumptions in the release notes or a report;
   - never silently delete evidence.
3. Define scope:
   - list what is in scope;
   - list non-goals explicitly;
   - cite source contexts when used.
4. Write `SPEC.md` as product behavior and acceptance criteria, not implementation detail.
5. Write `PLAN.md` as implementation slices, validation, risks, and controls.
6. Write `TASKS.md` with concrete write sets and acceptance criteria.
7. Keep status `Draft` until the operator approves.
8. After approval, set all three artifacts to `Aprovado` and move `ACTIVE.md` to the intended phase.

## Quality Bar

- Every production task has a bounded write set.
- Every acceptance criterion is testable or reviewable.
- New dependencies or surfaces include security posture.
- Pi trust is described honestly as code-loading approval, not isolation.
- Memory updates are planned only for definition or closure work.

## Stop Conditions

- Scope requires behavior not authorized by constitution or memory.
- The release would duplicate product truth in multiple places.
- A task write set is too broad to review.
- Operator approval is missing but implementation is requested.
