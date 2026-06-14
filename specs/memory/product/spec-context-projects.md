---
slug: spec-context-projects
title: Spec Context Projects
category: product
tldr: One canonical specs tree bound to one repository, session-bindable for Pi.
summary: "Defines the central unit of work in dadaia-pi-workspace: a repository governed by a committed specs tree and a workspace registry record."
tags:
  - context
  - specs
  - memory
agent_tier: self-pull
token_estimate: 135
last_updated: "2026-06-14"
release_origin: bootstrap-pi-native-specs
---

## Propósito

A Spec Context Project is a repo plus its canonical `specs/` tree. The registry
stores the context name, repo slug, repo URL, branch, and ALIVE/DEAD state so a
workspace can be exported, restored, and recloned without re-deriving remotes. Pi
sessions bind to a context before doing focused work, and the extension injects
that context's law and memory.

## Fluxo de uso

1. `create`: register context name, repo slug, branch, and optional URL.
2. `alive`: clone or restore the repo under `repos/<slug>/`; if URL is absent,
   back-fill it from `git remote get-url origin` when possible.
3. `update`: repair registry fields such as `repo_url` without recloning.
4. `bind`: attach the current Pi session id to the context, mode, and optional release;
   write a bind marker so the extension reinjects context on the next prompt.
5. `release`: clear the active mutating lease/session binding without releasing a
   live foreign holder.
6. `dead`: sync and remove the repo from disk while retaining registry metadata.

## Estado runtime tocado

- `.dadaia-pi/states/spec_contexts.json`;
- `.dadaia-pi/states/bind_epoch/<context>`;
- `.dadaia-pi/sessions/<pi-session-id>.json`;
- `.dadaia-pi/sessions/runtime/<context>.ptr`;
- `.dadaia-pi/states/ctx_locks/<context>.json`;
- `.dadaia-pi/states/ctx_locks/by-session/<pi-session-id>.json`;
- `repos/<slug>/specs/**`.
