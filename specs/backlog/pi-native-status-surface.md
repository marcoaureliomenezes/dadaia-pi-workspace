---
title: Pi-native status surface
status: rejected
opened: 2026-06-14
release: complete-status-surface-backlog
description: Design and implement a Pi-native workspace visibility surface for contexts, sessions, releases/tasks, reports/handoffs, memory navigation, and workflow status without copying the old browser/server panel blindly.
---

# Pi-native status surface

## Resolution

This backlog item is closed as `rejected` because it is no longer a pending backlog candidate: the useful Pi-native parts have been implemented and the browser/server panel portion is intentionally rejected for now.

Implemented across releases:

- `pi-native-status-command`: `dadaia-pi status` for context/session/release/task/evidence visibility.
- `handoff-cli-security-helper`: handoff list/validate/approval evidence helpers.
- `complete-status-surface-backlog`: memory catalog navigation and `/dadaia-panel` Pi extension status panel fallback.

Current commands:

```bash
dadaia-pi status --session-id <id>
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

A local browser/server panel remains rejected for the current product state. It would add authentication, local access, process lifecycle, and executable-code trust risk that CLI/TUI surfaces do not require. A future operator may open a new backlog item with a dedicated security/process design if a browser panel becomes necessary.
