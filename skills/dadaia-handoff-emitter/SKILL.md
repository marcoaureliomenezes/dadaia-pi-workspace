---
name: dadaia-handoff-emitter
description: Emit machine-readable dadaia-pi-workspace handoff JSON under .dadaia-pi/handoff/<context>/ for agent-to-agent lifecycle evidence.
---

# Dadaia Handoff Emitter

Use at the end of implementation, review, research, or closure work when another agent, reviewer, or operator needs structured evidence.

## Location

Write handoffs under:

```text
.dadaia-pi/handoff/<context>/<YYYYMMDDTHHMMSSZ>-<session8>-<slug>.handoff.json
```

Human-readable reports, when needed, belong under `.dadaia-pi/reports/<context>/...` and may be referenced by the handoff.

## Minimal Schema

```json
{
  "schemaVersion": 1,
  "context": "dadaia-pi-workspace",
  "sessionId": "pi-session-id-or-fallback",
  "agent": "software-engineer",
  "producedAt": "2026-06-14T20:00:00Z",
  "scope": "T-002 core lifecycle skills",
  "artifact": { "type": "handoff" },
  "metrics": {},
  "findings": [],
  "next": { "agent": "reviewer", "action": "review" }
}
```

## Required Fields

- `schemaVersion`: number, currently `1`.
- `context`: Spec Context Project name.
- `sessionId`: Pi session id or explicit fallback id.
- `agent`: producing role or skill.
- `producedAt`: ISO UTC timestamp ending in `Z`.
- `scope`: release, task, path, or review scope.
- `artifact.type`: `handoff`, `report`, `spec`, `plan`, `tasks`, `closure`, `memory`, or `other`.
- `metrics`: object, even if empty.
- `findings`: array, even if empty.

## Optional Fields

- `release`: active release id.
- `verdict`: `APPROVED`, `REJECTED`, or `NEEDS_CHANGES` for reviewers.
- `artifact.path`: workspace-relative report/audit path.
- `artifact.sha256`: lowercase SHA-256 when `artifact.path` is present.
- `decisionsRequired`: array of operator decisions.
- `next`: next expected agent/action.

## Guardrails

- Do not put handoffs in reports directories.
- Do not reference a report path unless the file exists.
- Do not include secrets, credentials, private hostnames, or local trust files.
- Keep handoffs machine-readable JSON; put long prose in a report and reference it.
