---
slug: tech-stack
title: Tech Stack
category: core
tldr: Python is the lifecycle/runtime authority; JavaScript/TypeScript is retained only for Pi extension adapters and browser/frontend surfaces.
summary: Records the current approved stack for dadaia-pi-workspace. Pi is the only supported harness. Python owns CLI/domain/workflow/panel-backend behavior, while JS/TS remains necessary for Pi package extensions and browser code.
tags:
  - tech-stack
  - python
  - pi
  - node
agent_tier: inject
token_estimate: 520
last_updated: "2026-06-23"
release_origin: python-cli-core-migration-v1
---

## Linguagens

| Language | Version | Use |
|---|---|---|
| Python | 3.10+ | Primary CLI/runtime, domain services, gates, leases, hooks, workflows, Pi RPC/headless runner, panel backend |
| TypeScript | 5.x | Pi extension adapter and compatibility/typecheck surface only |
| JavaScript | Node-compatible output/browser | Published Pi extension adapter and browser/frontend code |
| Markdown | CommonMark | Specs, memory, skills, prompt templates, AGENTS.md |
| JSON | JSON Schema-compatible | workspace state, package metadata, catalogs, bridge payloads, workflow manifests |
| Shell | POSIX sh only when needed | small git hook wrappers only |

## Runtimes e ferramentas

| Tool | Version | Function |
|---|---|---|
| Python | 3.10+ | primary product runtime |
| pytest | 8+ | Python test runner |
| Node.js | 20+ | Pi extension/package adapter build and browser compatibility |
| npm | current stable | Pi package install compatibility and TypeScript adapter checks |
| Pi Coding Agent | latest documented package `@earendil-works/pi-coding-agent` | only supported agent harness |
| git | 2.x | context clone/sync and git chokepoints |
| TypeScript compiler | 5.x | adapter type checking |
| Node test runner | current | legacy/adapter test coverage while migration parity is maintained |

## Dependências aprovadas

Default implementation should prefer the Python standard library and Node standard library. Current approved runtime posture:

- Python standard library for CLI, filesystem, JSON, subprocess, HTTP loopback server, and Pi RPC/headless process control;
- `pytest` as Python test dependency;
- `@earendil-works/pi-coding-agent` only where Pi extension/package APIs require it;
- `typebox`, `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, and `@earendil-works/pi-tui` only when Pi adapter code requires them.

Pi core packages imported by extensions or package resources must be declared as `peerDependencies` with a broad compatible range instead of bundled. Runtime third-party dependencies that are not Pi core packages belong in `dependencies` only after an approved release explains why the standard library is insufficient.

## Comandos canônicos

Python runtime checks:

```bash
PYTHONPATH=src python3 -m dadaia_pi --version
PYTHONPATH=src python3 -m dadaia_pi status --json
PYTHONPATH=src python3 -m dadaia_pi specs doctor --specs-dir specs --json
python3 -m pytest tests_py
```

Pi adapter/compatibility checks:

```bash
npm install
npm run typecheck
npm run check:python
```

The package layout must remain valid as a Pi package: package-root `extensions/`, `skills/`, `prompts/`, and optional `themes/`, or equivalent `package.json` `pi` manifest entries. Consumer `.pi/**` files are generated or installed workspace state, not the canonical package source.

## Restrições e proibições

- Do not add Claude Code, Codex, or OpenCode runtime assets.
- Do not create `.dadaia/`; this product uses `.dadaia-pi/`.
- Do not put operational state in managed repos.
- Do not represent Pi project trust as a sandbox.
- Do not document Pi package resources as inert content; package extensions, hooks, and project-local `.pi/**` resources are executable-code risk.
- Do not commit secrets, provider API keys, local session files, or machine-local Pi credentials.
- Do not add new lifecycle policy in TypeScript; lifecycle policy belongs in Python.
- Do not rely on active-tool selection as a security boundary; it is a first layer only and must be backed by Python gate checks.
