# Changelog

## 0.2.0 - Governance v1 baseline

### Added

- Deterministic lifecycle workflow orchestration with phase gates.
- Structured rich verdicts, strict JSON review mode, workflow evidence, handoffs, and release candidates.
- RC commit-range pre-push security checks.
- Task write-set enforcement in pre-commit and Pi extension tool calls.
- Workspace doctor workflow/RC/handoff integrity and semantic coverage checks.
- Workflow readiness and immutable release evidence bundles.
- Controlled patch application with path validation and unified diff support.
- Browser panel workflow visibility and read-only action APIs.
- Governance v1 operator guide, freeze policy, and regression smoke script.

### Changed

- Package release now includes governance docs and smoke script assets.
- Governance v1 is frozen: new governance capabilities require a backlog item or approved release definition.

### Validation

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run smoke:governance-v1`
- `dadaia-pi workspace doctor`
