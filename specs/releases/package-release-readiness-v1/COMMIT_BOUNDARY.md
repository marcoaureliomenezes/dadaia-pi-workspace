# Commit boundary recommendation

Recommended logical commit groups for the accumulated governance/package work:

1. `workflow-core-governance`
   - `src/features/workflows/**`
   - `src/cli/main.ts`
   - `tests/workflows.test.ts`

2. `hooks-extension-write-gates`
   - `src/features/hooks/**`
   - `extensions/dadaia-pi.ts`
   - `tests/hooks.test.ts`

3. `doctor-panel-visibility`
   - `src/features/doctor/**`
   - `src/features/panel/**`

4. `docs-package-stabilization`
   - `README.md`
   - `CHANGELOG.md`
   - `RELEASE_NOTES.md`
   - `docs/**`
   - `scripts/governance-v1-smoke.mjs`
   - `package.json`
   - `src/core/version.ts`

5. `sdd-release-memory-evidence`
   - `specs/releases/**`
   - `specs/memory/**`
   - `.dadaia-pi/evidence-bundles/**`
   - `.dadaia-pi/reports/**`

No commits were created by the agent; this is a boundary recommendation for operator review.
