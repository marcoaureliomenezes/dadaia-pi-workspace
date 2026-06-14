---
slug: architecture
title: Architecture
category: core
tldr: "Pi-only SDD workspace: TypeScript CLI, Pi package, Spec Context registry, tool-call gate, git hooks, and memory."
summary: "Defines the initial architecture for dadaia-pi-workspace. The product is a Pi-native workspace manager, not a multi-harness projection system. It preserves the Spec Context Project, memory, SDD lifecycle, and lease principles while using Pi extensions, skills, prompts, packages, sessions, and git chokepoints as the runtime surface."
tags:
  - architecture
  - pi
  - sdd
  - context
agent_tier: self-pull
token_estimate: 950
last_updated: "2026-06-14"
release_origin: bootstrap-pi-native-specs
---

## Visão geral

`dadaia-pi-workspace` is a Pi-native SDD workspace manager.

The architecture has four rings:

1. **CLI ring**: a TypeScript command-line surface for workspace initialization,
   context lifecycle, release scaffolding, doctor checks, and git hook install.
2. **Domain ring**: pure TypeScript services for Spec Context Projects, SDD
   artifacts, path classification, leases, sessions, and memory cataloging.
3. **Infrastructure ring**: filesystem, git, JSON stores, process probes, and
   package installation adapters.
4. **Pi ring**: Pi package resources plus project-local Pi resources: package
   `extensions/`, `skills/`, and `prompts/` directories; consumer `.pi/settings.json`;
   project-local `.pi/**` resources after trust; and AGENTS.md instructions.

The product must not contain Claude Code, Codex, or OpenCode projection logic.
The source of truth is Pi plus normal local development tools. Distributed Pi
packages use package-root resources (`extensions/`, `skills/`, `prompts/`) or a
`package.json` `pi` manifest; `.pi/**` is the consumer/project-local runtime
surface, not the package's canonical source layout.

## Camadas

Workspace root:

| Path | Purpose |
|---|---|
| `.dadaia-pi/` | operational state: contexts, sessions, locks, logs, reports, handoffs, temp |
| `.pi/` | Consumer project resources loaded after trust: settings, local extensions, skills, prompts, package installs |
| `repos/` | ALIVE context repositories |
| `AGENTS.md` | Pi-readable workspace rules, loaded regardless of project trust |

Managed context repo:

| Path | Purpose |
|---|---|
| `specs/constitution.md` | product law for that repo |
| `specs/memory/**` | current product truth |
| `specs/releases/**` | release definitions and closure |
| `specs/backlog/**` | additive intake |
| `specs/bugs/**` | additive bug records |
| `specs/audits/**` | committed review/audit evidence |

## Regras de dependência

Initial source layout:

| Module | Responsibility |
|---|---|
| `src/cli/` | command parsing only; no business rules |
| `src/core/` | pure types, path classes, lifecycle constants, errors |
| `src/features/context/` | context registry, ALIVE/DEAD, bind/release |
| `src/features/specs/` | scaffold, doctor, release/backlog/bug helpers |
| `src/features/gate/` | path classifier, phase checks, lease decisions |
| `src/features/memory/` | memory catalog generation and validation |
| `src/infrastructure/` | filesystem, git, JSON stores, process and hook adapters |
| `src/pi/` | Pi extension/package integration code |

Dependency direction is CLI -> features -> core, and infrastructure implements
ports consumed by features. Core never imports CLI, features, infrastructure, or
Pi APIs.

## Contratos entre módulos

Pi integration is a packageable resource set:

- extension registers commands such as `/dadaia-bind`, `/dadaia-status`, and
  `/dadaia-release`;
- extension injects context with `before_agent_start` and may prune stale
  injected context with the `context` event;
- extension restores binding/UI state on `session_start` and stops/reconciles on
  `session_shutdown`;
- extension intercepts `tool_call` and blocks write-like LLM tool calls that
  violate SDD policy;
- extension intercepts `user_bash` for user-entered `!` / `!!` shell commands,
  because those can mutate files outside LLM tool calls;
- extension uses `tool_result`, `tool_execution_end`, or turn/session events for
  heartbeat and advisory reconciliation;
- extension may use `resources_discover` to expose package skills and prompt
  templates dynamically when needed;
- skills teach product-steward, implementation, review, and closure workflows;
- prompt templates provide repeatable release/spec/review prompts;
- project settings may install the package project-locally after trust.

Pi sessions are tree-structured JSONL files stored by Pi outside the workspace by
default. The canonical binding key is Pi's `sessionManager.getSessionId()`. If a
session is ephemeral and has no stable Pi session id, mutating bind must either be
refused or explicitly recorded with an ephemeral key that cannot outlive the
process. The product stores only the minimal session metadata needed for context
binding, leases, and evidence.

## Fluxo de dados — gate v3 SDD (com RULE E e PostToolUse)

The gate classifies context-relative paths:

| Class | Paths | Decision |
|---|---|---|
| ADDITIVE | `specs/backlog/**`, `specs/bugs/**`, `specs/audits/**`, `.dadaia-pi/reports/**`, `.dadaia-pi/handoff/**`, `.dadaia-pi/tmp/**` | allow without lease |
| MEMORY | `specs/memory/**` | allow only during definition or closure |
| FROZEN | `specs/_archive/**` | block |
| PROTECTED | `.dadaia-pi/sessions/**`, `.dadaia-pi/states/**` direct agent writes | block unless CLI-owned |
| MUTATING | production source, tests, `specs/releases/**`, repo paths not otherwise classified | require active release and mutating lease |

Pi extension gating covers Pi tool calls and user bash commands. READ mode should
first restrict active tools with `pi.setActiveTools(["read", "grep", "find", "ls",
"bash"])`, then still rely on the gate because tool configuration is not a
security boundary and Bash can mutate files. Git hooks cover commit and push
boundaries. Doctor commands provide post-hoc state validation. Any custom Pi tool
that mutates files must wrap its read-modify-write window with Pi's
`withFileMutationQueue()` using the resolved absolute target path.

## Estado runtime

State files live under `.dadaia-pi/`:

| Path | Purpose |
|---|---|
| `states/spec_contexts.json` | context registry with name, slug, repo URL, branch, ALIVE/DEAD state |
| `states/bind_epoch/<context>` | bind marker used by the extension to know when to reinject context |
| `states/ctx_locks/<context>.json` | mutating lease |
| `states/ctx_locks/by-session/<session>.json` | heartbeat index for leases held by a Pi session |
| `sessions/<session>.json` | Pi session binding metadata keyed by Pi session id |
| `sessions/runtime/<context>.ptr` | incumbent pointer for context/session continuity |
| `reports/<context>/...` | human reports |
| `handoff/<context>/...` | machine handoffs |
| `logs/*.jsonl` | audit/debug logs |

All state stores need a doctor check and a cleanup story before they are
implemented.
