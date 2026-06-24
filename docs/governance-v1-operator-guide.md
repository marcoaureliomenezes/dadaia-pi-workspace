# Governance v1 Operator Guide

Governance v1 is the stable Pi-native lifecycle baseline for `dadaia-pi-workspace`. Its purpose is to make the correct path easier than improvisation and to make unsafe lifecycle shortcuts visible.

## How to use the workflow lifecycle

Every production change should move through the same loop:

1. Select or create a Spec Context Project.
2. Define an approved release with `SPEC.md`, `PLAN.md`, and `TASKS.md`.
3. Run `spec-review` and advance to `IMPLEMENTATION` only after an APPROVED zero-blocking verdict.
4. Reserve exactly one task as `[-]` with a bounded `Write set:`.
5. Implement only inside that write set.
6. Run implementation, QA, security, and code review workflows.
7. Create or inspect a release candidate and check readiness.
8. Bundle evidence.
9. Close and archive the release.

## Happy path from backlog to archive

```bash
# Bind the session
dadaia-pi context bind <context> --session-id "$DADAIA_PI_SESSION_ID" --mode implementation --release <release>

# Review release definition
dadaia-pi workflow run spec-review --context <context> --release <release> --dry-run --verdict APPROVED
dadaia-pi workflow advance --context <context> --release <release> --to IMPLEMENTATION

# Reserve one TASKS.md item as [-], with Write set.
# Implement, validate, then run implementation evidence.
dadaia-pi workflow run implementation-task --context <context> --release <release> --dry-run --verdict APPROVED
dadaia-pi workflow advance --context <context> --release <release> --to QA_REVIEW

# Create RC and reviews
dadaia-pi workflow rc create --context <context> --release <release> --rc-id rc-1 --from HEAD~1 --to HEAD
dadaia-pi workflow run qa-review --context <context> --release <release> --rc-id rc-1 --dry-run --verdict APPROVED
dadaia-pi workflow advance --context <context> --release <release> --to SECURITY_REVIEW
dadaia-pi workflow run security-review --context <context> --release <release> --rc-id rc-1 --dry-run --verdict APPROVED
dadaia-pi workflow advance --context <context> --release <release> --to CODE_REVIEW
dadaia-pi workflow run code-review --context <context> --release <release> --rc-id rc-1 --dry-run --verdict APPROVED

# Readiness and bundle
dadaia-pi workflow readiness --context <context> --release <release>
dadaia-pi workflow evidence bundle --context <context> --release <release>

# Close
dadaia-pi workflow advance --context <context> --release <release> --to CLOSURE
dadaia-pi workflow run release-closure --context <context> --release <release> --dry-run --verdict APPROVED
dadaia-pi workflow advance --context <context> --release <release> --to ARCHIVED
```

## How to recover when blocked

- **Missing phase gate**: run `dadaia-pi workflow status --context <context> --release <release>` and satisfy the listed missing workflow.
- **Write-set block**: edit only the active `[-]` task's `Write set:` or reserve the correct task. Do not bypass pre-commit or extension gates.
- **RC/security block**: inspect the RC with `workflow rc inspect`; recreate the RC if HEAD moved outside the approved range.
- **Doctor errors**: run `dadaia-pi doctor --json`, fix structural evidence links before adding new work.
- **Strict JSON review failure**: rerun the non-dry-run review with parseable JSON verdict output, or use explicit operator `--verdict` only when intentionally overriding with human approval.
- **Backlog conflict**: resolve or mark `supersedes` / `conflicts_with` before release definition.

## Commands by phase

| Phase | Primary commands |
| --- | --- |
| BACKLOG | `workflow backlog-check`, `workflow backlog-consume` |
| RELEASE_DEFINITION | create/update `SPEC.md`, `PLAN.md`, `TASKS.md` |
| SPEC_REVIEW | `workflow run spec-review`, `workflow advance ... --to IMPLEMENTATION` |
| IMPLEMENTATION | reserve `[-]`, implement, `workflow run implementation-task` |
| QA_REVIEW | `workflow rc create`, `workflow run qa-review` |
| SECURITY_REVIEW | `workflow run security-review`, pre-push checks |
| CODE_REVIEW | `workflow run code-review`, `workflow readiness` |
| CLOSURE | `workflow evidence bundle`, `workflow run release-closure` |
| ARCHIVED | no production mutation; use new backlog/release for future governance changes |
