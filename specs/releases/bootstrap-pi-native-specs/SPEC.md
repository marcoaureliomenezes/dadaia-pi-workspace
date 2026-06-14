---
release: bootstrap-pi-native-specs
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# SPEC - bootstrap-pi-native-specs

**Status:** Aprovado

## Problem

`dadaia-pi-workspace` needs a precise foundation before implementation starts.
The product must reuse the important ideas from `dadaia-workspace` while avoiding
the wrong architecture: multi-harness projection, Claude/Codex/OpenCode parity,
and harness-specific compatibility code that Pi does not need.

## Official Pi Facts Used

- Pi is a minimal terminal coding harness extended through TypeScript
  extensions, skills, prompt templates, themes, and packages.
- Pi loads `AGENTS.md` or `CLAUDE.md` context files from global, parent, and
  current directories.
- Project-local `.pi` resources load only after project trust.
- Extensions can register tools, commands, UI, session persistence, and event
  handlers; `tool_call` can block a tool call.
- Pi has no built-in sandbox; extensions and tools run with local user
  permissions.
- Pi supports interactive, print/JSON, RPC, and SDK modes.

References:

- https://pi.dev/docs/latest
- https://pi.dev/docs/latest/usage
- https://pi.dev/docs/latest/security
- https://pi.dev/docs/latest/extensions
- https://pi.dev/docs/latest/skills
- https://pi.dev/docs/latest/prompt-templates
- https://pi.dev/docs/latest/packages
- https://pi.dev/docs/latest/sdk

## Scope

This release defines the initial product law and implementation target:

- replace scaffold placeholders with a Pi-native constitution;
- define architecture, tech stack, QA, product catalog, and core product atoms;
- define the first implementation plan for the actual tool;
- establish SDD release artifacts so future production work has an approved gate.

## Product Requirements

### PR-1: Pi Only

The product supports only Pi Coding Agent. It must not include Claude Code,
Codex, or OpenCode runtime projections.

Acceptance:

- constitution states Pi-only scope and non-goals;
- architecture names Pi resources as the only agentic surface;
- tech stack is TypeScript/Node/Pi oriented.

### PR-2: Spec Context Projects

The product keeps the Spec Context Project concept: one canonical `specs/` tree
bound to one repository.

Acceptance:

- memory defines Spec Context Project lifecycle;
- constitution defines bind -> inject -> enforce -> parallelize;
- release plan includes registry and ALIVE/DEAD lifecycle implementation.

### PR-3: SDD Lifecycle

The product keeps SDD gates: SPEC, PLAN, TASKS, task reservation, implementation,
review, and closure.

Acceptance:

- constitution defines lifecycle phases and path ownership;
- QA memory defines required evidence;
- PLAN/TASKS define implementation tasks for scaffold, gate, lease, and Pi
  extension work.

### PR-4: Pi-Native Enforcement

The product enforces through Pi extensions and git chokepoints.

Acceptance:

- architecture defines extension event responsibilities;
- lifecycle law describes git hook boundaries;
- tasks include tool-call gate and pre-commit/pre-push hooks.

### PR-5: Honest Security

The product must document Pi's trust model honestly.

Acceptance:

- constitution states Pi is not a sandbox;
- tech stack forbids committed secrets and machine-local credentials;
- QA requires security-sensitive behavior tests or documented manual checks.

## Non-Goals

- No implementation code in this spec pass.
- No migration from existing `dadaia-workspace`.
- No multi-agent roster copied from `dadaia-workspace`.
- No panel UI in the first implementation release.
- No support for other AI harnesses.

## Risks

- Pi APIs may evolve; implementation must pin documented behavior and keep
  compatibility notes in memory.
- Tool-call interception does not cover arbitrary external file changes; git
  hooks and doctor checks are mandatory backstops.
- Project-local `.pi` resources require trust; first-run docs must make this
  explicit.
