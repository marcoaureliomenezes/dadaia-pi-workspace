---
slug: pi-native-status-surface
title: Pi-Native Status Surface
category: product
tldr: Workspace visibility includes `dadaia-pi status` and a loopback browser panel served by `dadaia-pi panel` at http://127.0.0.1:4999/.
summary: Records the current visibility surfaces. `dadaia-pi status` gives CLI visibility, `/dadaia-status` gives Pi extension status, and `dadaia-pi panel` starts a local loopback browser server with Overview, Contexts, Memory, Handoffs, and Raw API data. The panel is read-only, loopback-only, stdlib Node HTTP, and intentionally does not expose remote bind or mutation endpoints.
tags:
  - status
  - panel
  - tui
  - visibility
agent_tier: self-pull
token_estimate: 260
last_updated: "2026-06-15"
release_origin: pi-browser-panel-v1
---

## Current truth

`dadaia-pi-workspace` now has two concrete visibility surfaces:

- `dadaia-pi status` for non-interactive CLI visibility;
- `dadaia-pi panel` for a local browser dashboard at `http://127.0.0.1:4999/`.

The panel is intentionally read-only and loopback-only. It serves `/`, `/health`,
`/api/panel-status`, `/api/status`, `/api/contexts`, `/api/memory`, and
`/api/handoffs`.

## Capabilities to preserve

- context registry visibility;
- active session binding and mode/release status;
- task/release state summary;
- report and handoff discovery;
- memory/catalog navigation;
- workflow guidance for definition, implementation, review, and closure.

## Panel boundary

The browser panel is not a full port of every historical `dadaia-workspace` tab.
It preserves the local-dashboard behavior and the high-value read-only data:
workspace health, contexts, memory catalog, handoffs, and raw status JSON.

The server binds only to `127.0.0.1`; `0.0.0.0` and other remote binds are
rejected. It has no mutation endpoints.
