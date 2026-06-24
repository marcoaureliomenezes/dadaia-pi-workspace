---
release: rc-range-integrity-rich-verdict
status: approved
---

# SPEC - rc-range-integrity-rich-verdict

**Status:** Aprovado

## Scope

1. Enforce RC commit-range correctness for pre-push workflow security approval.
2. Add cross-reference integrity doctor checks for workflow manifests, linked handoffs, and RC records.
3. Add richer review verdict schema and gate on no blocking findings.

## Acceptance

- Pre-push maps pushed SHAs to release candidates by git commit range.
- Pre-push requires an APPROVED `security-review` manifest tied to the matching RC.
- Pre-push blocks commits outside any approved RC unless a legacy commit-SHA security handoff approves that exact SHA.
- Doctor checks manifest linked handoff existence/backlinks, RC review manifest existence, manifest RC record existence, release phase/evidence consistency, and orphan workflow handoffs.
- Workflow manifests include verdict fields: `findings`, `blockingFindings`, `risk`, `reviewedPaths`, `acceptanceCoverage`.
- Governance gates require APPROVED verdict and zero blocking findings.
