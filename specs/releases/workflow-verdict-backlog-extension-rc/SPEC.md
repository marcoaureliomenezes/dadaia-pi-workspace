---
release: workflow-verdict-backlog-extension-rc
status: approved
---

# SPEC - workflow-verdict-backlog-extension-rc

**Status:** Aprovado

## Problem

Workflow governance has phase gates and exact write-set checks, but it still lacks structured verdicts, backlog hygiene, Pi extension workflow enforcement, and release-candidate review mapping.

## Scope

Implement four governance upgrades in one release:

1. Structured workflow verdicts, APPROVED-only phase advancement, and handoff/manifest linkage.
2. Backlog/release hygiene: conflict detection, grill-me records, release backlog consumption, and stale backlog cleanup markers.
3. Pi extension workflow enforcement: inject workflow status, expose workflow status command, and block mutating tool calls when phase/evidence gates do not allow implementation.
4. Release candidate model: RC IDs, commit ranges, and QA/security/code review mapping to RCs.

## Requirements

- Workflow manifests include structured verdict data and linked handoff paths.
- Phase gates require matching workflow evidence with `verdict: APPROVED`.
- Handoff files may satisfy/link evidence when they reference workflow run IDs and approved verdicts.
- Backlog check CLI detects textual duplicate/conflict candidates and records grill-me questions.
- Release consumption CLI marks backlog items consumed by a release without deleting evidence.
- Extension bootstrap includes workflow status for bound release.
- Extension blocks implementation mutating writes unless active phase is `IMPLEMENTATION` and spec-review evidence is approved.
- Release candidate CLI can create/list RC records with commit ranges.
- Workflow runs can reference an RC ID; QA/security/code review manifests record that RC.

## Acceptance

- Tests cover verdict-gated advancement, backlog conflict/consumption, RC create/list and review mapping.
- Extension source includes workflow status injection and implementation mutating gate.
- Existing validation passes.
