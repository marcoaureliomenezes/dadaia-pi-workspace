# dadaia-pi-workspace

Pi-native SDD workspace manager for Spec Context Projects.

`dadaia-pi-workspace` packages a CLI, Pi extension, skills, prompts, and git chokepoints that help Pi Coding Agent sessions work inside approved SPEC/PLAN/TASKS gates. It is Pi-only: it does not generate Claude Code, Codex, OpenCode, or multi-harness assets.

## What it manages

- a committed `specs/` tree for product memory and releases;
- workspace runtime state under `.dadaia-pi/`;
- Pi package resources from package-root `extensions/`, `skills/`, and `prompts/`;
- optional consumer project settings under `.pi/settings.json`;
- git hooks that block unsafe commits and pushes.

`.dadaia-pi/` is dadaia runtime state. `.pi/` is Pi project-local configuration. They are intentionally separate.

## First run

```bash
npm install
npm run build
node dist/src/cli/main.js specs doctor
node dist/src/cli/main.js doctor
```

For a consumer workspace that should load this package through Pi project settings:

```bash
node dist/src/cli/main.js package project-settings --source npm:dadaia-pi-workspace@0.1.0
```

That writes `.pi/settings.json` with a `packages` entry. Pi project-local `.pi/**` resources and package resources are loaded only after Pi trusts the project.

## Pi trust and non-interactive runs

Pi's project trust prompt is the boundary for loading project-local `.pi/**` resources and configured packages. Interactive Pi sessions can ask the operator to trust the project. Non-interactive Pi flows do not prompt; run them only for repositories you already trust, and pass Pi's `--approve` flag when the workflow requires pre-approved project loading.

Trust is not a sandbox. It is a consent decision to load local code and configuration.

## Security posture

Pi has no built-in sandbox. Pi extensions, package resources, custom tools, git hooks, and shell commands run with the local user's permissions. Treat every Pi package and project-local `.pi/**` resource as executable code.

Before installing or approving this package in a workspace:

1. Review `package.json`, `extensions/`, `skills/`, `prompts/`, and `bin/`.
2. Review any generated or existing `.pi/settings.json`.
3. Keep secrets, provider keys, credentials, and local Pi session files out of git.
4. Use OS/container/VM isolation when working with untrusted repositories.
5. Remember that active-tool restrictions are only a first layer; git hooks and SDD gates are the backstops.

## Core Pi skills

The package ships operational skills for the full lifecycle:

- `dadaia-spec-navigator` — load context, memory, and active release in canonical order.
- `dadaia-spec-definition` — define/refine SPEC, PLAN, and TASKS.
- `dadaia-task-manager` — reserve and complete `[ ] -> [-] -> [x]` task markers.
- `dadaia-implementation` — implement inside approved write sets.
- `dadaia-review` — produce additive QA/code/security evidence.
- `dadaia-handoff-emitter` — write machine-readable handoffs under `.dadaia-pi/handoff/<context>/`.
- `dadaia-doctor` — run workspace/spec/package drift checks.
- `dadaia-closure` — close releases and update current-truth memory.

`dadaia-workspace` may be registered as a read-only source context for research, but this package remains Pi-only and does not depend on the old runtime.

## SDD workflow

1. **Define** — product steward writes approved `SPEC.md`, `PLAN.md`, and `TASKS.md` under `specs/releases/<release-id>/`.
2. **Bind** — a Pi session binds to one Spec Context Project using the Pi session id.
3. **Reserve** — implementation marks exactly one task as `[-]`.
4. **Implement** — production writes stay inside the task write set and require a live lease for mutating paths.
5. **Review** — reviewers create additive evidence under `.dadaia-pi/reports/`, `.dadaia-pi/handoff/`, or committed `specs/audits/`.
6. **Chokepoints** — pre-commit checks lease/task state; pre-push checks required evidence.
7. **Close** — closure records validation and updates memory as current product truth.

Useful commands:

```bash
node dist/src/cli/main.js workspace init --package-root repos/dadaia-pi-workspace
node dist/src/cli/main.js workspace install --package-root repos/dadaia-pi-workspace
node dist/src/cli/main.js workspace doctor --package-root repos/dadaia-pi-workspace
node dist/src/cli/main.js specs scaffold
node dist/src/cli/main.js specs doctor
node dist/src/cli/main.js status --session-id <id>
node dist/src/cli/main.js memory list --context <name>
node dist/src/cli/main.js memory show <slug> --context <name>
node dist/src/cli/main.js handoff list --context <name>
node dist/src/cli/main.js handoff validate <file>
node dist/src/cli/main.js handoff approve-security --context <name> --commit <sha> --session-id <id>
# Pi extension commands after package trust/load:
# /dadaia-bind <context> [--mode read|implementation|review] [--release <id>]
# /dadaia-status
# /dadaia-panel
# /dadaia-release
node dist/src/cli/main.js context create <name> --repo <slug> --url <url>
node dist/src/cli/main.js context bind <name> --session-id <id> --mode implementation --release <release-id>
node dist/src/cli/main.js hooks install
```

## Validation commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
node dist/src/cli/main.js specs doctor
npm run clean
```
