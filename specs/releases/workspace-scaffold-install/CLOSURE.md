---
release: workspace-scaffold-install
status: Aprovado
closed: 2026-06-15
---

# CLOSURE - workspace-scaffold-install

**Status:** Aprovado

## Summary

Brought the `dadaia-workspace` scaffold/stage/install/drift principle into `dadaia-pi-workspace` for Pi-only instantiated workspaces.

## Completed Tasks

- [x] T-001 Workspace scaffold/install/doctor
- [x] T-002 Closure and instantiated workspace repair

## Shipped Commands

```bash
dadaia-pi workspace init [--package-root <path>] [--skip-assets] [--json]
dadaia-pi workspace install [--package-root <path>] [--json]
dadaia-pi workspace doctor [--package-root <path>] [--json]
```

## Shipped Behavior

- Creates instantiated workspace structure: `.dadaia-pi/`, `.pi/`, `.agents/skills/`, `repos/`, root `AGENTS.md`, scoped `.dadaia-pi/**/AGENTS.md`.
- Stages package skills/prompts under `.dadaia-pi/agentic/**`.
- Projects skills to `.agents/skills/**` and prompts to `.pi/prompts/**`.
- Writes `.pi/settings.json` for package loading.
- Writes `.dadaia-pi/agentic/manifest.json`.
- Detects source→stage and stage→projection drift.
- Uses copies and hash comparison; no symlinks.

## Evidence

Research report:

- `.dadaia-pi/reports/dadaia-pi-workspace/research/20260614T235738Z-dadaia-workspace-scaffold-analysis.md`

Validation:

```bash
npm run check
npm run build
node dist/src/cli/main.js workspace install --package-root repos/dadaia-pi-workspace
node dist/src/cli/main.js workspace doctor --package-root repos/dadaia-pi-workspace
node dist/src/cli/main.js doctor
```

Results:

- lint/typecheck/tests: pass
- tests: 45 tests, 15 suites, 0 failures
- instantiated workspace install: pass
- workspace install doctor: pass
- workspace doctor: pass

## Instantiated Workspace Repaired

`/home/marco/workspace/pi-agent` now has package-managed, generated workspace resources:

- `.agents/skills/**`
- `.pi/prompts/**`
- `.dadaia-pi/agentic/**`
- root `AGENTS.md`
- scoped `.dadaia-pi/**/AGENTS.md`

## Known Risks

- Pi-specific sub-agent runtime projection is not implemented because Pi's current documented package/skills surface does not define Claude/Codex-style subagent files. Core behavior is exposed through skills, prompts, extension commands, and status panel.
