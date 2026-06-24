# Release notes - dadaia-pi-workspace 0.2.0

`0.2.0` is the Governance v1 baseline release.

## What operators get

- A frozen Pi-native SDD lifecycle from backlog through archive.
- Workflow phase gates that require APPROVED zero-blocking evidence.
- RC-backed QA/security/code review evidence and pre-push checks.
- Write-set enforcement at commit time and Pi tool-call time.
- Readiness scoring, evidence bundles, panel workflow visibility, and doctor diagnostics.
- Operator docs:
  - `docs/governance-v1-operator-guide.md`
  - `docs/governance-v1-freeze.md`

## Smoke test

After building from source:

```bash
npm run smoke:governance-v1
```

## Packaging note

The npm package includes built CLI files, Pi extension/skills/prompts, README, changelog, release notes, governance docs, and the governance v1 smoke script.
