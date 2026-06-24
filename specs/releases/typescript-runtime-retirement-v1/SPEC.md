# SPEC - typescript-runtime-retirement-v1

**Status:** Aprovado

## Problem

Python now owns the lifecycle/runtime command surface, but the repository still contains a large TypeScript CLI/domain implementation and npm `bin` still points at the Node CLI. This creates mixed-authority risk and delays the future merge path where Pi support becomes a harness inside `dadaia-workspace`.

## Scope

- Retire TypeScript as lifecycle authority.
- Make package command entrypoints delegate to Python.
- Keep JavaScript/TypeScript only for Pi extension essentials and browser/panel frontend compatibility.
- Preserve Pi package resource loading for `extensions/`, `skills/`, and `prompts/`.
- Keep Python command parity and state schemas intact.
- Add doctor/readme guidance that new lifecycle logic belongs in Python only.

## Non-Goals

- Do not add Claude Code, Codex, or OpenCode support in this repo.
- Do not merge into `dadaia-workspace` yet.
- Do not remove Pi extension JS/TS code required by Pi.
- Do not remove browser/frontend JS if still needed for panel UX.

## Acceptance Criteria

- `dadaia-pi` package/bin execution reaches the Python CLI, not the TypeScript lifecycle CLI.
- TypeScript lifecycle source is marked legacy, isolated, or removed from authoritative command paths.
- Pi extension remains a thin adapter that calls Python bridge.
- Python tests pass.
- TypeScript adapter typecheck passes for remaining JS/TS surfaces.
- Docs and memory describe JS/TS as Pi/browser-only.
- Doctor reports no mixed-authority drift for the intended boundary.
