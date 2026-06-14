---
release: pi-extension-binding-commands
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# SPEC - pi-extension-binding-commands

**Status:** Aprovado

## Problem

`dadaia-pi-workspace` can bind sessions through CLI fallback commands when a session id is supplied, but the primary Pi-native UX should not require operators to manually discover or type Pi session ids. The package extension already knows `ctx.sessionManager.getSessionId()` and can inject context/status, but it lacks full binding lifecycle commands.

## Goal

Add Pi extension commands that bind, release, and inspect the current Pi session using Pi's session manager as the canonical session key.

## Product Requirements

### PR-1: Pi-native bind command

The extension exposes a command to bind the current Pi session.

Acceptance:

- command name: `dadaia-bind`;
- arguments support at minimum: `<context> [--mode read|implementation|review] [--release <id>]`;
- command uses `ctx.sessionManager.getSessionId()`; no manual session id argument is required;
- command writes the same session binding metadata as the CLI fallback;
- implementation/review modes require `--release`;
- success notification includes context, mode, and release when present.

### PR-2: Pi-native release command

The extension exposes a command to release the current Pi session binding.

Acceptance:

- command name: `dadaia-release`;
- command uses `ctx.sessionManager.getSessionId()`;
- command clears session binding metadata and matching pointers through existing service logic;
- success/missing-binding notifications are actionable and non-crashing.

### PR-3: Improved Pi-native status command

The existing extension status command should show useful binding/workspace state.

Acceptance:

- command name remains `dadaia-status`;
- status uses the current Pi session id;
- status reports binding context/mode/release and, where cheap, workspace status summary;
- status does not mutate state.

### PR-4: Context reinjection after bind/release

Binding changes should be visible to subsequent prompts.

Acceptance:

- bind writes bind epoch through `SessionBindingService`;
- `before_agent_start` continues to inject bound context;
- release stops injection for the session;
- READ mode still restricts tools.

### PR-5: Tests and safety

Acceptance:

- extension command handlers are covered with harness-like unit tests or extracted command functions;
- parsing handles missing context, invalid mode, missing release, and unknown flags with clear messages;
- no old multi-harness behavior is introduced.

## Non-Goals

- No new web/TUI surface.
- No new runtime dependency.
- No custom mutating Pi tool.
- No automatic binding without operator command.
