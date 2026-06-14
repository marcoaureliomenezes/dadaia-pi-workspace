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
- `@earendil-works/pi-ai` only where Pi-compatible enum helpers such as
  `StringEnum` are required by custom tool schemas;
- Node standard library for filesystem, process, and path operations.

Pi core packages imported by extensions or package resources must be declared as
`peerDependencies` with a broad compatible range instead of bundled:
`@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`,
`@earendil-works/pi-agent-core`, `@earendil-works/pi-tui`, and `typebox`. Runtime
third-party dependencies that are not Pi core packages belong in `dependencies`.

Additional dependencies require an approved release spec and must explain why the
standard library or existing Pi package APIs are insufficient.

## Comandos canônicos

The package layout must be valid as a Pi package: package-root `extensions/`,
`skills/`, `prompts/`, and optional `themes/`, or equivalent `package.json` `pi`
manifest entries. Consumer `.pi/**` files are generated or installed workspace
state, not the canonical package source.

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
- Do not document Pi package resources as inert content; package extensions, hooks, and project-local `.pi/**` resources are executable-code risk.
- Do not commit secrets, provider API keys, local session files, or machine-local
  Pi credentials.
- Do not write custom mutating Pi tools without wrapping the entire
  read-modify-write window in `withFileMutationQueue()` using the resolved
  absolute target path.
- Do not rely on active-tool selection as a security boundary; it is a first
  layer only and must be backed by gate checks.
