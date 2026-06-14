---
specs_pattern_version: 1
---

# Constitution - dadaia-pi-workspace

This document is the permanent product law for `dadaia-pi-workspace`. It governs
the product we are building: a Pi-only, SDD-native workspace for managing many
Spec Context Projects with persistent memory, disciplined release work, and
mechanical safeguards.

## 0. Identity

`dadaia-pi-workspace` is not a projection of `dadaia-workspace` into another
harness. It is a new Pi-native product that preserves the core ideas:

- one repository can be governed by one canonical `specs/` tree;
- agents work from constitution plus memory, not from re-derived context;
- production changes flow through SPEC, PLAN, TASKS, implementation, review,
  and closure;
- additive evidence work can run in parallel;
- mutating work is serialized per Spec Context Project.

The product targets only Pi Coding Agent. It must not ship Claude Code, Codex, or
OpenCode projections, compatibility shims, model rosters, hooks, or instructions.

## 1. Pi-Native Surface

Pi is the only supported agent harness. The user-facing installable surface is a
Pi package plus a CLI:

- package-root `extensions/**` or manifest-declared packaged Pi extensions for
  context injection, tool-call/user-bash gating, commands, and optional TUI
  affordances;
- package-root `skills/**` for on-demand SDD workflows and reference procedures;
- package-root `prompts/**` for repeatable slash-command prompt templates;
- consumer `.pi/settings.json` and optional `.pi/**` local resources only when the
  project has been explicitly trusted by Pi;
- root and scoped `AGENTS.md` files for instructions that Pi loads regardless of
  project trust;
- a TypeScript CLI for workspace/context/spec lifecycle commands.

Project-local Pi resources and Pi packages are trusted-code inputs. They must be
minimal, auditable, and documented because Pi runs them with the permissions of
the local user. First-run docs must state that non-interactive Pi modes do not
prompt for trust and require an existing trust decision or an explicit `--approve`
when project resources must load.

## 2. Spec Context Project

A Spec Context Project is the central unit of the product: one canonical `specs/`
folder bound to one repository.

Each context has:

- a stable name;
- a repository slug under `repos/`;
- a repo URL;
- state `ALIVE` or `DEAD`;
- a current branch;
- a canonical `specs/` tree containing `constitution.md`, `memory/`,
  `backlog/`, `bugs/`, `audits/`, and `releases/`.

Binding a Pi session to a context creates the value chain:

1. Bind: select the active context, mode, and release for the Pi session.
2. Inject: add that context's constitution, tech-stack, memory catalog, and
   selected memory atoms to Pi context.
3. Enforce: block or warn on writes that violate SDD path class, phase, or lease.
4. Parallelize: allow independent contexts and additive evidence to progress
   without corrupting mutating work.

## 3. Workspace Layout

The workspace root may contain only:

- `.dadaia-pi/` for operational state, sessions, locks, reports, handoffs, logs,
  and temp files;
- `.pi/` for Pi project-local resources;
- `repos/` for ALIVE context repositories;
- `AGENTS.md` for root Pi-readable rules;
- `README.md`, `LICENSE`, and package/tooling files required by the product
  repository itself.

`.dadaia-pi/` is workspace state. It must never be created inside a managed
context repo. Tool caches, temporary files, reports, handoffs, and runtime state
belong under `.dadaia-pi/`, not loose at root and not inside `repos/<slug>/`.

## 4. Memory Is Current Truth

`specs/memory/**` describes the current product truth. It is not a changelog.
Historical detail belongs in release `CLOSURE.md` and archived releases.

The authoritative memory areas are:

- `specs/memory/architecture.md`;
- `specs/memory/tech-stack.md`;
- `specs/memory/quality-assurance.md`;
- `specs/memory/product/index.md`;
- one `specs/memory/product/<slug>.md` atom per product capability;
- `specs/memory/product/catalog.json` as the generated or maintained feature
  index for lazy self-pull.

Memory writes are allowed only during definition or closure work and must be done
by the product/spec owner for the release.

## 5. SDD Is Binding

No production change is valid without:

- `specs/releases/ACTIVE.md` pointing at an active release;
- `SPEC.md`, `PLAN.md`, and `TASKS.md` containing `**Status:** Aprovado`;
- an implementation task marked `[-]`;
- every changed production path listed in that task's write set.

Specs are written before implementation. A spec may be corrected when reality
changes, but it must not be edited after the fact to justify code already written.

Canonical status tokens are `Draft`, `Em revisao`, and `Aprovado`.

## 6. Lifecycle

Every action belongs to one phase:

| # | Phase | Primary owner | Writes to | Activity |
|---|---|---|---|---|
| 1 | Backlog definition | operator or product steward | `specs/backlog/**` | ADDITIVE |
| 2 | Bug filing | any agent or operator | `specs/bugs/**` | ADDITIVE |
| 3 | Research | operator-directed Pi session | `.dadaia-pi/reports/**` or `specs/audits/**` | ADDITIVE |
| 4 | Release definition | product steward | `specs/releases/<id>/**` | MUTATING |
| 5 | Implementation | implementation Pi session | production source and tests | MUTATING |
| 6 | Review | reviewer Pi session or operator | `.dadaia-pi/handoff/**`, `.dadaia-pi/reports/**`, `specs/audits/**` | ADDITIVE |
| 7 | Closure | product steward | `CLOSURE.md`, `ACTIVE.md`, `specs/memory/**` | MUTATING |

ADDITIVE work never takes a mutating lease. MUTATING work is serialized by exactly
one active lease per Spec Context Project.

## 7. Pi Enforcement Model

The primary deterministic enforcer is a Pi extension. It must use Pi-native
events, especially context injection before agent execution and `tool_call`
interception for write-like tools.

The extension enforces:

- context injection on session start, bind, resume, and relevant prompts using
  documented Pi events such as `session_start`, `before_agent_start`, and
  `context`;
- path classification for tool calls: ADDITIVE, MEMORY, FROZEN, MUTATING,
  PROTECTED;
- interception of `user_bash` because user-entered shell commands can mutate
  outside the LLM tool-call path;
- READ mode as non-acquiring, with active-tool restriction as a first layer and
  gate enforcement as the backstop;
- one MUTATING lease per context;
- heartbeat on session/tool activity using Pi session identity;
- clear block reasons and no silent mutation.

The extension is not the only boundary. Git chokepoints are required because shell
commands and external tools can modify files outside Pi's tool-call envelope:

- pre-commit validates context lease and active task for mutating paths;
- pre-push validates required review/security evidence for pushed commits;
- doctor commands validate state coherence after the fact.

The product must be honest about bypasses. Git hooks can be bypassed with
`--no-verify`; Pi resources load only after trust decisions; Pi has no built-in
sandbox. The docs and prompts must say this plainly.

## 8. Concurrency

Each Spec Context Project has one MUTATING lease. The lease record lives under
`.dadaia-pi/states/ctx_locks/<context>.json` and records at minimum:

- context;
- release;
- Pi session id;
- mode;
- process id when available;
- acquired timestamp;
- heartbeat timestamp;
- TTL.

The product must implement reclaim-iff-stale and yield-iff-live-foreign:

- a stale or dead holder can be reclaimed automatically;
- a live foreign holder blocks mutating writes with an actionable message;
- additive writes continue while another session owns the mutating lease.

## 9. Reports And Handoffs

There are three communication channels:

- human reports: `.dadaia-pi/reports/<context>/<role-or-session>/`;
- machine handoffs: `.dadaia-pi/handoff/<context>/`;
- committed audits: `specs/audits/<YYYYMMDDTHHMMSSZ>-<session_id_8>/`.

Parallel additive files and directories must include a UTC timestamp and an
8-character session discriminator to avoid collisions. Machine handoffs must be
JSON, schema-versioned, and capable of referencing a human/report/audit artifact
by workspace-relative path plus content hash.

These channels must not be merged. Handoffs are machine-readable; reports are for
humans; audits are committed project evidence.

## 10. Technology Law

The product is TypeScript-first because Pi extensions and packages are TypeScript
surfaces. Node.js is the primary runtime. Shell is allowed only for git hook
wrappers when a Node entrypoint is not viable.

New runtime dependencies require a release spec that explains the need, the
security posture, and why the standard library or existing dependency is
insufficient.

## 11. Security Law

Pi runs local tools, extensions, and installed packages with the launching user's
permissions. Therefore:

- never represent Pi project trust as a sandbox;
- never store secrets in specs, prompts, logs, reports, or committed settings;
- project-local `.pi` resources must be auditable and minimal;
- third-party Pi packages are executable code and require operator trust;
- untrusted repos and unattended automation must run in a container, VM, or other
  OS-level boundary.

## 12. Anti-Slop Law

Every product artifact must have a lifecycle purpose. No extension, skill,
prompt, command, state file, or report format is allowed unless the constitution
or an approved release says which phase it supports.

No fact is maintained in two places. The constitution owns law; memory owns
current product truth; release files own planned and historical change; code owns
implementation.
