---
slug: pi-trust-and-security
title: Pi Trust and Security
category: product
tldr: "Pi project trust controls resource loading, not sandboxing; package and .pi resources are executable-code risk."
summary: Defines the honest security posture for dadaia-pi-workspace first-run and operations. Operators must understand trust, non-interactive approval, and no-sandbox limits before loading package or project-local resources.
tags:
  - pi
  - security
  - trust
agent_tier: inject
token_estimate: 260
last_updated: "2026-06-14"
release_origin: bootstrap-pi-native-specs
---

## Propósito

`dadaia-pi-workspace` must explain Pi security without overstating protection. Pi
project trust is consent to load local project/package resources; it is not an
execution sandbox. Extensions, package resources, hooks, tools, and shell commands
run with the local user's permissions.

## Fluxo de uso

| Moment | Required operator understanding |
|---|---|
| First install | Review `package.json`, `extensions/`, `skills/`, `prompts/`, and `bin/` as executable supply-chain surface |
| Project setup | `.pi/settings.json` configures Pi package loading, but `.pi/**` is consumer/project-local, not package source |
| Interactive Pi | project trust may be prompted before `.pi/**` and package resources load |
| Non-interactive Pi | no trust prompt appears; use Pi `--approve` only for repositories already reviewed and intentionally trusted |
| Untrusted repos | use OS/container/VM isolation; do not rely on Pi trust or active-tool settings as a sandbox |

## Diferencial

Security controls are layered but not absolute: SDD gates and leases coordinate
agent writes, active-tool settings reduce accidental write attempts, git hooks
catch commit/push boundaries, and doctor checks validate structure. None of those
mechanisms prevent arbitrary external processes or malicious executable package
code from touching files with the user's permissions.
