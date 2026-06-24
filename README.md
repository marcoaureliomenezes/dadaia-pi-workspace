# dadaia-pi-workspace

Python-first Pi-native SDD workspace manager for Spec Context Projects.

`dadaia-pi-workspace` packages a Python CLI/runtime, a thin Pi JavaScript extension adapter, skills, prompts, a read-only browser panel, and git chokepoints that help Pi Coding Agent sessions work inside approved SPEC/PLAN/TASKS gates. It is Pi-only: it does not generate Claude Code, Codex, OpenCode, or multi-harness assets.

Python is the lifecycle authority for scaffold, Spec Context management, specs/memory navigation, gates, leases, hooks, workflows, status, and the panel backend. JavaScript/TypeScript remains only where Pi or the browser requires it: Pi extension event adapters and browser/front-end compatibility code.

## What it manages

- a committed `specs/` tree for product memory and releases;
- workspace runtime state under `.dadaia-pi/`;
- Pi package resources from package-root `extensions/`, `skills/`, and `prompts/`;
- optional consumer project settings under `.pi/settings.json`;
- git hooks that block unsafe commits and pushes.

`.dadaia-pi/` is dadaia runtime state. `.pi/` is Pi project-local configuration. They are intentionally separate.

## First run

The development-lifecycle CLI is Python-first. Use `python3 -m dadaia_pi` from a checkout, the installed Python console script, or the npm/package `dadaia-pi` shim, which delegates to Python. Set `DADAIA_PI_PYTHON` to override the Python executable.

Python runtime smoke:

```bash
PYTHONPATH=src python3 -m dadaia_pi --version
PYTHONPATH=src python3 -m dadaia_pi status --json
python3 -m pytest tests_py
```

TypeScript remains as a Pi/package adapter, browser/frontend, and legacy compatibility layer only. It is still typechecked while migration parity is maintained, but new lifecycle policy belongs in Python:

```bash
npm install
npm run typecheck
npm run check:python
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

## Headless workflow orchestration

`dadaia-pi workflow` adds deterministic lifecycle orchestration around bounded Pi SDK reasoning steps. This reduces reliance on agents remembering long rituals from skills/rules alone. Each workflow run resolves one explicit context, optionally binds to one release, records a run id, executes deterministic preflight/postflight metadata, calls a bounded SDK step when available, and writes scoped evidence:

- machine manifest: `.dadaia-pi/workflows/<context>/<timestamp>-<workflow>.json`
- human report: `.dadaia-pi/reports/<context>/workflows/<timestamp>-<workflow>.md`

The initial workflow catalog is:

| Workflow | Phase | Purpose |
|---|---|---|
| `backlog-intake` | Backlog definition | Grill-me demand intake, review existing backlog, and prevent duplicate/conflicting backlog truth. |
| `research` | Research | Read-only scoped investigation with citations and open questions. |
| `release-define` | Release definition | Draft SPEC/PLAN/TASKS from selected backlog and plan backlog consumption. |
| `spec-review` | Spec review | Independently review SPEC/PLAN/TASKS before implementation. |
| `implementation-task` | Implementation | Implement one reserved task with lease and write-set controls. |
| `qa-review` | QA review | Review a release candidate or commit group against acceptance and tests. |
| `security-review` | Security review | Gate push readiness for trust, package, hook, and sensitive-path risks. |
| `code-review` | Code review | Gate PR readiness for maintainability, API, style, and scope. |
| `release-closure` | Closure | Verify tasks/reviews, draft closure, and update current-truth memory. |

Commands:

```bash
dadaia-pi workflow list [--json]
dadaia-pi workflow show <workflow> [--json]
dadaia-pi workflow status --context <name> --release <id> [--json]
dadaia-pi workflow advance --context <name> --release <id> --to <phase> [--json]
dadaia-pi workflow run <workflow> --context <name> [--release <id>] [--prompt-file <path>] [--model <pattern>] [--verdict APPROVED|NEEDS_CHANGES|REJECTED] [--rc-id <id>] [--approve] [--dry-run] [--json]
```

`workflow status` and `workflow advance` implement the first deterministic governance state machine. The canonical phase order is `BACKLOG -> RESEARCH -> RELEASE_DEFINITION -> SPEC_REVIEW -> IMPLEMENTATION -> QA_REVIEW -> SECURITY_REVIEW -> CODE_REVIEW -> CLOSURE -> ARCHIVED`; `RESEARCH` is optional from `BACKLOG`. Advancement is gated by APPROVED workflow manifests for the same context and release with zero `verdict.blockingFindings`. For example, `IMPLEMENTATION` requires APPROVED `spec-review` evidence, `QA_REVIEW` requires APPROVED `implementation-task`, `SECURITY_REVIEW` requires APPROVED `qa-review`, `CODE_REVIEW` requires APPROVED `security-review`, `CLOSURE` requires APPROVED QA/security/code evidence plus completed or deferred tasks, and `ARCHIVED` requires APPROVED `release-closure` evidence. Workflow manifests include structured verdict data (`value`, `findings`, `blockingFindings`, `risk`, `reviewedPaths`, `acceptanceCoverage`), linked handoff paths, and optional release-candidate IDs. The SDK adapter captures exposed assistant/message output from Pi SDK sessions and the runner parses these fields from fenced or inline JSON in SDK summaries; non-dry-run review workflows now require parseable JSON verdicts or are marked `NEEDS_CHANGES` with a blocking finding. Review and closure workflows (`spec-review`, `qa-review`, `security-review`, `code-review`, `release-closure`) automatically emit `.handoff.json` evidence and record that handoff path in `manifest.linkedHandoffs`.

Backlog and release hygiene commands provide deterministic support for No-SLOP intake and cleanup:

```bash
dadaia-pi workflow backlog-check --context <name> --prompt-file <path>
dadaia-pi workflow backlog-consume --context <name> --release <id> --backlog specs/backlog/<item>.md
```

Release candidates are modeled under `.dadaia-pi/release-candidates/<context>/<release>/` and review workflows can reference them with `--rc-id`. QA/security/code review workflow runs automatically append their manifest path to the RC review arrays:

```bash
dadaia-pi workflow rc create --context <name> --release <id> --rc-id rc-1 --commits <range>
dadaia-pi workflow rc create --context <name> --release <id> --rc-id rc-1 --from <base> --to <head>
dadaia-pi workflow rc list --context <name> --release <id>
dadaia-pi workflow rc inspect --context <name> --release <id> --rc-id rc-1
dadaia-pi workflow run qa-review --context <name> --release <id> --rc-id rc-1
```

The Pi extension injects workflow status, the active reserved task, and the task write set into bound sessions, exposes `/dadaia-workflow-status`, and blocks implementation mutating tool calls when the active phase is not `IMPLEMENTATION`, APPROVED `spec-review` evidence is missing, or the target path is outside the reserved task `Write set:`. `dadaia-pi doctor` validates workflow manifests, release-candidate records, linked handoff back-references, RC review manifest paths, active phase/evidence consistency, orphan workflow handoffs, and RC changed-file coverage against code/security `reviewedPaths` plus QA acceptance coverage. Pre-push accepts legacy approved security handoffs by exact commit SHA or APPROVED zero-blocking `security-review` workflow evidence tied to an RC whose git commit range contains the pushed SHA.

Pre-commit now validates the exact reserved task write set. The active release must have exactly one `[-]` task and that task must include a `Write set:` line with backtick paths such as `src/cli/main.ts` or `src/features/workflows/**`. Mutating staged paths outside that write set are blocked.

The Python workflow runner can call Pi through RPC (`pi --mode rpc`) for multi-step orchestration or through one-shot headless print/json modes for bounded prompts; `--dry-run` and offline/test environments use deterministic fallback evidence. The browser panel backend is Python-owned and loopback-only; browser JavaScript is frontend-only. Its main view combines workspace overview, Spec Context Project cards, memory/status JSON, workflows, handoffs, and reports. Memory is not modeled as a separate top-level tab.

## Governance v1 stable baseline

Governance v1 is the frozen lifecycle baseline. Operator docs live in:

- `docs/governance-v1-operator-guide.md`
- `docs/governance-v1-freeze.md`

Run the regression smoke with:

```bash
npm run smoke:governance-v1
```

No new governance feature should be added without an explicit backlog item or approved release definition.

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
PYTHONPATH=src python3 -m dadaia_pi workspace init --package-root repos/dadaia-pi-workspace
PYTHONPATH=src python3 -m dadaia_pi workspace install --package-root repos/dadaia-pi-workspace
PYTHONPATH=src python3 -m dadaia_pi workspace doctor --package-root repos/dadaia-pi-workspace
PYTHONPATH=src python3 -m dadaia_pi specs scaffold
PYTHONPATH=src python3 -m dadaia_pi specs doctor
PYTHONPATH=src python3 -m dadaia_pi status --session-id <id>
PYTHONPATH=src python3 -m dadaia_pi panel              # starts http://127.0.0.1:4999/
PYTHONPATH=src python3 -m dadaia_pi memory list --context <name>
PYTHONPATH=src python3 -m dadaia_pi memory show <slug> --context <name>
PYTHONPATH=src python3 -m dadaia_pi handoff list --context <name>
PYTHONPATH=src python3 -m dadaia_pi handoff validate <file>
PYTHONPATH=src python3 -m dadaia_pi handoff approve-security --context <name> --commit <sha> --session-id <id>
PYTHONPATH=src python3 -m dadaia_pi workflow list
PYTHONPATH=src python3 -m dadaia_pi workflow status --context <name> --release <release-id>
PYTHONPATH=src python3 -m dadaia_pi workflow advance --context <name> --release <release-id> --to SPEC_REVIEW
PYTHONPATH=src python3 -m dadaia_pi workflow rc create --context <name> --release <release-id> --rc-id rc-1 --commits <range>
PYTHONPATH=src python3 -m dadaia_pi workflow rc list --context <name> --release <release-id>
PYTHONPATH=src python3 -m dadaia_pi workflow rc inspect --context <name> --release <release-id> --rc-id rc-1
PYTHONPATH=src python3 -m dadaia_pi workflow patch apply --context <name> --release <release-id> --patch-file patch.json --approve
PYTHONPATH=src python3 -m dadaia_pi workflow evidence bundle --context <name> --release <release-id>
PYTHONPATH=src python3 -m dadaia_pi workflow readiness --context <name> --release <release-id>
PYTHONPATH=src python3 -m dadaia_pi workflow backlog-check --context <name> --prompt-file demand.md
PYTHONPATH=src python3 -m dadaia_pi workflow backlog-consume --context <name> --release <release-id> --backlog specs/backlog/item.md
PYTHONPATH=src python3 -m dadaia_pi workflow run spec-review --context <name> --release <release-id> --dry-run
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
