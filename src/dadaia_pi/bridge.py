"""JSON bridge used by the tiny Pi JavaScript extension."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from .context import read_binding
from .context_mutation import bind_context, release_context
from .errors import DadaiaError
from .gate import evaluate_gate, infer_bash_target_paths
from .status import build_status
from .workspace import discover_workspace

READ_MODE_TOOLS = ["read", "grep", "find", "ls", "bash"]


def _split_args(input_text: str) -> list[str]:
    return [match.group(1) or match.group(2) or match.group(3) or "" for match in re.finditer(r'"([^"]*)"|\'([^\']*)\'|(\S+)', input_text)]


def _parse_bind_args(args: str) -> dict[str, str | None]:
    tokens = _split_args(args)
    if not tokens:
        raise DadaiaError("/dadaia-bind requires <context>", code="BRIDGE_USAGE", exit_code=2)
    context = tokens[0]
    mode: str | None = None
    release: str | None = None
    idx = 1
    while idx < len(tokens):
        token = tokens[idx]
        if token == "--mode":
            idx += 1
            if idx >= len(tokens):
                raise DadaiaError("--mode requires a value", code="BRIDGE_USAGE", exit_code=2)
            mode = tokens[idx]
        elif token == "--release":
            idx += 1
            if idx >= len(tokens):
                raise DadaiaError("--release requires a value", code="BRIDGE_USAGE", exit_code=2)
            release = tokens[idx]
        else:
            raise DadaiaError(f"Unknown /dadaia-bind argument: {token}", code="BRIDGE_USAGE", exit_code=2)
        idx += 1
    return {"context": context, "mode": mode, "release": release}


def _context_repo_slug(workspace_root: Path, context: str) -> str:
    payload = json.loads((workspace_root / ".dadaia-pi" / "states" / "spec_contexts.json").read_text(encoding="utf-8"))
    for item in payload.get("contexts", []):
        if item.get("name") == context:
            return str(item.get("repoSlug", context))
    return context


def _read_optional(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None


def _workflow_status(workspace_root: Path, binding: dict[str, Any]) -> str:
    slug = _context_repo_slug(workspace_root, str(binding["context"]))
    active = _read_optional(workspace_root / "repos" / slug / "specs" / "releases" / "ACTIVE.md") or ""
    phase = re.search(r"^phase:\s*(.+)$", active, flags=re.MULTILINE)
    release = binding.get("release") or (re.search(r"^release:\s*(.+)$", active, flags=re.MULTILINE) or [None, "none"])[1]
    return "\n".join([
        f"workflow_phase: {phase.group(1).strip() if phase else 'unknown'}",
        f"workflow_release: {release or 'none'}",
        "policy_authority: python bridge",
    ])


def _bootstrap(workspace_root: Path, binding: dict[str, Any]) -> str:
    slug = _context_repo_slug(workspace_root, str(binding["context"]))
    repo = workspace_root / "repos" / slug
    parts = [
        "=== dadaia-pi workspace memory bootstrap ===",
        f"context: {binding.get('context')}",
        f"mode: {binding.get('mode')}",
        f"release: {binding.get('release', 'none')}",
        "policy_authority: python bridge",
        "--- constitution.md ---",
        _read_optional(repo / "specs" / "constitution.md") or "(missing constitution.md)",
        "--- memory/tech-stack.md ---",
        _read_optional(repo / "specs" / "memory" / "tech-stack.md") or "(missing memory/tech-stack.md)",
        "--- memory/product/catalog.json ---",
        _read_optional(repo / "specs" / "memory" / "product" / "catalog.json") or "(missing memory/product/catalog.json)",
        "--- workflow status ---",
        _workflow_status(workspace_root, binding),
        "=== end dadaia-pi workspace memory bootstrap ===",
    ]
    return "\n".join(parts)


def _tool_targets(cwd: Path, tool_name: str, input_value: Any) -> list[str]:
    if isinstance(input_value, dict) and tool_name in {"write", "edit"} and isinstance(input_value.get("path"), str):
        return [str(cwd / input_value["path"])]
    return []


def _suspicious_shell(command: str) -> str | None:
    if re.search(r"\b(?:python|python3|node|perl|ruby)\s+-[ce]\b", command):
        return "inline interpreter execution is not allowed for implementation mutations; use workflow patch apply"
    if re.search(r"<<[-~]?\s*['\"]?\w+", command):
        return "heredoc shell mutation is not allowed; use workflow patch apply"
    if re.search(r"\b(?:sh|bash|zsh)\s+[^;&|]+\.(?:sh|bash|zsh)\b", command):
        return "script execution is not allowed for implementation mutations without explicit patch workflow"
    return None


def handle(operation: str, payload: dict[str, Any]) -> dict[str, Any]:
    cwd = Path(str(payload.get("cwd") or os.getcwd())).resolve()
    workspace = discover_workspace(cwd)
    session_id = str(payload.get("sessionId") or "")

    if operation == "bind":
        parsed = _parse_bind_args(str(payload.get("args") or ""))
        record = bind_context(workspace, str(parsed["context"]), session_id=session_id, mode=parsed["mode"], release=parsed["release"], pid=int(payload.get("pid") or os.getpid()))
        return {"ok": True, "message": f"bound {session_id} to {record['context']} [{record['mode']}]", "binding": record}
    if operation == "release":
        binding = read_binding(workspace, session_id)
        release_context(workspace, session_id)
        return {"ok": True, "message": f"released {session_id} from {(binding or {}).get('context', 'no binding')}"}
    if operation == "status":
        binding = read_binding(workspace, session_id)
        status = build_status(workspace, session_id=session_id)
        message = f"bound to {binding['context']} [{binding['mode']}]" if binding else "no dadaia-pi binding"
        return {"ok": True, "message": message, "status": status, "binding": binding}
    if operation == "bootstrap":
        binding = read_binding(workspace, session_id)
        return {"ok": True, "binding": binding, "content": _bootstrap(workspace.root, binding) if binding else ""}
    if operation == "workflow-status":
        binding = read_binding(workspace, session_id)
        return {"ok": True, "message": _workflow_status(workspace.root, binding) if binding else "no dadaia-pi binding"}
    if operation == "tool-check":
        targets = _tool_targets(cwd, str(payload.get("toolName") or ""), payload.get("input"))
        if not targets:
            return {"ok": True, "allow": True, "reason": "no target paths"}
        decision = evaluate_gate(workspace, session_id=session_id, target_paths=targets, pid=int(payload.get("pid") or os.getpid()))
        return {"ok": True, **decision}
    if operation == "bash-check":
        binding = read_binding(workspace, session_id)
        command = str(payload.get("command") or "")
        if binding and binding.get("mode") == "BOUND_IMPLEMENTATION":
            suspicious = _suspicious_shell(command)
            if suspicious:
                return {"ok": True, "allow": False, "reason": suspicious}
        targets = infer_bash_target_paths(Path(str(payload.get("bashCwd") or cwd)), command)
        if not targets:
            return {"ok": True, "allow": True, "reason": "no target paths"}
        decision = evaluate_gate(workspace, session_id=session_id, target_paths=targets, pid=int(payload.get("pid") or os.getpid()))
        return {"ok": True, **decision}
    if operation == "heartbeat":
        binding = read_binding(workspace, session_id)
        return {"ok": True, "binding": binding}
    raise DadaiaError(f"Unknown bridge operation: {operation}", code="BRIDGE_USAGE", exit_code=2)


def run_bridge(argv: list[str]) -> int:
    if not argv:
        raise DadaiaError("pi-bridge requires an operation", code="BRIDGE_USAGE", exit_code=2)
    payload = json.loads(sys.stdin.read() or "{}")
    result = handle(argv[0], payload)
    sys.stdout.write(json.dumps(result, indent=2) + "\n")
    return 0
