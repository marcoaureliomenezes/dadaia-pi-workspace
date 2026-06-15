---
title: Pi-native status surface
status: shipped
opened: 2026-06-14
release: pi-browser-panel-v1
description: Design and implement a Pi-native workspace visibility surface for contexts, sessions, releases/tasks, reports/handoffs, memory navigation, and workflow status without copying the old browser/server panel blindly.
---

# Pi-native status surface

## Resolution

This backlog item is closed as `shipped`. The earlier CLI/TUI-only resolution was superseded after the operator explicitly required a `dadaia-workspace`-style local browser server.

Implemented across releases:

- `pi-native-status-command`: `dadaia-pi status` for context/session/release/task/evidence visibility.
- `handoff-cli-security-helper`: handoff list/validate/approval evidence helpers.
- `complete-status-surface-backlog`: memory catalog navigation and initial `/dadaia-panel` Pi extension status fallback.
- `pi-browser-panel-v1`: `dadaia-pi panel` loopback browser server and `/dadaia-panel` server launcher.

Current commands:

```bash
dadaia-pi status --session-id <id>
dadaia-pi panel
dadaia-pi panel --no-open
dadaia-pi memory list --context <name>
dadaia-pi memory show <slug> --context <name>
dadaia-pi handoff list --context <name>
```

Pi extension commands after package load:

```text
/dadaia-status
/dadaia-panel
```

## Browser panel decision

A local browser/server panel is now implemented as a loopback-only, read-only Node HTTP server. It binds to `127.0.0.1` by default at `http://127.0.0.1:4999/`, rejects remote bind addresses, and exposes no mutation endpoints.
