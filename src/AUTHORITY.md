# Runtime authority boundary

Current authority for development lifecycle behavior is Python under `src/dadaia_pi/**`.

JavaScript/TypeScript under `src/**` and `extensions/**` is retained only for:

- Pi package/extension adapters that must run inside Pi's JavaScript runtime;
- browser/front-end or compatibility code during migration;
- legacy TypeScript tests and build checks while parity is verified.

Do not add new lifecycle policy to TypeScript. New scaffold, context, specs, memory, gate, hook, workflow, handoff, status, and panel-backend behavior belongs in Python and should be exposed to JS only through the documented bridge or CLI subprocess calls.
