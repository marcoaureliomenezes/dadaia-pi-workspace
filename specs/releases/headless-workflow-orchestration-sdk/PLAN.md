---
release: headless-workflow-orchestration-sdk
status: approved
---

# PLAN - headless-workflow-orchestration-sdk

**Status:** Aprovado

1. Add workflow domain types and catalog for lifecycle workflows.
2. Add Pi SDK adapter abstraction that can invoke Pi SDK in real runs and deterministic dry-run fallback in tests/offline flows.
3. Add workflow runner that resolves context/release scope, executes deterministic preflight/postflight metadata, invokes the bounded SDK step, and emits manifest/report evidence.
4. Add CLI workflow commands for list/show/run.
5. Add tests for catalog, runner, and CLI JSON behavior.
6. Update README and memory with the new architecture and context-management model.
7. Record final report and closure evidence.

## Risks and controls

- Risk: SDK availability differs across environments. Control: optional dynamic import plus deterministic dry-run/fallback.
- Risk: workflow definitions imply complete automation. Control: this release creates the orchestration layer and additive evidence; production mutations remain gated by existing SDD/task mechanisms.
- Risk: hidden context slop. Control: every run requires explicit context and writes scoped artifacts under that context.
