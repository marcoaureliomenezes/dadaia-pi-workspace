# CLOSURE - typescript-runtime-retirement-v1

**Status:** Aprovado

## Summary

The release retired TypeScript lifecycle authority from package command entrypoints while preserving JS/TS for Pi and compatibility surfaces.

Delivered:

- npm `dadaia-pi` bin now points to `bin/dadaia-pi.mjs`.
- `bin/dadaia-pi.mjs` delegates to `python3 -m dadaia_pi`, sets package `src/` in `PYTHONPATH`, and supports `DADAIA_PI_PYTHON` override.
- TypeScript lifecycle directories are marked legacy/non-authoritative with `LEGACY.md` boundary files.
- Python authority doctor checks package bin, Pi extension bridge delegation, and legacy boundary markers.
- README and architecture memory describe Python as runtime authority and JS/TS as Pi/browser/legacy compatibility only.

## Completed tasks

- [x] T-001 Add package bin shim for Python CLI
- [x] T-002 Isolate TypeScript lifecycle source as legacy/non-authoritative
- [x] T-003 Strengthen authority doctor and docs
- [x] T-004 Validate and close release

## Validation

```bash
python3 -m pytest tests_py
# 41 passed

node bin/dadaia-pi.mjs --version
# 0.2.0

node bin/dadaia-pi.mjs status --root . --json
# runtime: python

PYTHONPATH=src python3 -m dadaia_pi specs doctor --specs-dir specs --json
# errors: 0, warnings: 0

PYTHONPATH=src python3 -m dadaia_pi workspace doctor --root ../.. --package-root . --json
# ok: true, mixedAuthorityDrift: []

npm run typecheck
# passed

npm run lint
# passed

node dist/src/cli/main.js specs doctor --specs-dir specs --json
# errors: 0, warnings: 0
```

## Evidence

- Validation report: `.dadaia-pi/reports/dadaia-pi-workspace/validation/20260623T020500Z-typescript-runtime-retirement-validation.md`
- Handoff: `.dadaia-pi/handoff/dadaia-pi-workspace/20260623T020500Z-typescript-runtime-retirement-validation.handoff.json`

## Current-truth memory updates

- `specs/memory/architecture.md` records that npm `dadaia-pi` is now a Node compatibility shim delegating to Python and that TypeScript lifecycle trees are legacy/non-authoritative.

## Known risks

- TypeScript lifecycle source is still present as compatibility/reference code. A later cleanup release can remove it once no adapter tests depend on it.
- Pi extension remains JS/TS because Pi requires JS/TS extension resources.

## Verdict

APPROVED. Runtime command authority is Python; JS/TS is limited to Pi adapter, browser/frontend, and legacy compatibility boundaries.
