---
slug: sdd-lifecycle-governance
title: SDD Lifecycle Governance
category: product
tldr: "SPEC/PLAN/TASKS approval, additive evidence, mutating leases, review checkpoints, and closure memory updates."
summary: Defines the lifecycle rules that make Pi sessions safe and organized across multiple repos.
tags:
  - sdd
  - lifecycle
  - lease
  - review
agent_tier: self-pull
token_estimate: 170
last_updated: "2026-06-14"
release_origin: bootstrap-pi-native-specs
---

## Propósito

SDD governance keeps implementation subordinate to product definition. Pi can be
fast and flexible, but production writes must still be scoped to an approved
release and a reserved task.

## Fluxo de uso

1. Backlog and bugs are additive intake.
2. Product steward writes SPEC, PLAN, and TASKS.
3. Implementation session reserves one task.
4. Pi extension and git hooks enforce path, phase, and lease constraints.
5. Review sessions produce additive evidence.
6. Closure updates memory and archives the release truth.

## Diferencial

There is exactly one mutating lease per Spec Context Project. Additive work never
blocks on the lease.
