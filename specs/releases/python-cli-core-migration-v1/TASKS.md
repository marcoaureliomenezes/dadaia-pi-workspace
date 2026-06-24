# TASKS - python-cli-core-migration-v1

**Status:** Aprovado

## Implementation Tasks

- [x] T-001 Add Python package skeleton and CLI foundation
  - Write set: `pyproject.toml`, `src/dadaia_pi/**`, `tests_py/**`, `README.md`, `specs/releases/python-cli-core-migration-v1/**`
  - Acceptance:
    - Python console script `dadaia-pi` exists.
    - CLI has shared JSON/text output, workspace discovery, error handling, and version/status skeleton.
    - `pytest` can run at least one smoke test.

- [x] T-002 Port read-only status, context, memory, and specs doctor paths
  - Write set: `src/dadaia_pi/**`, `tests_py/**`, `specs/releases/python-cli-core-migration-v1/**`
  - Acceptance:
    - Python CLI implements `status`, `context list/show/status`, `memory list/show`, and `specs doctor` read paths.
    - Existing `.dadaia-pi/**` and `specs/**` fixtures are readable without migration.
    - JSON outputs remain stable where current workflow consumers depend on them.

- [x] T-003 Port workspace scaffold/install and context mutation commands
  - Write set: `src/dadaia_pi/**`, `tests_py/**`, `.pi/**`, `specs/releases/python-cli-core-migration-v1/**`
  - Acceptance:
    - Python CLI implements workspace init/install/doctor behavior.
    - Python CLI implements context create/update/alive/dead/bind/release behavior.
    - State writes are atomic and compatible with existing `.dadaia-pi/**` schemas.
    - Generated `.pi/**` project settings continue to load package resources after Pi trust.

- [x] T-004 Port SDD gate, lease, hook, and task write-set logic to Python
  - Write set: `src/dadaia_pi/**`, `bin/**`, `tests_py/**`, `specs/releases/python-cli-core-migration-v1/**`
  - Acceptance:
    - Python implements path classification, policy decisions, lease logic, bash target parsing, task write-set checks, pre-commit, and pre-push checks.
    - Hook wrappers call the Python CLI.
    - Tests cover allow/block decisions for ADDITIVE, MEMORY, FROZEN, PROTECTED, and MUTATING paths.

- [x] T-005 Define and implement Pi extension-to-Python bridge
  - Write set: `src/dadaia_pi/**`, `extensions/**`, `tests_py/**`, `tests/**`, `package.json`, `specs/releases/python-cli-core-migration-v1/**`
  - Acceptance:
    - A documented JSON bridge protocol supports context injection, gate check, bind, release, status, and heartbeat requests.
    - Pi extension delegates lifecycle decisions to Python bridge commands.
    - JS/TS extension code contains no independent SDD policy beyond request serialization and Pi API adaptation.
    - Tests cover bridge request/response success and block/error paths.

- [x] T-006 Implement Python Pi RPC/headless runners and port workflows
  - Write set: `src/dadaia_pi/**`, `workflows/**`, `tests_py/**`, `specs/releases/python-cli-core-migration-v1/**`
  - Acceptance:
    - Python RPC client follows Pi LF-delimited JSONL framing and command/response correlation.
    - Python one-shot runner supports print/json headless Pi calls.
    - Workflow commands run through Python and preserve deterministic dry-run/fallback behavior.
    - Evidence manifests include per-step summaries and Pi invocation mode where applicable.

- [x] T-007 Move panel backend/API authority to Python while keeping JS frontend
  - Write set: `src/dadaia_pi/**`, `src/features/panel/**`, `panel/**`, `tests_py/**`, `tests/**`, `specs/releases/python-cli-core-migration-v1/**`
  - Acceptance:
    - Panel API/status data is produced by Python.
    - Browser frontend remains JS/TS only as frontend code.
    - Panel stays loopback-only and read-only unless a future release approves mutations.
    - Smoke test verifies panel renders workspace/context/memory/handoff data from Python backend.

- [x] T-008 Update docs, memory, package metadata, and retire TypeScript lifecycle authority
  - Write set: `README.md`, `package.json`, `src/**`, `scripts/**`, `tests/**`, `specs/memory/**`, `specs/releases/python-cli-core-migration-v1/**`
  - Acceptance:
    - Architecture and tech-stack memory record Python as lifecycle/runtime authority.
    - Docs explain install, CLI, Pi RPC/headless use, trust/approval posture, and JS/TS adapter boundaries.
    - TypeScript lifecycle source is removed, marked legacy, or proven non-authoritative.
    - Remaining JS/TS is limited to Pi-exclusive adapters and browser frontend assets.
    - Python CLI `doctor` reports no mixed-authority drift.

## Review and Closure Tasks

- [x] T-009 Run migration validation and evidence bundle
  - Write set: `.dadaia-pi/reports/dadaia-pi-workspace/**`, `.dadaia-pi/handoff/dadaia-pi-workspace/**`, `specs/releases/python-cli-core-migration-v1/**`
  - Acceptance:
    - Validation evidence records Python tests, bridge tests, workflow smoke, panel smoke, and doctor outputs.
    - Machine-readable handoff references the validation report.

- [x] T-010 Close release and update current-truth memory
  - Write set: `specs/releases/python-cli-core-migration-v1/**`, `specs/memory/**`, `specs/audits/**`
  - Acceptance:
    - `CLOSURE.md` records scope delivered, validation evidence, known risks, and follow-up backlog.
    - Memory reflects current truth only, not historical migration narrative.
    - `ACTIVE.md` advances according to lifecycle rules after closure approval.
