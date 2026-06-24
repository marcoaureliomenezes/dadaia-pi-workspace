---
release: panel-projects-tab-memory-links
status: closed
---

# CLOSURE - panel-projects-tab-memory-links

**Status:** Fechado

## Summary

Updated the browser panel information architecture so `Overview`, `Contexts`, and `Memory` are merged into a single `Projects` tab. Project-local spec memory is now surfaced as links on each Spec Context Project card instead of as a standalone top-level memory tab.

## Completed tasks

- [x] T-001 Merge Overview/Contexts/Memory into Projects tab with Spec Context memory links

## Behavior now true

- Panel tabs are: `Projects`, `Handoffs`, `Workflows`, `Raw`.
- `Projects` starts with workspace overview cards.
- `Projects` shows Spec Context Project cards.
- Each project card links:
  - `architecture.md` as `Architecture`;
  - `quality-assurance.md` as `quality-assurance`;
  - `product/catalog.json` as product catalog;
  - cataloged product markdown feature files.
- Added `/spec-memory?context=<name>&file=<allowed>` for required memory file inspection.

## Memory updates performed

- README updated with Projects tab behavior.
- Product memory updated with Projects tab behavior.

## Validation

- `npm run build` — passed.
- `npm test` — passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `node dist/src/cli/main.js specs doctor` — passed.
- workspace `doctor --json` — passed.

## Live panel evidence

Panel restarted at:

```text
http://127.0.0.1:5124/
```

Verified live HTML has `Projects` tab and no `Memory` tab.
