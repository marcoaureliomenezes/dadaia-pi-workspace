# PLAN - workflow-engine-enforcement-v1

**Status:** Aprovado

## Approach

1. Extend workflow types/catalog with orchestration metadata and new canonical workflow names.
2. Add Python module runner invoked by TypeScript workflow runner for orchestrated workflows.
3. Create Python procedural modules with deterministic step graphs and bounded Pi SDK prompt descriptors.
4. Add workflow evidence enforcement to pre-commit for mutating commits.
5. Improve panel Workflows tab to show catalog definitions and current state.
6. Update tests and package files.

## Non-goals

- No Claude/Codex/OpenCode runtime projections.
- No unbounded autonomous loops.
- No replacing markdown specs or memory storage.
