---
release: pi-native-status-command
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# PLAN - pi-native-status-command

**Status:** Aprovado

## Architecture Direction

Implement status as a read-only TypeScript service plus CLI command. Reuse existing services where possible:

- `ContextService` for context registry;
- `SessionBindingService` for optional session binding;
- `runWorkspaceDoctor` for doctor summary;
- direct small parsers for `ACTIVE.md`, release artifact statuses, and task markers;
- filesystem counting for handoffs/reports.

Keep the output model plain JSON so future Pi extension/TUI surfaces can reuse it.

## Implementation Slices

1. **Status domain/service**
   - add a status report type and service under `src/features/status/**`;
   - collect workspace root, doctor summary, contexts, optional session binding, optional context detail, release summary, task counts, and evidence counts;
   - ensure missing optional files produce warnings/undefined fields, not crashes.

2. **CLI command**
   - add `dadaia-pi status [--session-id <id>] [--context <name>] [--json]`;
   - text output should show workspace, doctor summary, contexts, binding, release, tasks, and evidence counts;
   - JSON output should serialize the status report.

3. **Tests**
   - unit/integration tests using temp workspaces;
   - cover uninitialized workspace, context registry, bound session, release/task parsing, evidence counts, and JSON CLI output.

4. **Docs and memory**
   - update README useful commands;
   - update `pi-native-status-surface` memory to name `dadaia-pi status` as the first visibility surface;
   - close backlog item or mark it as partially addressed/deferred if broader TUI/panel remains open.

## Validation

```bash
npm test
npm run build
node dist/src/cli/main.js specs doctor
node dist/src/cli/main.js doctor
```

## Risks

- Status command accidentally becomes another doctor with duplicated rules.
- JSON shape becomes too broad before consumers exist.
- Parsing release files too strictly could make status brittle.

## Risk Controls

- Status summarizes; doctor validates.
- Keep JSON shallow and typed.
- Treat missing/malformed release artifacts as warnings in status, not fatal errors unless the workspace itself cannot be read.
