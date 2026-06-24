---
release: headless-workflow-orchestration-sdk
status: approved
---

# SPEC - headless-workflow-orchestration-sdk

**Status:** Aprovado

## Problem

The current dadaia-pi-workspace lifecycle relies too much on agents voluntarily following skills, prompts, hooks, and AGENTS.md. This is error-prone for backlog intake, release definition, reviews, closure, and memory updates because the rituals are not first-class deterministic workflow commands.

## Scope

Add a first release of a Pi SDK-backed workflow orchestration layer exposed through the `dadaia-pi` CLI. The layer must define and execute deterministic shells for the lifecycle workflows, while keeping LLM work bounded to small SDK steps.

## Requirements

- Add a workflow command group:
  - `dadaia-pi workflow list [--json]`
  - `dadaia-pi workflow show <workflow> [--json]`
  - `dadaia-pi workflow run <workflow> --context <name> [--release <id>] [--prompt-file <path>] [--model <pattern>] [--approve] [--dry-run] [--json]`
- Define workflows for:
  - backlog intake;
  - research;
  - release definition;
  - spec review;
  - implementation task;
  - QA review;
  - security review;
  - code review;
  - release closure.
- Each workflow definition must include phase, activity class, deterministic preflight checks, bounded Pi SDK step, deterministic postflight checks, outputs, and evidence channels.
- Workflow runs must create a machine-readable manifest under `.dadaia-pi/workflows/<context>/`.
- Workflow runs must create a human-readable report under `.dadaia-pi/reports/<context>/workflows/`.
- The SDK integration must be represented as an adapter that uses `@earendil-works/pi-coding-agent` when available, while providing a deterministic fallback for tests and offline runs.
- Context management must improve by requiring explicit context resolution, optional release binding, prompt scoping, report scoping, and workflow run IDs.
- No workflow may silently mutate production source through SDK output. Workflow manifests and reports are additive in this release.
- The implementation must document the new workflow layer and update memory current truth.

## Acceptance

- `dadaia-pi workflow list --json` returns all workflow definitions.
- `dadaia-pi workflow show backlog-intake --json` exposes deterministic gates and SDK step metadata.
- `dadaia-pi workflow run spec-review --context dadaia-pi-workspace --release headless-workflow-orchestration-sdk --dry-run --json` emits manifest/report files without requiring a provider.
- Tests cover workflow definitions, manifest/report emission, dry-run SDK fallback, and CLI behavior.
- README and memory describe the new workflow architecture and context-management improvements.
- `npm run build`, `npm test`, and `node dist/src/cli/main.js specs doctor` pass.
