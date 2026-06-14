---
release: pi-native-status-command
status: Aprovado
owner: product-engineer
created: 2026-06-14
backlog:
  - pi-native-status-surface
---

# SPEC - pi-native-status-command

**Status:** Aprovado

## Problem

After importing core lifecycle skills and deferring the old `dadaia-workspace` browser panel, operators still need a fast Pi-native way to see workspace state. Today the information exists across `doctor`, `context list`, `context status`, release files, task markers, handoffs, and reports, but there is no single status command that summarizes the active workspace.

## Goal

Add a minimal CLI status surface that gives operators and Pi sessions a safe, read-only overview of:

- workspace health;
- registered Spec Context Projects;
- current or requested session binding;
- active release and phase for a context;
- task marker summary;
- recent handoff/report counts where cheap to compute.

This is the first Pi-native replacement for the old panel's visibility role. It must remain CLI/read-only and must not introduce a web server, browser panel, daemon, or long-lived process.

## Product Requirements

### PR-1: Read-only status command

The CLI exposes a status command.

Acceptance:

- `dadaia-pi status [--session-id <id>] [--context <name>] [--json]` exists;
- command does not mutate workspace state;
- text output is concise and operator-readable;
- JSON output is stable enough for tests and future Pi extension/TUI use.

### PR-2: Workspace and context summary

The command summarizes workspace and context state.

Acceptance:

- includes workspace root and doctor summary counts;
- includes registered contexts with name, state, repo slug, branch, and URL when present;
- if `--context` is supplied, includes active release information for that context when its specs tree exists;
- if no context is supplied but `--session-id` is bound, uses the bound context.

### PR-3: Session binding summary

The command reports binding when a session id is supplied.

Acceptance:

- includes bound context, mode, release, boundAt, and lastSeenAt;
- missing binding is reported without failure in text mode;
- JSON distinguishes missing binding from command error.

### PR-4: Release/task summary

The command reads release state without enforcing implementation gates.

Acceptance:

- reads `specs/releases/ACTIVE.md` for the resolved context;
- reports release id, phase, and artifact statuses when files are present;
- summarizes task counts by `[ ]`, `[-]`, and `[x]` from active `TASKS.md`;
- handles missing specs/release files gracefully.

### PR-5: Evidence summary

The command surfaces basic evidence counts.

Acceptance:

- reports count of handoff JSON files under `.dadaia-pi/handoff/<context>/`;
- reports count of report files under `.dadaia-pi/reports/<context>/` recursively or with documented shallow behavior;
- does not parse or validate all evidence; validation remains doctor/review responsibility.

## Non-Goals

- No web panel.
- No Pi TUI implementation in this release.
- No daemon, watcher, or background process.
- No mutation of binding, lease, report, or release state.
- No replacement for `doctor`; status may call/read doctor summary but does not perform deep remediation.

## Source References

- `specs/memory/product/pi-native-status-surface.md`
- `specs/backlog/pi-native-status-surface.md`
- `repos/dadaia-workspace/dadaia_workspace/features/panel/views/index.py`
- `repos/dadaia-workspace/dadaia_workspace/features/panel/views/sessions.py`
- `repos/dadaia-workspace/dadaia_workspace/features/panel/views/kanban.py`
- `repos/dadaia-workspace/dadaia_workspace/features/panel/views/reports.py`
