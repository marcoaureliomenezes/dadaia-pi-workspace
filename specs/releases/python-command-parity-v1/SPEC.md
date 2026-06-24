# SPEC - python-command-parity-v1

**Status:** Aprovado

## Problem

`python-cli-core-migration-v1` established Python as the lifecycle/runtime authority, but some mature CLI capabilities still exist only as TypeScript implementations or only as partial Python equivalents. Before TypeScript lifecycle code can be retired and before `dadaia-pi-workspace` can be merged into the broader `dadaia-workspace` multi-harness product, all remaining development lifecycle commands must have authoritative Python implementations with compatible behavior, JSON output, and validation coverage.

## Scope

Port the remaining CLI command families to Python:

- handoff commands:
  - `handoff validate <file>`
  - `handoff list [--context <name>]`
  - `handoff approve-security --context <name> --commit <sha> [--session-id <id>] [--scope <text>] [--release <id>]`
- workflow governance commands:
  - `workflow status --context <name> --release <id>`
  - `workflow advance --context <name> --release <id> --to <phase>`
- workflow release-candidate commands:
  - `workflow rc create --context <name> --release <id> --rc-id <id> (--commits <range> | --from <base> --to <head>)`
  - `workflow rc list --context <name> --release <id>`
  - `workflow rc inspect --context <name> --release <id> --rc-id <id>`
- workflow patch command:
  - `workflow patch apply --context <name> --release <id> --patch-file <path> --approve`
- workflow evidence/readiness commands:
  - `workflow evidence bundle --context <name> --release <id> [--prune]`
  - `workflow readiness --context <name> --release <id>`
- workflow backlog hygiene commands:
  - `workflow backlog-check --context <name> --prompt-file <path>`
  - `workflow backlog-consume --context <name> --release <id> --backlog <path>`
- richer Python doctor checks for:
  - malformed workflow manifests;
  - workflow phase/evidence gate consistency;
  - release candidate records and changed-file coverage;
  - linked handoff back-references;
  - Python/JS authority boundary drift.

## Non-Goals

- Do not add support for Claude Code, Codex, or OpenCode in this repository. That belongs to the later `dadaia-workspace` merge path.
- Do not remove TypeScript lifecycle source in this release; removal belongs to a follow-up retirement release after parity is proven.
- Do not change existing `.dadaia-pi/**` state schemas unless a migration and doctor check are included.
- Do not introduce heavy Python dependencies unless explicitly justified in the task implementation notes.
- Do not weaken Pi trust/security language or imply RPC/headless mode is sandboxed.

## Product Behavior

### Python command parity

Operators should be able to use Python `dadaia-pi` for the remaining lifecycle commands without falling back to the TypeScript CLI. JSON output should remain stable enough for current workflow/panel/hook consumers.

### Governance parity

Python workflow governance must understand lifecycle phases, required evidence gates, APPROVED zero-blocking manifests, and active release state. Phase advancement must refuse invalid transitions and missing evidence with actionable reasons.

### RC/readiness parity

Python release-candidate commands must create/list/inspect RC records, resolve changed files from git ranges where possible, track review manifest arrays, and feed readiness/pre-push logic.

### Patch/evidence parity

Python patch apply must validate paths against the reserved task write set and require explicit `--approve`. Evidence bundle/readiness must summarize release state, gate coverage, doctor findings, RC/review coverage, and closure readiness.

### Doctor parity

Python doctor must report richer lifecycle drift and mixed-authority hazards. It should flag when TypeScript is used as a lifecycle authority instead of adapter/frontend compatibility, while allowing the known thin Pi extension and browser frontend boundaries.

## Acceptance Criteria

- Python implements the handoff command family with tests for valid, invalid, filtered, and generated security handoffs.
- Python implements workflow status/advance with tests for allowed transitions, missing evidence, and invalid phase transitions.
- Python implements RC create/list/inspect with tests for commit range metadata and review manifest references.
- Python implements patch apply with tests for JSON full-file, exact oldText/newText operations, diff rejection/handling, required `--approve`, and write-set enforcement.
- Python implements evidence bundle and readiness with tests for gate summaries and missing/ready states.
- Python implements backlog-check/backlog-consume with additive evidence and no silent deletion of backlog truth.
- Python doctor reports workflow/RC/handoff/authority issues and passes for the current workspace after implementation.
- Existing Python test suite passes.
- TypeScript adapter typecheck still passes.
- Node specs doctor remains clean during the transition.
