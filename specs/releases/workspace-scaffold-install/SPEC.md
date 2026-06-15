---
release: workspace-scaffold-install
status: Aprovado
owner: product-engineer
created: 2026-06-15
---

# SPEC - workspace-scaffold-install

**Status:** Aprovado

## Problem

`dadaia-pi-workspace` must behave like `dadaia-workspace`: users install the package, enter a normal folder, and run a scaffold/install command that creates an instantiated workspace. Package resources alone are not enough; workspace-local skills, prompts, AGENTS.md, scoped AGENTS.md, runtime state, and drift repair must be reproducibly generated.

## Goal

Add a Pi-only workspace scaffold/install/doctor flow that copies package-owned public resources into the instantiated workspace without symlinks.

## Requirements

- `dadaia-pi workspace init [--package-root <path>] [--skip-assets]` creates `.dadaia-pi/`, `.pi/`, `.agents/skills/`, `repos/`, root `AGENTS.md`, and scoped `.dadaia-pi/**/AGENTS.md`.
- `dadaia-pi workspace install [--package-root <path>] [--force]` stages package resources into `.dadaia-pi/agentic/**` and projects them to workspace roots:
  - skills: `.agents/skills/**`
  - prompts: `.pi/prompts/**`
  - package settings: `.pi/settings.json`
  - root/scoped AGENTS.md
- `dadaia-pi workspace doctor [--package-root <path>]` detects missing/drifted staged/projected package-owned resources.
- No symlinks.
- Install is idempotent, hash-aware, and prunes stale managed skill/prompt projections.
