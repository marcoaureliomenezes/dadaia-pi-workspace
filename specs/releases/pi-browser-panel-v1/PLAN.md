---
release: pi-browser-panel-v1
status: approved
---

# PLAN - pi-browser-panel-v1

**Status:** Aprovado

1. Add `features/panel` Node HTTP server with read-only HTML/API routes.
2. Add CLI command `dadaia-pi panel` with loopback-only bind, default port 4999, browser launch, and `--no-open`.
3. Change `/dadaia-panel` Pi extension command to spawn the CLI panel server.
4. Add panel tests for health, HTML, status API, and loopback-only bind.
5. Update README, backlog, memory catalog, and closure.
6. Validate with `npm run check`, `specs doctor`, and live server probe.
