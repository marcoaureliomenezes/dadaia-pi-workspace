# SPEC - python-cli-core-migration-v1

**Status:** Aprovado

## Problem

`dadaia-pi-workspace` currently implements the CLI, lifecycle services, SDD gate policy, workspace scaffolding, Spec Context management, workflow orchestration, and panel backend in TypeScript/Node. The operator requires the development lifecycle product runtime to be Python-first because the Pi SDK does not provide a Python embedding API and the project should be operable through a Python CLI that calls Pi via RPC or headless subprocess modes.

The product must preserve Pi-native behavior where Pi requires JavaScript/TypeScript resources, but those resources must become thin adapters only. Lifecycle authority must move to Python.

## Scope

- Introduce a Python package and Python `dadaia-pi` CLI as the primary command surface.
- Move lifecycle/domain authority from TypeScript to Python for:
  - workspace scaffold, install, doctor, and package-resource projection;
  - Spec Context registry and ALIVE/DEAD lifecycle;
  - session binding and release status resolution;
  - specs scaffold/doctor and release artifact validation;
  - memory catalog/list/show navigation;
  - SDD path classification, gate decisions, leases, and hook checks;
  - handoff validation/listing/security helper logic;
  - workflow lifecycle orchestration and evidence generation;
  - status output and panel backend API data.
- Add a Python Pi integration layer that can call Pi through:
  - RPC mode for multi-step/headless lifecycle workflows and event streaming;
  - print/json headless mode for one-shot model steps.
- Keep JavaScript/TypeScript only where technically required:
  - Pi extension entrypoint and event handlers;
  - Pi slash-command registration;
  - Pi `tool_call`, `user_bash`, context/session hooks;
  - browser frontend assets for the panel.
- Ensure JS/TS Pi-exclusive code delegates policy decisions to Python through a stable JSON bridge protocol.
- Preserve existing `.dadaia-pi/**` state compatibility unless explicitly migrated by a documented, doctor-checked migration.
- Preserve the current Pi trust/security posture: package resources and project-local `.pi/**` are executable code, not sandboxed content.

## Non-Goals

- Do not remove Pi as the only supported agent harness.
- Do not add Claude Code, Codex, OpenCode, or multi-harness projections.
- Do not claim Pi RPC or headless modes provide sandboxing.
- Do not rewrite skills or prompts into Python; Markdown resources remain Pi package resources.
- Do not require a long-running Python daemon in v1; subprocess JSON bridge is acceptable and preferred initially.
- Do not preserve TypeScript as an equal source of lifecycle truth after migration.

## Product Behavior

### Python CLI authority

Operators run `dadaia-pi` as a Python console script. The Python CLI is the canonical implementation for development lifecycle commands. Existing command names and JSON output contracts should remain stable where practical so current workflows, docs, hooks, and panel calls continue to work.

### Python/Pi execution model

When lifecycle workflows need Pi reasoning, Python starts Pi in a documented mode:

- `pi --mode rpc` for multi-turn workflows, streaming events, extension UI protocol support, and command/event correlation;
- `pi -p` or `pi --mode json -p` for one-shot prompts where streaming control is not needed.

Non-interactive Pi calls must explicitly handle trust behavior. The product may pass `--approve` only when the operator or workflow explicitly requests loading trusted project resources.

### Thin Pi adapter

The Pi extension must remain minimal. It may register commands and receive Pi events, but it must not duplicate lifecycle policy. For gate checks and context injection, it serializes a request to Python and applies the Python decision.

### Panel split

The browser frontend may remain JavaScript/TypeScript because it runs in the browser. The panel backend/API should be Python-owned unless a small JS launcher is required by package compatibility. Panel mutations remain out of scope unless explicitly specified by a future release.

## Acceptance Criteria

- A Python package exists with a console script named `dadaia-pi`.
- Python implements parity for the core read/status commands before the TypeScript CLI is retired.
- Python implements parity for scaffold/context/specs/memory/gate/hook/workflow/handoff commands before those TypeScript implementations stop being authoritative.
- A documented JSON bridge protocol exists for Pi extension-to-Python calls.
- Pi-exclusive JS/TS code is reduced to thin adapter/front-end responsibilities and contains no independent lifecycle policy decisions.
- Python can invoke Pi through RPC and one-shot headless modes with tests or smoke coverage for command framing and event handling.
- `.dadaia-pi/**` state files created by existing releases remain readable by the Python implementation.
- Doctor/status validation reports the active runtime authority and flags unsupported mixed-authority drift.
- Documentation and memory updates state that Python is the product runtime and JS/TS is retained only for Pi extension/browser surfaces.
- Validation evidence includes Python tests, bridge contract tests, and at least one end-to-end command smoke path.
