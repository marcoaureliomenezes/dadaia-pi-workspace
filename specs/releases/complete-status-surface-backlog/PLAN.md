---
release: complete-status-surface-backlog
status: Aprovado
owner: product-engineer
created: 2026-06-14
---

# PLAN - complete-status-surface-backlog

**Status:** Aprovado

## Plan

1. Add memory navigation service and CLI commands.
2. Add `/dadaia-panel` extension command with optional TUI custom component fallback.
3. Add tests for memory CLI/service.
4. Update backlog and closure.

## Validation

```bash
npm run check
node dist/src/cli/main.js specs doctor
```
