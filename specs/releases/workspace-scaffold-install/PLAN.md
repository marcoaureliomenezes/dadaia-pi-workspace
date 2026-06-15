---
release: workspace-scaffold-install
status: Aprovado
owner: product-engineer
created: 2026-06-15
---

# PLAN - workspace-scaffold-install

**Status:** Aprovado

## Plan

1. Add workspace scaffold service for init/install/doctor.
2. Add CLI `workspace init|install|doctor`.
3. Add tests with sandbox temp workspaces.
4. Use the command to repair `/home/marco/workspace/pi-agent`.
5. Close release with validation evidence.

## Validation

```bash
npm run check
node dist/src/cli/main.js workspace doctor --package-root .
```
