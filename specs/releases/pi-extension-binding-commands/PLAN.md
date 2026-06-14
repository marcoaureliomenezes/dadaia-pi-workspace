---
release: pi-extension-binding-commands
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# PLAN - pi-extension-binding-commands

**Status:** Aprovado

## Architecture Direction

Keep binding behavior in the existing TypeScript domain services. The Pi extension should be a thin adapter that parses command arguments, obtains `ctx.sessionManager.getSessionId()`, calls `SessionBindingService`, and reports through `ctx.ui.notify`.

To make tests deterministic, extract reusable argument parsing and command execution helpers from `extensions/dadaia-pi.ts` or add a small source module that the extension imports.

## Implementation Slices

1. **Command parsing and helper logic**
   - parse `dadaia-bind` arguments;
   - normalize mode and release;
   - produce clear errors for missing context, missing release, and invalid options.

2. **Extension commands**
   - implement `dadaia-bind`;
   - implement `dadaia-release`;
   - improve `dadaia-status` output using current session id and existing status service where practical.

3. **Tests**
   - cover parser/helper behavior;
   - cover bind/release/status command side effects with temp workspace and mocked Pi context;
   - confirm READ mode behavior remains intact.

4. **Documentation and closure**
   - update README command list and package skill guidance;
   - update release closure with validation evidence.

## Validation

```bash
npm run check
node dist/src/cli/main.js specs doctor
node dist/src/cli/main.js status --session-id pi-agent-manual
```

## Risks

- Extension tests may overfit to the current local type shim instead of Pi's real API.
- Status command could become too verbose for notifications.
- Binding in implementation mode could be allowed without release if parser bypasses service rules.

## Risk Controls

- Keep `SessionBindingService` as the authority for validation and writes.
- Keep notifications concise.
- Unit-test missing release and invalid mode paths.
