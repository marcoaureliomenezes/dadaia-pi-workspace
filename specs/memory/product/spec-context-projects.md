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

A Spec Context Project is a repo plus its canonical `specs/` tree. Pi sessions
bind to a context before doing focused work, and the extension injects that
context's law and memory.

## Fluxo de uso

1. `create`: register context name, repo slug, and URL.
2. `alive`: clone or restore the repo under `repos/<slug>/`.
3. `bind`: attach the current Pi session to the context and mode.
4. `release`: clear the active mutating lease/session binding.
5. `dead`: sync and remove the repo from disk while retaining registry metadata.

## Estado runtime tocado

- `.dadaia-pi/states/spec_contexts.json`;
- `.dadaia-pi/sessions/<session>.json`;
- `.dadaia-pi/states/ctx_locks/<context>.json`;
- `repos/<slug>/specs/**`.
