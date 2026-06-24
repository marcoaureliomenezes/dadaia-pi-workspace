---
slug: headless-workflow-orchestration
title: Headless Workflow Orchestration
category: product
tldr: "Python `dadaia-pi workflow` wraps lifecycle rituals in deterministic commands with Pi RPC/headless reasoning steps and scoped evidence."
summary: "Defines the workflow orchestration layer used to reduce slop from agent-only rule following. Python workflows require explicit context, optional release scope, deterministic checks, optional Pi RPC/headless execution, and additive manifest/report evidence under .dadaia-pi."
tags:
  - workflow
  - rpc
  - sdd
  - lifecycle
agent_tier: self-pull
token_estimate: 360
last_updated: "2026-06-23"
release_origin: python-cli-core-migration-v1
---

## Current truth

Governance v1 is now the stable baseline for lifecycle enforcement. New governance features require an explicit backlog item or approved release definition; normal maintenance should prioritize docs, readiness diagnostics, and bug fixes over adding new gates.

`dadaia-pi-workspace` provides a first-class workflow orchestration layer through:

```bash
dadaia-pi workflow list
dadaia-pi workflow show <workflow>
dadaia-pi workflow status --context <name> --release <id>
dadaia-pi workflow advance --context <name> --release <id> --to <phase>
dadaia-pi workflow run <workflow> --context <name> [--release <id>] [--prompt-file <path>] [--model <pattern>] [--verdict APPROVED|NEEDS_CHANGES|REJECTED] [--dry-run]
dadaia-pi workflow rc create/list/inspect ...
dadaia-pi workflow patch apply --context <name> --release <id> --patch-file <path> --approve
dadaia-pi workflow evidence bundle --context <name> --release <id> [--prune]
dadaia-pi workflow readiness --context <name> --release <id>
dadaia-pi workflow backlog-check --context <name> --prompt-file <path>
dadaia-pi workflow backlog-consume --context <name> --release <id> --backlog <path>
```

The workflow layer turns lifecycle rituals into deterministic execution engines around bounded agentic steps. Python owns the workflow catalog, manifest/report writing, dry-run fallback, Pi RPC JSONL client, and one-shot headless Pi runner. Workflows can call `pi --mode rpc` for multi-step/event-streaming control or `pi --mode json -p`/print mode for one-shot prompts. Dry-run or unavailable Pi paths record deterministic per-step fallback executions. Workflow manifests carry runtime/mode data, verdict data (`value`, `findings`, `blockingFindings`, `risk`, `reviewedPaths`, `acceptanceCoverage`), linked handoff paths when available, and optional release-candidate IDs.

Each run:

1. resolves one explicit Spec Context Project;
2. validates optional release artifacts when a release is supplied;
3. records a collision-safe run id;
4. executes bounded Pi reasoning through RPC or one-shot headless mode when requested;
5. falls back to deterministic dry-run/offline output when Pi execution is unavailable or `--dry-run` is used;
6. writes machine-readable evidence under `.dadaia-pi/workflows/<context>/`;
7. writes human-readable evidence under `.dadaia-pi/reports/<context>/workflows/`.

## Defined workflows

Canonical procedural workflows:

- `backlog-definition`: demand intake, backlog/bug conflict review, bounded grill-me clarification, and one canonical backlog item.
- `release-definition`: backlog/bug scope selection, SPEC drafting, PLAN drafting, grouped TASKS drafting, and independent review loop with a hard iteration cap.
- `release-implementation`: mandatory TDD execution by task group — tests first, test fidelity review, red validation, bounded code implementation, green validation, implementation review, and commit gate before the next group.
- `architecture-review`: release-candidate architecture, memory alignment, dependency boundary, and maintainability gate.
- `push-gate`: public repository push readiness requiring QA, architecture, security, code review, and RC commit-range coverage.

Compatibility/atomic workflows:

- `backlog-intake`: grill-me demand intake, existing-backlog review, and conflict prevention.
- `research`: read-only scoped investigation with citations and risks.
- `release-define`: SPEC/PLAN/TASKS drafting from selected backlog with backlog consumption planning.
- `spec-review`: independent release artifact review before implementation.
- `implementation-task`: one reserved task with lease and write-set controls.
- `qa-review`: release-candidate or commit-group QA gate.
- `security-review`: push gate for trust, package, hook, and sensitive-path risks.
- `code-review`: PR gate for maintainability, API, style, and scope.
- `release-closure`: final validation, closure, current-truth memory update, and archive transition.

## Context management improvement

Workflow runs no longer rely on a broad agent session remembering the active scope. The CLI requires an explicit `--context`, stores artifacts under that context, optionally checks `--release`, and names the bounded SDK role, allowed tools, expected output, preflight checks, and postflight checks in the manifest.

Production mutations remain governed by SDD gates, workflow phase gates, Pi extension checks, and git chokepoints. Pre-commit validates the exact active `[-]` task write set by parsing backtick paths from the task's `Write set:` line, blocks mutating staged paths outside that set, and requires APPROVED `release-implementation` workflow evidence for the active release before a mutating commit. The Pi extension exposes `/dadaia-workflow-status` and delegates context injection plus mutating tool/user-bash checks to the Python bridge. Python decides whether the active phase, review evidence, lease, and reserved task write set allow the operation.

Backlog hygiene is supported by `workflow backlog-check`, which compares a demand prompt with existing backlog entries and writes a grill-me record, and `workflow backlog-consume`, which marks backlog items consumed by an approved release instead of deleting evidence. Release candidates are stored under `.dadaia-pi/release-candidates/<context>/<release>/` with RC id and commit range; `workflow rc create` supports either `--commits` or `--from/--to`, and `workflow rc inspect` reports commits, changed files, review status, and stale HEAD state. QA/security/code review workflow runs can reference an RC via `--rc-id` and automatically append their manifest paths to the RC review arrays. `dadaia-pi doctor` validates workflow manifests, linked handoff back-references, RC review manifest paths, active phase/evidence consistency, orphan workflow handoffs, active-release RC review completeness, review `reviewedPaths`, QA `acceptanceCoverage`, closure memory evidence, and RC changed-file coverage for code/security reviews. Pre-push accepts APPROVED zero-blocking `security-review` workflow evidence only when it is tied to an RC whose git commit range contains the pushed SHA. `workflow patch apply` provides a controlled patch lane that requires `--approve`, validates patch paths against the reserved task write set, applies content, oldText/newText, or unified diff operations, and emits patch audit evidence. `workflow evidence bundle` seals immutable release evidence bundles with optional pruning, and `workflow readiness` reports phase, gates, RC coverage, doctor issues, pre-push readiness, closure readiness, and score. The browser panel exposes workflow phase/gates, active task/write set, RC review status, latest manifests/handoffs, safe read-only action APIs, next-command copy, and workflow doctor issues. The Workflows tab shows active state plus the workflow catalog with procedural steps, engines, prompts/models, max iterations, and approval gates. Its main `Projects` tab combines overview and Spec Context Project cards; project-local memory is surfaced as links on each card (`architecture.md`, `quality-assurance.md`, product catalog, and cataloged product feature markdown) rather than as a standalone Memory tab.
