# dadaia-pi-workspace — DEPRECATED (folded into dadaia-workspace)

> **Status: superseded.** PI (`@earendil-works/pi-coding-agent`) is now an
> officially supported harness **inside dadaia-workspace**, not a separate
> project. This standalone PoC is retired and kept only for history/evidence.

## Where PI Lives Now

PI is a first-class harness of `dadaia-workspace` across both agentic layers:

- **Layer 1 (entry harness).** Launch `pi` in a dadaia-workspace; it reads the
  workspace-root `AGENTS.md` natively and the projected `.pi/` surface
  (`dadaia public install --target pi`).
- **Layer 2 (worker harness).** `dadaia lifecycle ... --harness pi` /
  `--step-harness <phase>=pi` drives PI behind `AgentRuntimePort` via
  `pi --mode json` (`PiHeadlessAdapter`).

## Tracking

- EPIC: `repos/dadaia-workspace/specs/backlog/pi-agent-fourth-harness.md`
- Release consuming this residual: `dadaia-workspace` v0.1.38 alpha-1
- Earlier PI slices: `pi-fourth-harness-v1`, v0.1.18-v0.1.21, and v0.1.30.

Do not start new work here. Use `dadaia-workspace`.
