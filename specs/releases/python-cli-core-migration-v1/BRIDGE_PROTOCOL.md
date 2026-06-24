# Python Pi Bridge Protocol - python-cli-core-migration-v1

The Pi extension is a thin JavaScript adapter. Lifecycle policy authority lives in Python and is reached through:

```bash
python3 -m dadaia_pi pi-bridge <operation>
```

Input is one JSON object on stdin. Output is one JSON object on stdout.

## Common input fields

| Field | Type | Purpose |
|---|---|---|
| `cwd` | string | Workspace root or descendant from the Pi event context. |
| `sessionId` | string | Pi session id from `ctx.sessionManager.getSessionId()`. |
| `pid` | number | Adapter process id for session/lease records. |

## Operations

### `bind`

Input adds `args`, the raw `/dadaia-bind` argument string.

Output includes `message` and `binding`.

### `release`

Releases the session binding. Output includes `message`.

### `status`

Returns concise `message`, full Python `status`, and optional `binding`.

### `bootstrap`

Returns optional `binding` and hidden context-injection `content`.

### `workflow-status`

Returns human-readable workflow status in `message`.

### `tool-check`

Input adds `toolName` and `input` from the Pi `tool_call` event. Output includes:

- `allow: true|false`
- `reason`
- `classifications` when paths are evaluated
- optional `lease`

### `bash-check`

Input adds `command` and `bashCwd` from the Pi `user_bash` event. Output includes `allow` and `reason`.

### `heartbeat`

Returns the current binding without making policy decisions.

## Error behavior

The Python process exits non-zero for malformed bridge operations or expected CLI errors. The JS adapter reports stderr/stdout to Pi UI as an adapter error. Policy denials are successful bridge responses with `allow: false`.
