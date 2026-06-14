---
slug: pi-native-status-surface
title: Pi-Native Status Surface
category: product
tldr: Workspace visibility starts with `dadaia-pi status`; a richer panel or TUI is deferred until security and process lifecycle are specified.
summary: Records the current decision on porting the old dadaia-workspace panel. The useful capabilities are contexts, sessions, reports, tasks/kanban, memory, and workflows. The first implemented Pi-native surface is a read-only CLI status command; dadaia-pi-workspace will not copy the browser/server panel without a Pi-native design.
tags:
  - status
  - panel
  - tui
  - visibility
agent_tier: self-pull
token_estimate: 220
last_updated: "2026-06-14"
release_origin: port-dadaia-workspace-core
---

## Current truth

`dadaia-workspace` panel capabilities are useful as product signals, but the old
server/browser implementation is not part of the Pi-native foundation. The first
Pi-native visibility surface is `dadaia-pi status`, supported by doctor commands
and package skills.

## Capabilities to preserve

- context registry visibility;
- active session binding and mode/release status;
- task/release state summary;
- report and handoff discovery;
- memory/catalog navigation;
- workflow guidance for definition, implementation, review, and closure.

## Deferred surface

A future release may implement a Pi-native status surface as one of:

1. richer CLI summary commands;
2. Pi TUI extension affordances;
3. a minimal local panel only after auth, process lifecycle, and trust posture are
   specified.

No browser/server panel is allowed by default. Adding one requires a dedicated
SPEC that explains why CLI/TUI is insufficient and how executable-code and local
process risks are handled.
