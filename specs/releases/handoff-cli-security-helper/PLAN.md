---
release: handoff-cli-security-helper
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# PLAN - handoff-cli-security-helper

**Status:** Aprovado

## Direction

Implement a small `src/features/handoff/**` service and expose it through `src/cli/main.ts`. Reuse `validateHandoffRecord` from `src/core/handoff.ts`.

## Slices

1. Handoff service
   - validate file;
   - list handoff files;
   - emit security approval JSON.

2. CLI command
   - `handoff validate`;
   - `handoff list`;
   - `handoff approve-security`.

3. Tests and docs
   - add temp-workspace tests;
   - update README useful commands;
   - close release with validation evidence.

## Validation

```bash
npm run check
node dist/src/cli/main.js specs doctor
```
