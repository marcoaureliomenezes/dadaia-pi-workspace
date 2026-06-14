---
slug: tech-stack
title: Tech Stack
category: core
tldr: TypeScript and Node.js product targeting Pi Coding Agent extensions, packages, skills, prompts, and CLI workflows.
summary: Records the initial approved stack for dadaia-pi-workspace. Pi is the only supported harness, so TypeScript and the Pi package surface are first-class. Extra dependencies require release approval.
tags:
  - tech-stack
  - typescript
  - pi
  - node
agent_tier: inject
token_estimate: 420
last_updated: "2026-06-14"
release_origin: bootstrap-pi-native-specs
---

## Linguagens

| Language | Version | Use |
|---|---|---|
| TypeScript | 5.x | CLI, domain services, Pi extensions, package code |
| JavaScript | Node-compatible output | Published runtime artifacts |
| Markdown | CommonMark | Specs, memory, skills, prompt templates, AGENTS.md |
| JSON | JSON Schema-compatible | workspace state, package metadata, catalogs |
| Shell | POSIX sh only when needed | small git hook wrappers only |

## Runtimes e ferramentas

| Tool | Version | Function |
|---|---|---|
| Node.js | 20+ | primary runtime |
| npm | current stable | package manager and Pi package install compatibility |
| Pi Coding Agent | latest documented package `@earendil-works/pi-coding-agent` | only supported agent harness |
| git | 2.x | context clone/sync and git chokepoints |
| TypeScript compiler | 5.x | type checking and build |
| Vitest or Node test runner | release-selected | automated tests |
| ESLint/Prettier or Biome | release-selected | lint and formatting |

## Dependências aprovadas

Initial implementation should start with:

- `@earendil-works/pi-coding-agent` for Pi extension/package APIs;
- `typebox` only where Pi tool schemas require it;
- Node standard library for filesystem, process, and path operations.

Additional dependencies require an approved release spec and must explain why the
standard library or existing Pi package APIs are insufficient.

## Comandos canônicos

The exact commands will be finalized when `package.json` is introduced. The
expected command contract is:

```bash
npm install
npm run build
npm test
npm run lint
npm run typecheck
```

## Restrições e proibições

- Do not add Claude Code, Codex, or OpenCode runtime assets.
- Do not create `.dadaia/`; this product uses `.dadaia-pi/`.
- Do not put operational state in managed repos.
- Do not represent Pi project trust as a sandbox.
- Do not commit secrets, provider API keys, local session files, or machine-local
  Pi credentials.
