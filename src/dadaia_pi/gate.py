"""SDD path classification, leases, policy, and write-set helpers."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .context import list_contexts, read_binding, show_context
from .errors import DadaiaError
from .file_ops import write_json_atomic
from .workspace import Workspace

PATH_ORDER = ["PROTECTED", "FROZEN", "MEMORY", "MUTATING", "ADDITIVE", "UNGATED"]


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize(path: str) -> str:
    return path.replace("\\", "/").removeprefix("./")


def classify_relative(relative_path: str) -> str:
    rp = normalize(relative_path)
    if rp.startswith(".dadaia-pi/sessions/") or rp.startswith(".dadaia-pi/states/"):
        return "PROTECTED"
    if rp.startswith(("specs/backlog/", "specs/bugs/", "specs/audits/", ".dadaia-pi/reports/", ".dadaia-pi/handoff/", ".dadaia-pi/tmp/")):
        return "ADDITIVE"
    if rp.startswith("specs/memory/"):
        return "MEMORY"
    if rp.startswith("specs/_archive/"):
        return "FROZEN"
    if rp.startswith("specs/releases/") or rp.startswith("specs/"):
        return "MUTATING"
    return "UNGATED"


def strip_repos_prefix(path: str) -> tuple[str | None, str]:
    parts = normalize(path).split("/")
    if len(parts) >= 2 and parts[0] == "repos":
        return parts[1], "/".join(parts[2:])
    return None, normalize(path)


def classify_path(workspace: Workspace, target_path: str | Path) -> dict[str, Any]:
    target = Path(target_path)
    try:
        cwd_relative = normalize(str(target.resolve().relative_to(workspace.root)))
    except Exception:
        cwd_relative = normalize(str(target_path))
    context, rel = strip_repos_prefix(cwd_relative)
    path_class = classify_relative(rel)
    if context and path_class == "UNGATED" and rel:
        path_class = "MUTATING"
    result = {"path": str(target_path), "relativePath": rel, "pathClass": path_class}
    if context:
        result["context"] = context
    return result


def classify_many(workspace: Workspace, paths: list[str]) -> list[dict[str, Any]]:
    return [classify_path(workspace, path) for path in paths]


def infer_bash_target_paths(cwd: str | Path, command: str) -> list[str]:
    paths: set[str] = set()
    for match in re.finditer(r"(?:^|\s)(?:>|>>|2>|&>)\s*([^\s;&|]+)", command):
        paths.add(str(Path(cwd) / match.group(1).strip().strip('"\'')))
    for match in re.finditer(r"\b(?:touch|rm|mv|cp|mkdir|rmdir)\s+([^;&|]+)", command):
        for raw in match.group(1).split():
            token = raw.strip().strip('"\'')
            if token and not token.startswith("-"):
                paths.add(str(Path(cwd) / token))
    return sorted(paths)


def _lease_path(workspace: Workspace, context: str) -> Path:
    return workspace.states_dir / "ctx_locks" / f"{context}.json"


def read_lease(workspace: Workspace, context: str) -> dict[str, Any] | None:
    path = _lease_path(workspace, context)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def is_stale(record: dict[str, Any], at: datetime | None = None) -> bool:
    heartbeat = record.get("heartbeat")
    try:
        hb = datetime.fromisoformat(str(heartbeat).replace("Z", "+00:00"))
    except ValueError:
        return True
    ttl = int(record.get("ttlSeconds", 120))
    current = at or datetime.now(timezone.utc)
    if (current - hb).total_seconds() <= ttl:
        return False
    pid = record.get("pid")
    return not (isinstance(pid, int) and _pid_alive(pid))


def acquire_lease(workspace: Workspace, *, context: str, release: str, session_id: str, mode: str, pid: int | None = None, ttl_seconds: int = 120) -> dict[str, Any]:
    existing = read_lease(workspace, context)
    if existing and existing.get("sessionId") != session_id and not is_stale(existing):
        return {"status": "HELD", "record": existing}
    timestamp = now()
    status = "RENEWED" if existing and existing.get("sessionId") == session_id else "RECLAIMED" if existing else "ACQUIRED"
    record = {
        "context": context,
        "release": release,
        "sessionId": session_id,
        "mode": mode,
        "acquiredAt": existing.get("acquiredAt") if existing and existing.get("sessionId") == session_id else timestamp,
        "heartbeat": timestamp,
        "ttlSeconds": ttl_seconds,
    }
    if pid is not None:
        record["pid"] = pid
    write_json_atomic(_lease_path(workspace, context), record)
    index = workspace.states_dir / "ctx_locks" / "by-session" / f"{session_id}.json"
    contexts: set[str] = set()
    if index.exists():
        try:
            contexts.update(json.loads(index.read_text(encoding="utf-8")))
        except Exception:
            pass
    contexts.add(context)
    write_json_atomic(index, sorted(contexts))
    return {"status": status, "record": record}


def release_lease(workspace: Workspace, context: str, session_id: str) -> bool:
    record = read_lease(workspace, context)
    if not record or record.get("sessionId") != session_id:
        return False
    _lease_path(workspace, context).unlink(missing_ok=True)
    return True


def evaluate_gate(workspace: Workspace, *, session_id: str, target_paths: list[str], release: str | None = None, pid: int | None = None) -> dict[str, Any]:
    classifications = classify_many(workspace, target_paths)
    if not classifications:
        return {"allow": True, "reason": "no target paths", "classifications": classifications}
    top = sorted(classifications, key=lambda item: PATH_ORDER.index(item["pathClass"]))[0]
    if top["pathClass"] == "PROTECTED":
        return {"allow": False, "reason": f"protected path: {top['relativePath']}", "classifications": classifications}
    if top["pathClass"] == "FROZEN":
        return {"allow": False, "reason": f"frozen path: {top['relativePath']}", "classifications": classifications}
    if top["pathClass"] in {"ADDITIVE", "UNGATED"}:
        return {"allow": True, "reason": "additive or ungated path", "classifications": classifications}
    binding = read_binding(workspace, session_id)
    mode = (binding or {}).get("mode", "BOUND_IMPLEMENTATION")
    if mode == "READ":
        return {"allow": False, "reason": "READ mode is non-acquiring for mutating writes", "classifications": classifications}
    context_name = top.get("context") or (binding or {}).get("context")
    if not context_name:
        return {"allow": False, "reason": "cannot resolve context for mutating path", "classifications": classifications}
    context = show_context(workspace, str(context_name))
    selected_release = release or (binding or {}).get("release")
    if mode in {"BOUND_IMPLEMENTATION", "BOUND_REVIEW"} and not selected_release:
        return {"allow": False, "reason": f"{mode} requires release", "classifications": classifications}
    lease = acquire_lease(workspace, context=context["name"], release=selected_release or "unbound", session_id=session_id, mode=mode, pid=pid)
    if lease["status"] == "HELD":
        return {"allow": False, "reason": f"context {context['name']} held by {lease['record']['sessionId']}", "classifications": classifications}
    return {"allow": True, "reason": f"{lease['status'].lower()} lease for {context['name']}", "classifications": classifications, "lease": lease}


def pattern_to_regex(pattern: str) -> re.Pattern[str]:
    source = re.escape(normalize(pattern)).replace(r"\*\*", ".*").replace(r"\*", "[^/]*")
    return re.compile(f"^{source}$")


def matches_write_set(path: str, patterns: list[str]) -> bool:
    normalized = normalize(path)
    return any(pattern_to_regex(pattern).match(normalized) for pattern in patterns)


def parse_reserved_task_write_set(tasks_text: str) -> dict[str, Any] | None:
    lines = tasks_text.splitlines()
    reserved = [(idx, line) for idx, line in enumerate(lines) if line.startswith("- [-] ")]
    if len(reserved) != 1:
        return None
    index, task_line = reserved[0]
    end = next((idx for idx, line in enumerate(lines[index + 1 :], index + 1) if re.match(r"^- \[[ x-]\] ", line)), len(lines))
    block = lines[index + 1 : end]
    write_line = next((line for line in block if re.search(r"Write set:", line, flags=re.IGNORECASE)), "")
    patterns = [normalize(match.group(1)) for match in re.finditer(r"`([^`]+)`", write_line)]
    return {"taskLine": task_line, "patterns": patterns}
