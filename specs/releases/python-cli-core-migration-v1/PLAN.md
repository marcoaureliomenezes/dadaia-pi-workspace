# PLAN - python-cli-core-migration-v1

**Status:** Aprovado

## Approach

Migrate authority incrementally while keeping the existing product operable. The migration creates a Python implementation beside the current TypeScript implementation, proves command parity by slice, then reduces TypeScript to Pi/browser-only adapters.

## Slices

### Slice 1 - Python package and command skeleton

- Add `pyproject.toml` and `src/dadaia_pi/**` package layout.
- Add Python console script `dadaia-pi`.
- Implement shared JSON output helpers, workspace-root discovery, filesystem helpers, and error formatting.
- Add `pytest` test infrastructure.
- Keep npm metadata only for Pi package/front-end compatibility during migration.

### Slice 2 - Read-only lifecycle parity

- Port workspace doctor/status read models.
- Port context list/show/status read paths.
- Port memory list/show navigation.
- Port specs doctor read-only validation.
- Add parity tests against representative `.dadaia-pi/**` and `specs/**` fixtures.

### Slice 3 - Mutating workspace/context/spec commands

- Port workspace init/install/doctor repair behavior.
- Port context create/update/alive/dead/bind/release behavior.
- Port specs scaffold behavior.
- Preserve state file formats and atomic-write behavior.
- Add migration/doctor checks for mixed TypeScript/Python authority drift.

### Slice 4 - Gate, leases, hooks, and bridge protocol

- Port path classification, policy decisions, lease acquire/reclaim/yield behavior, bash target extraction, task write-set checks, pre-commit, and pre-push logic.
- Define stable JSON request/response schemas for Pi adapter calls.
- Implement Python `pi-bridge` commands for context injection, gate check, status, bind, release, and heartbeat.
- Replace Pi extension policy logic with subprocess calls to Python bridge commands.

### Slice 5 - Workflow and Pi automation

- Implement Python Pi RPC client using LF-delimited JSONL and strict command/response correlation.
- Implement Python one-shot headless runner for `pi -p` / `pi --mode json -p`.
- Port workflow catalog, governance transitions, backlog consume/check, release candidate, controlled patch, evidence bundle, readiness, and handoff linkage behavior.
- Preserve dry-run/offline deterministic fallback where existing workflows require it.

### Slice 6 - Panel backend and package surface

- Move panel API/status data production to Python.
- Keep browser frontend JS/TS assets only as frontend code.
- Keep package `extensions/`, `skills/`, and `prompts/` loadable by Pi.
- Ensure package install/project-settings commands point at the Python CLI while preserving Pi package resource discovery.

### Slice 7 - Documentation, memory, and retirement

- Update architecture and tech-stack memory to record Python runtime authority.
- Update README/package docs to describe Python install, Pi package trust, RPC/headless use, and JS/TS adapter boundaries.
- Mark or remove TypeScript lifecycle source once Python parity is validated.
- Keep only Pi-exclusive adapter code and browser frontend code in JS/TS.

## Validation

- `pytest` for Python unit and CLI tests.
- Bridge contract tests for JSON request/response schemas.
- RPC client tests using a fake Pi JSONL process and, where available, a smoke call to real `pi --mode rpc`.
- Headless runner tests using a fake subprocess and documented real-Pi smoke command.
- Existing command parity checks comparing selected old JSON outputs to new Python outputs until retirement.
- `dadaia-pi specs doctor` and `dadaia-pi workspace doctor` must pass from the Python CLI.
- Pi extension smoke test must prove slash command/event handler delegation to Python bridge.
- Panel smoke test must prove backend API data is Python-owned and frontend renders read-only status.

## Risks and Controls

| Risk | Control |
|---|---|
| Big-bang rewrite breaks lifecycle enforcement | Slice migration, parity tests, and keep old implementation until Python parity is proven |
| Mixed TypeScript/Python policy drift | Python becomes authoritative; JS adapter calls Python bridge; doctor flags drift |
| Subprocess bridge overhead | Start with subprocess for simplicity; keep protocol daemon-compatible for future optimization |
| Pi trust confusion in headless/RPC calls | Docs and CLI flags must state `--approve` loads trusted code and is not sandboxing |
| State compatibility regressions | Fixture tests for existing `.dadaia-pi/**` and explicit migration checks |
| Browser frontend/backend coupling | Keep frontend API contract stable and backend data generation in Python |

## Rollout Controls

- Do not remove TypeScript lifecycle code until Python command parity and bridge delegation are validated.
- Do not change `.dadaia-pi/**` schemas without migration code and doctor coverage.
- Do not introduce Python dependencies beyond the standard library without explicit task-level justification.
- Keep JS/TS write sets limited to Pi adapter and browser frontend files.
