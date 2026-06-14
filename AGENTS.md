# dadaia-pi-workspace — Repo Rules

Scope: this file governs work inside this repository.

## Repo Purpose

This repo ships `dadaia-pi-workspace`, a Pi-native SDD workspace manager. It provides a TypeScript/Node CLI, Pi package resources, context binding, SDD gates, leases, and git chokepoints for Spec Context Projects.

The product is Pi-only. Do not add Claude Code, Codex, OpenCode, or multi-harness runtime projections. `dadaia-workspace` may be used as a read-only source context for lifecycle/spec/skill research, but do not introduce a runtime dependency on it.

## Source Boundaries

| Path | Owner / rule |
|---|---|
| `src/` | TypeScript product source |
| `extensions/` | Pi package extension resources; executable code after package load |
| `skills/` | Pi package skills |
| `prompts/` | Pi prompt templates |
| `bin/` | POSIX shell hook wrappers only |
| `tests/` | Node test runner coverage |
| `specs/` | SDD law, memory, release artifacts, and audits |
| `.dadaia-pi/` | local runtime state/evidence; do not commit unless a specific artifact is intentionally tracked |
| `.pi/` | Pi project-local settings/resources; load only after Pi project trust |

Do not edit generated files, vendored dependencies, build outputs, secrets, provider keys, local session files, or machine-local Pi credentials.

## SDD Entry Check

Before editing production source:

1. Read `specs/releases/ACTIVE.md`.
2. Read the active release `SPEC.md`, `PLAN.md`, and `TASKS.md`.
3. Confirm all three artifacts are approved.
4. Confirm your task is marked `[-]`.
5. Confirm every edited file is in the task write set.

If any item fails, stop and report the exact missing artifact or task marker.

## Pi Trust and Security

Pi is not a sandbox. Pi extensions, packages, custom tools, git hooks, and shell commands run with the local user's permissions.

Project-local `.pi/**` resources and configured packages load only after Pi project trust. Interactive Pi can ask for trust; non-interactive flows do not prompt and may require Pi's `--approve` flag when the operator intentionally pre-approves loading trusted project resources.

Treat package roots `extensions/`, `skills/`, `prompts/`, and `bin/` as supply-chain review targets. Never represent trust approval as isolation.

## Repo Commands

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
node dist/src/cli/main.js specs doctor
npm run clean
```

## Validation Evidence

Every implementation report must include:

- commands run;
- pass/fail output;
- changed production paths;
- known risk or `none`.

Write local reports under `.dadaia-pi/reports/<context>/<role-or-session>/`. Machine-readable handoffs belong under `.dadaia-pi/handoff/<context>/`. Committed audits belong under `specs/audits/<YYYYMMDDTHHMMSSZ>-<session_id_8>/`.

## Stop Conditions

Stop before editing when:

- the active SDD gate is missing or not approved;
- the requested change is outside the task write set;
- the change needs a new public API/behavior not described by SPEC;
- tests cannot be run and no alternative validation is available;
- a secret, credential, private hostname, private IP, or machine-local trust file would be committed;
- the work would imply sandbox guarantees that Pi does not provide.
