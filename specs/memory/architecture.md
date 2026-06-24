---
slug: architecture
title: Architecture
category: core
tldr: "Python-first Pi-only SDD workspace: Python CLI/runtime authority, thin JS Pi adapter, browser frontend, specs memory, gates, hooks, workflows, and panel backend."
summary: "Defines the current architecture for dadaia-pi-workspace. The product remains Pi-only and SDD-native. Python now owns lifecycle/domain behavior; JavaScript/TypeScript is retained only for Pi extension adapter code and browser/front-end compatibility."
tags:
  - architecture
  - python
  - pi
  - sdd
  - context
agent_tier: self-pull
token_estimate: 950
last_updated: "2026-06-23"
release_origin: python-cli-core-migration-v1
---

## Visão geral

`dadaia-pi-workspace` is a Python-first, Pi-native SDD workspace manager.

The architecture has four rings:

1. **Python CLI/runtime ring**: canonical `dadaia-pi` lifecycle commands for workspace initialization, context lifecycle, specs scaffold/doctor, memory navigation, gates, leases, hooks, workflows, status, and the panel backend.
2. **Python domain ring**: pure Python services for Spec Context Projects, SDD artifacts, path classification, leases, sessions, memory cataloging, workflow evidence, and Pi RPC/headless orchestration.
3. **Infrastructure ring**: filesystem, git, JSON stores, process probes, HTTP loopback server, and package installation adapters implemented through Python standard library unless a release approves more dependencies.
4. **Pi/browser adapter ring**: Pi package resources plus a thin JavaScript extension adapter required by Pi's extension runtime, Markdown skills/prompts, and browser JavaScript/frontend code where the browser requires it.

The product must not contain Claude Code, Codex, or OpenCode projection logic. The source of truth is Pi plus normal local development tools. When workflows need model reasoning, Python calls Pi through RPC mode or headless print/json subprocess modes. Dry-run/offline execution records deterministic fallback evidence.

Distributed Pi packages use package-root resources (`extensions/`, `skills/`, `prompts/`) or a `package.json` `pi` manifest. The package must include `src/dadaia_pi/**` because the thin JS extension calls the Python bridge from the package root. Consumer `.pi/**` is the project-local runtime surface, not the package's canonical source layout.

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

Current source authority:

| Module | Responsibility |
|---|---|
| `src/dadaia_pi/cli.py` | Python CLI command parsing and dispatch |
| `src/dadaia_pi/context*.py` | context registry, ALIVE/DEAD, bind/release |
| `src/dadaia_pi/specs_*.py` | specs scaffold and doctor |
| `src/dadaia_pi/memory.py` | memory catalog navigation |
| `src/dadaia_pi/gate.py` | path classifier, policy decisions, leases, write-set checks |
| `src/dadaia_pi/hooks.py` | git hook install and pre-commit/pre-push checks |
| `src/dadaia_pi/workflows.py` | workflow catalog, run manifests, reports, dry-run fallback |
| `src/dadaia_pi/pi_rpc.py` | Pi RPC JSONL client and headless subprocess runner |
| `src/dadaia_pi/bridge.py` | JSON bridge used by the Pi extension adapter |
| `src/dadaia_pi/panel.py` | read-only loopback panel backend/API |
| `extensions/dadaia-pi.ts` | thin Pi event/slash-command adapter that delegates lifecycle decisions to Python |
| Browser JavaScript | frontend-only rendering; no lifecycle policy authority |

Do not add new lifecycle policy to TypeScript. New scaffold, context, specs, memory, gate, hook, workflow, handoff, status, and panel-backend behavior belongs in Python and should be exposed to JS only through the documented bridge or CLI subprocess calls. The npm `dadaia-pi` bin is a Node compatibility shim that delegates to `python3 -m dadaia_pi`; TypeScript lifecycle trees are legacy/non-authoritative and carry `LEGACY.md` markers.

## Contratos entre módulos

Pi integration is a packageable resource set:

- extension registers commands such as `/dadaia-bind`, `/dadaia-status`, `/dadaia-workflow-status`, `/dadaia-panel`, and `/dadaia-release`;
- extension receives `session_start`, `before_agent_start`, `tool_call`, and `user_bash` events;
- extension serializes event data to `python3 -m dadaia_pi pi-bridge <operation>` and applies the Python decision;
- extension does not duplicate lifecycle policy beyond request/response adaptation;
- skills teach product-steward, implementation, review, and closure workflows;
- prompt templates provide repeatable release/spec/review prompts;
- project settings may install the package project-locally after trust.

Pi sessions are tree-structured JSONL files stored by Pi outside the workspace by default. The canonical binding key is Pi's `sessionManager.getSessionId()`. If a session is ephemeral and has no stable Pi session id, mutating bind must either be refused or explicitly recorded with an ephemeral key that cannot outlive the process. The product stores only the minimal session metadata needed for context binding, leases, and evidence.

## Fluxo de dados — gate SDD

The Python gate classifies context-relative paths:

| Class | Paths | Decision |
|---|---|---|
| ADDITIVE | `specs/backlog/**`, `specs/bugs/**`, `specs/audits/**`, `.dadaia-pi/reports/**`, `.dadaia-pi/handoff/**`, `.dadaia-pi/tmp/**` | allow without lease |
| MEMORY | `specs/memory/**` | allow only during definition or closure |
| FROZEN | `specs/_archive/**` | block |
| PROTECTED | `.dadaia-pi/sessions/**`, `.dadaia-pi/states/**` direct agent writes | block unless CLI-owned |
| MUTATING | production source, tests, `specs/releases/**`, repo paths not otherwise classified | require active release and mutating lease |

Pi extension gating covers Pi tool calls and user bash commands by calling the Python bridge. READ mode should first restrict active tools with `pi.setActiveTools(["read", "grep", "find", "ls", "bash"])`, then still rely on the Python gate because tool configuration is not a security boundary and Bash can mutate files. Git hooks cover commit and push boundaries. Doctor commands provide post-hoc state validation.

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
| `workflows/<context>/...` | workflow manifests |
| `logs/*.jsonl` | audit/debug logs |
