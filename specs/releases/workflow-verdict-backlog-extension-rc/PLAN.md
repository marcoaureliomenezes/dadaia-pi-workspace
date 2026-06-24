---
release: workflow-verdict-backlog-extension-rc
status: approved
---

# PLAN - workflow-verdict-backlog-extension-rc

**Status:** Aprovado

1. Extend workflow manifest/run input with verdict, linked handoffs, and release candidate fields.
2. Update governance gates to require APPROVED verdicts and consume linked handoffs when present.
3. Add backlog hygiene module and CLI commands for check and consume.
4. Add release candidate store and CLI commands.
5. Update Pi extension with workflow status command, context injection, and implementation mutating gate.
6. Add tests and update memory/docs.
7. Validate with build, tests, lint, typecheck, and specs doctor.
