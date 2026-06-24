# PLAN - dadaia-workspace-pi-merge-prep-v1

**Status:** Aprovado

## Approach

Treat `dadaia-workspace` as a read-only source context. Produce merge-prep artifacts in `dadaia-pi-workspace` that a later implementation release in `dadaia-workspace` can consume.

## Slices

1. Source-context research:
   - read `repos/dadaia-workspace/AGENTS.md`, constitution, architecture memory, tech stack, product memory, and relevant public asset docs;
   - inspect module layout and public asset surface.
2. Compatibility matrix:
   - map Pi runtime modules to target `dadaia_workspace/**` layers;
   - map `.dadaia-pi/**` state to `.dadaia/**` state;
   - map Pi skills/prompts/extensions to `public/**` and harness projection conventions.
3. Pi harness adapter contract:
   - define runtime name, package/extension bridge, trust model, events, commands, and RPC/headless boundaries;
   - define how Pi differs honestly from Claude/Codex/OpenCode enforcement.
4. Merge file map:
   - classify each current Python module/resource as `port`, `adapt`, `keep-standalone`, or `discard`;
   - name target directories in `dadaia-workspace`.
5. Evidence and memory:
   - write report and handoff under `.dadaia-pi/**`;
   - update current-truth memory with merge-prep posture only.

## Validation

- `python3 -m pytest tests_py`
- `PYTHONPATH=src python3 -m dadaia_pi specs doctor --specs-dir specs --json`
- `node bin/dadaia-pi.mjs status --root . --json`
- `npm run typecheck`
- `node dist/src/cli/main.js specs doctor --specs-dir specs --json`

## Risks

| Risk | Control |
|---|---|
| Accidentally mutating `dadaia-workspace` | Treat it as read-only; write only reports/handoffs in `.dadaia-pi/**` and specs in this repo |
| Merge plan drifts from target architecture | Cite target architecture/constitution in the report |
| Pi trust model misrepresented | Preserve no-sandbox language and distinguish trust from isolation |
