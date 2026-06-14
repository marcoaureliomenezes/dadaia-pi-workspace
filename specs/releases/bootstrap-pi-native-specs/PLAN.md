---
release: bootstrap-pi-native-specs
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# PLAN - bootstrap-pi-native-specs

**Status:** Aprovado

## Architecture Direction

Build a TypeScript package that exposes:

- a CLI for workspace/context/spec lifecycle operations;
- a Pi package containing extensions, skills, and prompt templates;
- git hook entrypoints for commit and push boundaries;
- doctor commands for structural and state checks.

## Implementation Slices

1. **Project foundation**
   - create `package.json`, TypeScript config, test config, lint/format config;
   - establish `src/core`, `src/features`, `src/infrastructure`, `src/pi`;
   - add CI-ready scripts.

2. **Spec scaffold and doctor**
   - scaffold `specs/` trees;
   - validate constitution, memory, releases, backlog, bugs, audits;
   - generate or validate `memory/product/catalog.json`.

3. **Context registry**
   - implement `.dadaia-pi/states/spec_contexts.json`;
   - commands: create, list, show, alive, dead;
   - git clone/sync adapters.

4. **Session bind and memory injection**
   - commands: bind, release, status;
   - session metadata store;
   - Pi extension context injection using documented Pi events.

5. **Gate and lease**
   - path classifier;
   - phase/mode rules;
   - mutating lease acquire/renew/reclaim/yield;
   - Pi `tool_call` blocker for write-like tools.

6. **Git chokepoints**
   - pre-commit lease/task checks;
   - pre-push evidence checks;
   - install/uninstall hook commands.

7. **Pi package resources**
   - `.pi/extensions` package entry;
   - `.pi/skills` for spec definition, implementation, review, closure;
   - `.pi/prompts` for repeatable commands;
   - package manifest.

## Validation

- unit tests for pure rules and state transitions;
- integration tests in temp workspaces;
- manual Pi smoke test until automated Pi event tests exist;
- `npm run build`, `npm test`, `npm run lint`, `npm run typecheck`.

## Deferred

- panel/dashboard;
- telemetry beyond minimal logs;
- package gallery metadata;
- advanced TUI components;
- import/export from existing `dadaia-workspace`.
