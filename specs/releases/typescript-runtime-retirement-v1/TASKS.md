# TASKS - typescript-runtime-retirement-v1

**Status:** Aprovado

## Implementation Tasks

- [x] T-001 Add package bin shim for Python CLI
  - Write set: `bin/**`, `package.json`, `tests_py/**`, `README.md`, `specs/releases/typescript-runtime-retirement-v1/**`
  - Acceptance:
    - npm `bin` delegates to `python3 -m dadaia_pi`.
    - Shim supports `DADAIA_PI_PYTHON` override and sets `PYTHONPATH` to package `src/`.
    - Tests/smoke prove shim reaches Python CLI.

- [x] T-002 Isolate TypeScript lifecycle source as legacy/non-authoritative
  - Write set: `src/**`, `tests/**`, `package.json`, `README.md`, `specs/releases/typescript-runtime-retirement-v1/**`
  - Acceptance:
    - TypeScript lifecycle CLI is no longer documented or invoked as authority.
    - Remaining JS/TS is clearly adapter/frontend/legacy compatibility.
    - Typecheck remains meaningful for retained surfaces.

- [x] T-003 Strengthen authority doctor and docs
  - Write set: `src/dadaia_pi/**`, `tests_py/**`, `README.md`, `specs/memory/**`, `specs/releases/typescript-runtime-retirement-v1/**`
  - Acceptance:
    - Python doctor flags JS/TS lifecycle authority drift.
    - Docs and memory record Python runtime and JS/TS Pi/browser-only boundary.

- [x] T-004 Validate and close release
  - Write set: `.dadaia-pi/reports/dadaia-pi-workspace/**`, `.dadaia-pi/handoff/dadaia-pi-workspace/**`, `specs/releases/typescript-runtime-retirement-v1/**`, `specs/memory/**`
  - Acceptance:
    - Validation evidence exists.
    - `CLOSURE.md` records final state and follow-up merge-prep work.
