# SPEC - workflow-engine-enforcement-v1

**Status:** Aprovado

## Problem

Workflow governance is currently too shallow: agents can still perform production edits manually while workflow manifests act mostly as evidence. The product must make CLI workflows the natural execution path and must show those workflows clearly in the panel.

## Scope

- Add explicit procedural workflow definitions for backlog definition, release definition, TDD release implementation, architecture review, security review, push gate, and closure.
- Add a Python workflow module execution path from the TypeScript CLI runner.
- Make orchestrated workflow manifests include the procedural steps returned by Python.
- Show workflow definitions and active state in the panel with readable phases/steps/gates.
- Strengthen mutation chokepoints so commits require workflow execution evidence in addition to lease/task write set.

## Acceptance Criteria

- `workflow list/show` expose the new workflow names and step plans.
- `workflow run release-implementation` invokes a Python module path and writes manifest/report evidence.
- The implementation workflow models TDD: tests first, test review, implementation, validation, review, commit gate for each task group.
- Pre-commit blocks mutating commits that lack approved implementation workflow evidence for the active release.
- Panel Workflows tab shows the workflow catalog as structured phases, procedural steps, gates, and current context state.
- Tests cover catalog, Python workflow execution, pre-commit enforcement, and panel display.
