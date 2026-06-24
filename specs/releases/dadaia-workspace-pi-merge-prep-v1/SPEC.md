# SPEC - dadaia-workspace-pi-merge-prep-v1

**Status:** Aprovado

## Problem

`dadaia-pi-workspace` is now Python-first and uses TypeScript/JavaScript only for Pi extension essentials and browser/frontend compatibility. The next product goal is to merge Pi support into the broader `dadaia-workspace`, which already supports Claude Code, Codex, and OpenCode. Before that merge, this repository must produce a concrete compatibility map and migration package that aligns Pi concepts, state, commands, package resources, and enforcement semantics with `dadaia-workspace` without mutating the `dadaia-workspace` source repository.

## Scope

- Research `dadaia-workspace` as a read-only source context.
- Map concepts between `dadaia-pi-workspace` and `dadaia-workspace`:
  - workspace/runtime state: `.dadaia-pi/**` vs `.dadaia/**`;
  - context registry and session binding;
  - SDD gates, leases, hooks/chokepoints;
  - report/handoff/evidence channels;
  - workflow/governance phases;
  - package/public asset surfaces.
- Define the target Pi harness adapter contract for `dadaia-workspace`.
- Identify source files/resources in `dadaia-pi-workspace` that should move, adapt, or be discarded.
- Produce migration artifacts under this repo only:
  - merge-prep report;
  - machine handoff;
  - compatibility matrix;
  - proposed target file map for `dadaia-workspace`.
- Update current-truth memory in this repo to record merge-readiness posture.

## Non-Goals

- Do not edit `repos/dadaia-workspace/**` production source in this release.
- Do not implement Pi support inside `dadaia-workspace` yet.
- Do not reintroduce Claude Code, Codex, or OpenCode projections into `dadaia-pi-workspace`.
- Do not remove the standalone Pi package before the target merge release exists.
- Do not change `.dadaia-pi/**` schemas without an explicit migration plan.

## Acceptance Criteria

- A read-only source-context report compares `dadaia-workspace` and `dadaia-pi-workspace` architectures.
- A compatibility matrix maps commands/state/resources from Pi workspace to target `dadaia-workspace` modules.
- A Pi harness adapter contract is documented, including extension bridge, package resources, trust posture, and RPC/headless behavior.
- A proposed merge file map identifies Python modules, JS/TS adapter files, skills/prompts, and docs to port.
- A machine-readable handoff points future work to the merge-prep artifacts.
- Python tests and specs doctor pass after documentation/memory updates.
