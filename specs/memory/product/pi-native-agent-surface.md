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

The product surface is a Pi package and project-local Pi resources. The extension
does mechanical work; skills and prompts teach repeatable workflows; AGENTS.md
sets always-loaded instructions.

## Fluxo de uso

| Resource | Use |
|---|---|
| `.pi/extensions/**` | context injection, commands, tool-call gating, session hooks |
| `.pi/skills/**` | on-demand procedures for spec definition, implementation, review, closure |
| `.pi/prompts/**` | slash-command prompt templates for repeated workflows |
| `.pi/settings.json` | project package/resource configuration after trust |
| `AGENTS.md` | base rules loaded regardless of project trust |

## Diferencial

Project-local Pi resources require trust and run with local user permissions.
Every extension and package must be treated as executable code.
