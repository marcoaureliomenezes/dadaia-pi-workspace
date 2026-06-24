---
release: panel-projects-tab-memory-links
status: approved
---
# SPEC - panel-projects-tab-memory-links

**Status:** Aprovado

## Scope

Adjust browser panel navigation and information architecture:

- Merge `Overview`, `Contexts`, and `Memory` into one tab named `Projects`.
- Remove the standalone Memory tab.
- Show a small workspace overview layer first.
- Show Spec Context Project cards under the overview.
- Each Spec Context card must link/reference required memory files from that project's specs:
  - `specs/memory/architecture.md` alias `Architecture`.
  - `specs/memory/quality-assurance.md` alias `quality-assurance`.
  - `specs/memory/product/catalog.json` as product catalog.
  - product memory markdown files mapped by the catalog.
- Keep memory as project-local spec files, not a separate top-level panel concept.

## Acceptance

- Panel has a `Projects` tab and no standalone `Memory` tab.
- Projects tab contains workspace overview cards and context/project cards.
- Project cards include links to architecture, quality-assurance, product catalog, and product feature memory atoms.
- Existing `/api/memory` and `/memory/<slug>` can remain as implementation detail links/API.
- Panel tests assert the new tab shape.
