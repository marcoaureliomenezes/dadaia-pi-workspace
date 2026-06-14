---
name: dadaia-pi-workspace
description: Operate a Pi-native SDD workspace with Spec Context Projects, session binding, release gates, leases, evidence channels, and package resources.
---

# Dadaia Pi Workspace

Use this umbrella skill when managing a `dadaia-pi-workspace` consumer workspace or the product repository itself.

## Core Model

- Workspace root owns `.dadaia-pi/**` runtime state and `repos/**` managed repositories.
- Each Spec Context Project is one repository plus one canonical `specs/` tree.
- Pi sessions bind to one context, mode, and optional release.
- Production work flows through approved SPEC, PLAN, TASKS, task reservation, implementation, review, and closure.
- Additive evidence can proceed in parallel; mutating work is serialized per context.

## Skill Routing

- Load context/release: `dadaia-spec-navigator`.
- Define release: `dadaia-spec-definition`.
- Reserve/manage tasks: `dadaia-task-manager`.
- Implement: `dadaia-implementation`.
- Review: `dadaia-review`.
- Emit handoff: `dadaia-handoff-emitter`.
- Validate/drift check: `dadaia-doctor`.
- Close release: `dadaia-closure`.

## Operating Rules

1. Read workspace/repo `AGENTS.md` and active `specs/constitution.md` before implementation work.
2. Treat `specs/memory/**` as current product truth, not release history.
3. Do not edit production files unless active SPEC/PLAN/TASKS are approved and a task is `[-]`.
4. Keep reports, handoffs, and audits in separate channels.
5. Be explicit that Pi trust loads executable resources; it is not a sandbox.

## Useful Commands

```bash
node dist/src/cli/main.js doctor
node dist/src/cli/main.js specs doctor
node dist/src/cli/main.js context list
node dist/src/cli/main.js context status --session-id <id>
# In Pi after package load: /dadaia-bind <context> [--mode read|implementation|review] [--release <id>]
# In Pi after package load: /dadaia-status
# In Pi after package load: /dadaia-release
npm test
npm run build
```
