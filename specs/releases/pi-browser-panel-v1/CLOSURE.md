---
release: pi-browser-panel-v1
status: approved
closed: 2026-06-15
---

# CLOSURE - pi-browser-panel-v1

## Summary

Implemented the missing `dadaia-workspace`-style local browser panel server for `dadaia-pi-workspace`.

## Shipped

```bash
dadaia-pi panel [--port <port>] [--bind 127.0.0.1] [--no-open]
```

Default URL:

```text
http://127.0.0.1:4999/
```

Routes:

- `/`
- `/health`
- `/api/panel-status`
- `/api/status`
- `/api/contexts`
- `/api/memory`
- `/api/handoffs`

The `/dadaia-panel` Pi extension command now launches the browser panel server instead of only rendering a TUI overlay.

## Security/process boundary

- loopback-only bind (`127.0.0.1`);
- non-loopback binds rejected;
- read-only APIs only;
- no mutation endpoints;
- no Claude/Codex/OpenCode runtime projection behavior.

## Validation

```bash
npm run check
node dist/src/cli/main.js specs doctor
node repos/dadaia-pi-workspace/dist/src/cli/main.js panel --no-open --port 5123
GET http://127.0.0.1:5123/health
```

Results:

- lint/typecheck/tests: pass
- tests: 47 tests, 16 suites, 0 failures
- specs doctor: pass
- live health probe: `{"status":"ok","version":"0.1.0","root":"/home/marco/workspace/pi-agent"}`
