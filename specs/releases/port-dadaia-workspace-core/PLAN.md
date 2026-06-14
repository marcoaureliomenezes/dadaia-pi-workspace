---
release: port-dadaia-workspace-core
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# PLAN - port-dadaia-workspace-core

**Status:** Aprovado

## Architecture Direction

Port the mature `dadaia-workspace` lifecycle ideas into Pi-native package resources and TypeScript services. Keep the source context read-only. Prefer small, auditable Markdown skills and CLI/doctor validation before adding any persistent server or browser panel.

## Implementation Slices

1. **Source-context research map**
   - inventory relevant `dadaia-workspace` skills, specs, panel views, and known bug anti-patterns;
   - produce a traceability report mapping source ideas to Pi-native target artifacts;
   - classify each candidate as `port-now`, `adapt-later`, or `reject`.

2. **Core skill expansion**
   - rewrite/expand Pi package skills for spec navigation, release definition, task management, implementation, review, closure, handoff emission, and doctor/drift checks;
   - remove placeholder wording and align paths with `.dadaia-pi/**`;
   - add tests that package skills are present, named, and do not contain forbidden multi-harness/projection instructions.

3. **Lifecycle and handoff contracts**
   - define the minimal Pi-native handoff JSON contract;
   - implement handoff/report doctor checks where practical;
   - update memory and docs to describe evidence channels and task marker discipline.

4. **Panel/status decision**
   - research the old panel capabilities;
   - document the Pi-native decision in memory or release artifacts;
   - if implementation is small and safe, add a CLI or extension status surface; otherwise create a backlog item for the panel/TUI surface.

5. **Validation and closure**
   - run build, tests, package validation, specs doctor, and workspace doctor;
   - close the release with evidence and update memory as current truth.

## Validation

Required before implementation completion:

```bash
npm test
npm run build
node dist/src/cli/main.js specs doctor
node dist/src/cli/main.js doctor
```

Additional validation:

- grep package skills for forbidden references to `.dadaia/`, `.claude`, `.codex`, `.opencode`, Claude Code, Codex, and OpenCode except in explicit non-goal/anti-pattern text;
- verify generated/updated skills are included in package manifest/resource checks;
- verify source-context research report exists under `.dadaia-pi/reports/dadaia-pi-workspace/`.

## Risks

- Over-porting old multi-harness assumptions into a Pi-only product.
- Adding a panel too early and expanding security/process scope.
- Duplicating lifecycle truth between skills, constitution, and memory.

## Risk Controls

- Keep constitution as law, memory as current truth, skills as procedures.
- Treat `dadaia-workspace` as read-only reference, not runtime dependency.
- Prefer explicit rejection notes for old concepts rather than silent omissions.
