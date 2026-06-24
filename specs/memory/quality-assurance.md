---
slug: quality-assurance
title: Quality Assurance
category: core
tldr: "QA policy for the Pi-only SDD workspace: tests, doctor checks, git chokepoints, and no fabricated evidence."
summary: Defines initial QA expectations for dadaia-pi-workspace. Quality evidence must be reproducible and tied to lifecycle gates.
tags:
  - quality-assurance
  - testing
  - sdd
agent_tier: self-pull
token_estimate: 260
last_updated: "2026-06-14"
release_origin: bootstrap-pi-native-specs
---

## Propósito

- All domain rules need unit tests.
- All filesystem/git adapters need integration tests with temp directories.
- Pi extension behavior needs harness-facing tests or documented manual smoke
  tests until an automated Pi harness test is available.
- Doctor checks must cover every state store introduced by the product.
- Test output and review reports must not be fabricated.

## Fluxo de uso

| Area | Required evidence |
|---|---|
| Context registry | create/list/show/alive/dead/bind/release |
| SDD scaffold | constitution, memory, backlog, bugs, audits, releases |
| Gate classifier | ADDITIVE, MEMORY, FROZEN, PROTECTED, MUTATING |
| Lease | acquire, renew, stale reclaim, live foreign yield |
| Pi extension | project-trust behavior, context injection, session-id binding, tool-call blocking, user-bash interception, READ active-tool restriction |
| Pi package | package manifest/resource discovery and project-local load after trust |
| Git hooks | pre-commit and pre-push behavior, including exact reserved task write-set enforcement |
| Workflow governance | phase status/advance, optional research transition, accepted manifest gates, closure task-completion gate |
| Handoffs | minimal JSON schema validation and `.dadaia-pi/handoff/<context>/` doctor coverage |

## Diferencial

- No test may assert only that a placeholder exists.
- No feature ships without delete/orphan, dirty input, and missing dependency
  coverage or an explicit justified absence.
- No state file ships without a doctor check and cleanup rule.
- Workflow manifests used as phase gates must match context, release, workflow id, and `sdk.accepted === true` before they are accepted as lifecycle evidence.
- Machine-readable handoffs must validate `schemaVersion`, context/session/agent/timestamp/scope, artifact type, metrics object, and findings array before they are used as lifecycle evidence.
- No custom mutating Pi tool ships without test coverage that it uses the file
  mutation queue or a documented reason it cannot race with other writes.
- No project-local `.pi/**` behavior ships without a trust/non-interactive smoke
  test or documented manual check.
- First-run documentation must name Pi's no-sandbox posture, package executable-code risk, project trust loading behavior, and non-interactive `--approve` expectations.
