---
slug: pi-native-status-surface
title: Pi-Native Status Surface
category: product
tldr: Workspace visibility includes `dadaia-pi status` and a loopback browser panel served by `dadaia-pi panel` at http://127.0.0.1:4999/.
summary: Records the current visibility surfaces. `dadaia-pi status` gives Python CLI visibility, `/dadaia-status` gives Pi extension status through the Python bridge, and `dadaia-pi panel` starts a local loopback browser server backed by Python APIs. The panel is read-only, loopback-only, and intentionally does not expose remote bind or mutation endpoints.
tags:
  - status
  - panel
  - tui
  - visibility
agent_tier: self-pull
token_estimate: 260
last_updated: "2026-06-23"
release_origin: python-cli-core-migration-v1
---

## Current truth

`dadaia-pi-workspace` now has two concrete visibility surfaces:

- `dadaia-pi status` for non-interactive CLI visibility;
- `dadaia-pi panel` for a local browser dashboard at `http://127.0.0.1:4999/`.

The panel is intentionally read-only and loopback-only. Its backend/API is Python-owned. It serves `/`, `/health`, `/api/panel-status`, `/api/status`, `/api/contexts`, `/api/memory`, `/api/handoffs`, `/api/workflows`, `/api/workflow-definitions`, and `/api/reports`.

## Capabilities to preserve

- context registry visibility;
- active session binding and mode/release status;
- task/release state summary;
- report and handoff discovery;
- memory/catalog navigation;
- workflow guidance for definition, implementation, review, and closure.

## Panel boundary

The browser panel is not a full port of every historical `dadaia-workspace` tab. It preserves local-dashboard behavior and high-value read-only data: workspace health, contexts, memory catalog, handoffs, workflows, reports, and raw status JSON.

The server binds only to `127.0.0.1`; `0.0.0.0` and other remote binds are rejected. It has no mutation endpoints. Browser JavaScript is frontend-only and must not own lifecycle policy.
