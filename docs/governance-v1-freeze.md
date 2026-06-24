# Governance v1 Freeze

Governance v1 is frozen as the baseline lifecycle contract for `dadaia-pi-workspace`.

## Included in governance v1

- Spec Context Project binding and lease-aware sessions.
- Release phases from `BACKLOG` through `ARCHIVED`.
- Workflow manifests/reports for lifecycle evidence.
- APPROVED zero-blocking verdict gates.
- Strict JSON verdict mode for non-dry-run review workflows.
- Task write-set enforcement in pre-commit and Pi extension tool calls.
- RC records, commit ranges, review mapping, and pre-push security range checks.
- Doctor validation for workflow, handoff, RC, phase, and coverage evidence.
- Evidence bundles and readiness summaries.
- Controlled patch application with path validation.
- Read-only panel visibility and safe read-only action APIs.
- Structured backlog hygiene checks and deterministic conflict detection.

## Explicitly out of scope for governance v1

- OS-level sandboxing of shell execution.
- Perfect semantic understanding of backlog conflicts.
- Automatic product decisions without operator approval.
- Auto-mutating browser panel actions.
- Arbitrary patch formats beyond controlled JSON operations and unified diffs.
- Guaranteed SDK provider availability.
- Rewriting historical evidence after bundle creation.

## Freeze rule

No new governance feature may be implemented unless there is a backlog item or approved release definition that states:

1. the operator pain being solved;
2. the bypass or ambiguity being closed;
3. the deterministic gate or evidence channel being added;
4. how the change avoids increasing normal operator friction.

Small bug fixes and documentation clarifications may happen inside maintenance releases, but new gates, lifecycle phases, evidence schemas, shell restrictions, and panel capabilities require explicit backlog/release approval.

## Maintenance policy

- Prefer fixing confusing docs before adding new gates.
- Prefer readiness/doctor diagnostics before adding blocking behavior.
- Prefer controlled CLI paths over free-form shell behavior.
- Keep generated projections installable by `dadaia-pi workspace install`; do not hand-edit generated projections.
