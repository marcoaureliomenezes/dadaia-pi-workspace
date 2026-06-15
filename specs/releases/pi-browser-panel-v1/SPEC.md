---
release: pi-browser-panel-v1
status: approved
---

# SPEC - pi-browser-panel-v1

**Status:** Aprovado

## Problem

The operator requires a `dadaia-workspace`-style local browser panel server, not only CLI status or a Pi TUI overlay.

## Scope

Implement a Pi-native local panel command:

```bash
dadaia-pi panel [--port <port>] [--bind 127.0.0.1] [--no-open]
```

## Requirements

- Start an HTTP server bound to `127.0.0.1` by default.
- Default port is `4999`, matching the current `dadaia-workspace` panel default.
- Print `Panel running at http://127.0.0.1:<port>/` when ready.
- Open the browser by default; `--no-open` disables browser launch.
- Reject non-loopback bind addresses.
- Serve read-only routes:
  - `/`
  - `/health`
  - `/api/panel-status`
  - `/api/status`
  - `/api/contexts`
  - `/api/memory`
  - `/api/handoffs`
- Update `/dadaia-panel` to launch the server instead of only showing a TUI overlay.
- No mutation endpoints.
- No Claude/Codex/OpenCode runtime projection behavior.

## Acceptance

- Unit/integration tests prove the server serves health, HTML, and status APIs.
- Non-loopback bind is rejected.
- `npm run check` passes.
