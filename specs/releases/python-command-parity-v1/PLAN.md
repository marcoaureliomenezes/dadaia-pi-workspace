# PLAN - python-command-parity-v1

**Status:** Aprovado

## Approach

Implement parity by command family. Keep Python as the authority, preserve existing state schemas, and use the TypeScript implementation only as a behavioral reference. Each slice adds Python code, CLI wiring, tests, and doctor/readiness coverage where relevant.

## Slices

### Slice 1 - Handoff parity

- Add Python handoff validation, listing, and security approval helpers.
- Preserve schema-versioned JSON handoff format.
- Validate required fields, verdict tokens, artifact structure, and context/release consistency.
- Add CLI commands under `handoff`.

### Slice 2 - Workflow governance parity

- Port lifecycle phase model and gate requirements to Python.
- Implement `workflow status` and `workflow advance`.
- Detect APPROVED zero-blocking workflow manifests for required gates.
- Update `ACTIVE.md` only through validated phase transitions.

### Slice 3 - Release candidates and review coverage

- Port RC storage under `.dadaia-pi/release-candidates/<context>/<release>/`.
- Implement RC create/list/inspect.
- Resolve commit ranges and changed files through git when possible.
- Track QA/security/code review manifest references.

### Slice 4 - Patch apply and write-set enforcement

- Implement controlled patch application in Python.
- Require `--approve`.
- Validate all patch paths against the active reserved task write set.
- Support full-file content and exact oldText/newText operations first; reject unsupported diff constructs with clear errors unless fully implemented.
- Emit patch audit evidence under `.dadaia-pi/reports/<context>/patches/`.

### Slice 5 - Evidence bundle, readiness, and backlog hygiene

- Implement `workflow evidence bundle` with optional prune.
- Implement `workflow readiness` summarizing phase, gates, RC coverage, doctor issues, pre-push readiness, closure readiness, and score.
- Implement backlog-check and backlog-consume without deleting evidence.

### Slice 6 - Richer Python doctor

- Add workflow manifest validation.
- Add release candidate validation.
- Add linked handoff validation/back-reference checks.
- Add active phase/evidence consistency checks.
- Add authority boundary drift checks.

### Slice 7 - Documentation and parity evidence

- Update README and memory only as current truth.
- Record parity evidence in reports/handoffs.
- Keep TypeScript as compatibility/adapter code until the later retirement release.

## Validation

- `python3 -m pytest tests_py`
- `PYTHONPATH=src python3 -m dadaia_pi specs doctor --specs-dir specs --json`
- `PYTHONPATH=src python3 -m dadaia_pi workspace doctor --root ../.. --package-root . --json`
- Python CLI smoke for each newly ported command family.
- `npm run typecheck`
- `npm run lint`
- `node dist/src/cli/main.js specs doctor --specs-dir specs --json`

## Risks and Controls

| Risk | Control |
|---|---|
| Parity gaps hidden by shallow tests | Add fixture-based tests for success and failure paths per command family |
| State schema divergence | Reuse existing `.dadaia-pi/**` paths and add doctor checks before schema changes |
| Patch apply causes unsafe writes | Require `--approve`, validate reserved task write set, and emit patch audit evidence |
| Governance transition bugs | Table-driven phase/gate tests |
| Premature TypeScript deletion | Keep retirement for a later release after parity evidence is complete |
