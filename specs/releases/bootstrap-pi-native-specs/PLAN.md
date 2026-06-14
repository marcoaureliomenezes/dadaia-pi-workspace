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
   - make the package valid for `pi install` using package-root `extensions/`,
     `skills/`, `prompts/` or a `package.json` `pi` manifest;
   - declare Pi core imports as peer dependencies and non-Pi runtime dependencies
     as dependencies;
   - establish `src/core`, `src/features`, `src/infrastructure`, `src/pi`;
   - add CI-ready scripts.

2. **Spec scaffold and doctor**
   - scaffold `specs/` trees;
   - split validation into `doctor` for workspace/runtime state and `specs doctor`
     for committed SDD structure;
   - validate constitution, memory, releases, backlog, bugs, audits;
   - validate ACTIVE phase coherence, approval markers, task marker sanity,
     duplicate releases, audit naming, and memory/catalog consistency;
   - generate or validate `memory/product/catalog.json`.

3. **Context registry**
   - implement `.dadaia-pi/states/spec_contexts.json` with context name, repo
     slug, repo URL, branch, and ALIVE/DEAD state;
   - commands: create, list, show, update, alive, dead;
   - back-fill empty repo URLs from git origin when possible;
   - git clone/sync adapters.

4. **Session bind and memory injection**
   - extension commands: bind, release, status, using Pi's current
     `sessionManager.getSessionId()` as the canonical session key;
   - CLI fallback commands for automation where a Pi session id is supplied;
   - session metadata store plus bind-epoch marker and incumbent pointer;
   - Pi extension context injection using `session_start`, `before_agent_start`,
     `context`, and `session_shutdown` documented Pi events;
   - explicit trust bootstrap instructions for `.pi/settings.json`, local
     resources, and project-local package loading.

5. **Gate and lease**
   - path classifier;
   - phase/mode rules;
   - mutating lease acquire/renew/reclaim/yield;
   - READ mode active-tool restriction with gate backstop;
   - Pi `tool_call` blocker for write-like tools;
   - Pi `user_bash` interceptor for user-entered shell commands;
   - heartbeat via Pi tool/session events and by-session lease index;
   - require `withFileMutationQueue()` for any custom mutating tool.

6. **Git chokepoints**
   - pre-commit lease/task checks;
   - pre-push evidence checks;
   - install/uninstall hook commands.

7. **Pi package resources**
   - package-root `extensions/` entrypoints or manifest-declared extension paths;
   - package-root `skills/` for spec definition, implementation, review, closure;
   - package-root `prompts/` for repeatable commands;
   - generated consumer `.pi/settings.json` only when installing project-locally;
   - package manifest with `pi-package` keyword and `pi` resource declarations.

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
