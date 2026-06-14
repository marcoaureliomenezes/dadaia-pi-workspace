---
title: Pi-native status surface
status: deferred
opened: 2026-06-14
description: Design and implement a Pi-native workspace visibility surface for contexts, sessions, releases/tasks, reports/handoffs, memory navigation, and workflow status without copying the old browser/server panel blindly.
---

# Pi-native status surface

## Need

Operators need fast visibility into workspace state. The old `dadaia-workspace`
panel showed useful concepts, but `dadaia-pi-workspace` should prefer CLI and Pi
TUI affordances before introducing a local web server.

## Candidate scope

Partially addressed by release `pi-native-status-command`, which adds `dadaia-pi status` for context/session/release/task and evidence counts.

Remaining deferred scope:

- richer memory catalog navigation;
- optional Pi TUI view;
- optional local panel only after security/process design.

## Deferred browser panel questions

- authentication and local access model;
- process lifecycle and cleanup;
- trust posture and executable package resources;
- why CLI/TUI is insufficient.
