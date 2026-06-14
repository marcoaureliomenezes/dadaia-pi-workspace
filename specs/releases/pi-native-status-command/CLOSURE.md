---
release: pi-native-status-command
status: Aprovado
closed: 2026-06-14
---

# CLOSURE - pi-native-status-command

**Status:** Aprovado

## Summary

Implemented the first Pi-native workspace visibility surface as a read-only CLI command:

```bash
dadaia-pi status [--session-id <id>] [--context <name>] [--json]
```

The command summarizes workspace doctor counts, registered contexts, optional session binding, active release/phase, task marker counts, and handoff/report counts.

## Completed Tasks

- [x] T-001 Status report service
- [x] T-002 CLI status command
- [x] T-003 Documentation and memory update

## Shipped Changes

- Added status service:
  - `src/features/status/statusService.ts`
  - `src/features/status/index.ts`
- Exported status API from `src/index.ts`.
- Added CLI command and help text in `src/cli/main.ts`.
- Added status tests in `tests/status.test.ts`.
- Updated README useful commands.
- Updated current-truth memory:
  - `specs/memory/product/pi-native-status-surface.md`
  - `specs/memory/product/catalog.json`
- Updated backlog item `specs/backlog/pi-native-status-surface.md` to mark CLI status as partially addressed and defer richer TUI/panel work.

## Validation

Commands run:

```bash
npm run build
npm test
node dist/src/cli/main.js specs doctor
node repos/dadaia-pi-workspace/dist/src/cli/main.js doctor
node repos/dadaia-pi-workspace/dist/src/cli/main.js status --session-id pi-agent-manual
```

Results:

- `npm run build`: pass
- `npm test`: pass, 38 tests, 11 suites, 0 failures
- `specs doctor`: pass
- workspace `doctor`: pass
- `status --session-id pi-agent-manual`: pass and prints current workspace summary

## Known Risks

- Status summarizes release/task/evidence state but does not replace doctor validation.
- JSON shape is intentionally shallow and may evolve before a Pi TUI consumes it.
- Rich memory browsing and panel/TUI visibility remain deferred backlog scope.
