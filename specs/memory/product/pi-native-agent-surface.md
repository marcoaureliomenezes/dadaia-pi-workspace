---
slug: pi-native-agent-surface
title: Pi-Native Agent Surface
category: product
tldr: "The agentic surface is Pi resources only: extensions, skills, prompt templates, packages, settings, and AGENTS.md."
summary: Defines how dadaia-pi-workspace uses Pi's documented extension points instead of projecting assets for other harnesses.
tags:
  - pi
  - extensions
  - skills
  - prompts
agent_tier: self-pull
token_estimate: 190
last_updated: "2026-06-14"
release_origin: bootstrap-pi-native-specs
---

## Propósito

The product surface is a Pi package plus consumer project-local Pi resources. The
package source uses package-root `extensions/`, `skills/`, and `prompts/` or a
`package.json` `pi` manifest. Consumer workspaces may receive `.pi/settings.json`
and optional `.pi/**` local resources after project trust. The extension does
mechanical work; skills and prompts teach repeatable workflows; AGENTS.md sets
always-loaded instructions.

## Fluxo de uso

| Resource | Use |
|---|---|
| Package `extensions/**` | distributed extension source for context injection, commands, tool-call/user-bash gating, session hooks |
| Package `skills/**` | distributed on-demand procedures for spec definition, implementation, review, closure |
| Package `prompts/**` | distributed slash-command prompt templates for repeated workflows |
| `package.json` `pi` manifest | declares package resources for `pi install` |
| Consumer `.pi/settings.json` | project package/resource configuration after trust |
| Consumer `.pi/**` | optional project-local resources loaded only after trust |
| `AGENTS.md` | base rules loaded regardless of project trust |

## Diferencial

Project-local Pi resources require trust and run with local user permissions.
Every extension and package must be treated as executable code. First-run flows
must explicitly tell operators that `.pi/**` and configured package resources will
not load until the project is trusted or the run intentionally uses Pi's
`--approve` behavior for an already-reviewed repository; non-interactive modes do
not prompt for trust. Trust is resource-loading consent, not sandboxing.
