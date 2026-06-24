---
slug: dadaia-workspace-merge-readiness
title: Dadaia Workspace Merge Readiness
category: product
tldr: Pi support is prepared to merge into dadaia-workspace as a Python-owned `pi` harness adapter with JS/TS only for Pi extension resources.
summary: Records the current merge-prep posture after the Python migration. `dadaia-pi-workspace` should feed a future `dadaia-workspace` release that adds Pi as a harness target beside Claude Code, Codex, and OpenCode. Runtime policy should be ported into Python `dadaia_workspace` features; Pi JS/TS extension code should remain a thin adapter.
tags:
  - pi
  - merge
  - dadaia-workspace
  - harness
agent_tier: self-pull
token_estimate: 420
last_updated: "2026-06-23"
release_origin: dadaia-workspace-pi-merge-prep-v1
---

## Current truth

`dadaia-pi-workspace` is a Python-first Pi harness prototype and migration source for the broader `dadaia-workspace` product.

The intended merge shape is:

- Pi becomes a `pi` harness target inside `dadaia-workspace`, alongside Claude Code, Codex, and OpenCode.
- Python `dadaia_workspace/**` services own lifecycle policy, state, specs, memory, gates, hooks, workflows, reports, and panel APIs.
- Pi JavaScript/TypeScript remains only where Pi requires extension resources: slash commands, event handlers, context injection adapter, and tool/user-bash gate adapter.
- Pi RPC/headless execution is a Python subprocess integration, not a Python SDK.
- Pi trust remains code-loading approval, not sandboxing.

## Merge-prep artifacts

The current merge-prep evidence lives under `.dadaia-pi/reports/dadaia-pi-workspace/merge-prep/`:

- source-context research report;
- compatibility matrix and merge file map;
- Pi harness adapter contract.

Future implementation should happen in `dadaia-workspace`, not by expanding this repository back into a multi-harness product.
