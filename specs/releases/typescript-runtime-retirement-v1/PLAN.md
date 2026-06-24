# PLAN - typescript-runtime-retirement-v1

**Status:** Aprovado

## Approach

Retire authority in layers: first route package commands through Python, then isolate TypeScript legacy code, then tighten doctor/docs to prevent regression.

## Slices

1. Add a Node bin shim that executes `python3 -m dadaia_pi` with `PYTHONPATH` pointed at package `src/`.
2. Update `package.json` `bin` and files to publish the Python runtime and shim.
3. Keep TypeScript build/typecheck scoped to Pi extension/adapter compatibility where feasible.
4. Mark old TypeScript lifecycle tree as legacy/non-authoritative or remove command access to it.
5. Strengthen authority doctor checks.
6. Update README and memory.
7. Validate Python CLI, Pi bridge, panel, package metadata, and adapter typecheck.

## Validation

- `python3 -m pytest tests_py`
- `PYTHONPATH=src python3 -m dadaia_pi specs doctor --specs-dir specs --json`
- package bin smoke through the shim
- `npm run typecheck`
- `npm run lint`
- workspace doctor from instantiated root

## Risks

| Risk | Control |
|---|---|
| npm package users expect Node CLI | Provide a Node shim that delegates to Python and clear Python requirement docs |
| Pi extension cannot find Python runtime | Shim/extension set `PYTHONPATH` to package `src/`; docs mention `DADAIA_PI_PYTHON` override |
| Premature deletion breaks adapter tests | Isolate first, delete in a later cleanup if needed |
