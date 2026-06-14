---
release: complete-status-surface-backlog
status: Aprovado
owner: product-engineer
created: 2026-06-14
backlog:
  - pi-native-status-surface
---

# SPEC - complete-status-surface-backlog

**Status:** Aprovado

## Problem

The remaining backlog for `pi-native-status-surface` asks for richer memory catalog navigation, optional Pi TUI visibility, and a decision about a local browser panel.

## Goal

Complete the backlog item with Pi-native surfaces only:

- add read-only memory catalog/navigation CLI commands;
- add a lightweight Pi extension status panel command using Pi TUI custom UI when available;
- explicitly reject a local browser/server panel for now because CLI/TUI covers current needs without adding auth/process risk.

## Requirements

- `dadaia-pi memory list [--context <name>] [--json]` lists memory product catalog entries.
- `dadaia-pi memory show <slug> [--context <name>] [--json]` displays one memory atom.
- Pi extension registers `/dadaia-panel` as a read-only status panel/overlay when `ctx.ui.custom` is available, falling back to notification.
- Backlog item records CLI/TUI completion and browser panel rejection/defer rationale.

## Non-Goals

- No local web server.
- No daemon.
- No authentication surface.
- No mutation of memory or runtime state.
