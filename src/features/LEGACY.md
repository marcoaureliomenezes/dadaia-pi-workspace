# Legacy TypeScript lifecycle features

TypeScript feature modules in this tree are retained only as migration reference and compatibility test surface.

Python under `src/dadaia_pi/**` is the lifecycle/runtime authority for context, specs, memory, gates, hooks, handoffs, workflows, panel backend, and doctor behavior.

Do not implement new lifecycle policy here. New behavior must be implemented in Python and reached from JS/TS only through adapter calls.
