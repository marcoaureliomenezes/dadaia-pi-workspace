"""Mutating Spec Context and session binding operations."""

from __future__ import annotations

import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .context import list_contexts, show_context
from .errors import DadaiaError
from .file_ops import write_json_atomic, write_text_atomic
from .workspace import Workspace

_CONTEXT_RE = re.compile(r"^[a-z][a-z0-9-]*$")
_SESSION_RE = re.compile(r"^[A-Za-z0-9_.:-]+$")


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _validate_context_name(name: str) -> None:
    if not _CONTEXT_RE.match(name):
        raise DadaiaError(f"Invalid context name: {name}", code="INVALID_CONTEXT", exit_code=2)


def _load_registry(workspace: Workspace) -> dict[str, Any]:
    path = workspace.states_dir / "spec_contexts.json"
    if not path.exists():
        return {"schemaVersion": 1, "contexts": []}
    import json

    return json.loads(path.read_text(encoding="utf-8"))


def _save_registry(workspace: Workspace, contexts: list[dict[str, Any]]) -> None:
    contexts = sorted(contexts, key=lambda item: item.get("name", ""))
    write_json_atomic(workspace.states_dir / "spec_contexts.json", {"schemaVersion": 1, "contexts": contexts})


def create_context(workspace: Workspace, name: str, repo_slug: str, *, repo_url: str | None = None, branch: str = "main") -> dict[str, Any]:
    _validate_context_name(name)
    _validate_context_name(repo_slug)
    contexts = list_contexts(workspace)
    if any(item.get("name") == name for item in contexts):
        raise DadaiaError(f"Context already exists: {name}", code="CONTEXT_EXISTS", exit_code=1)
    record: dict[str, Any] = {"name": name, "repoSlug": repo_slug, "branch": branch, "state": "DEAD", "deadSince": now()}
    if repo_url:
        record["repoUrl"] = repo_url
    _save_registry(workspace, [*contexts, record])
    return record


def update_context(workspace: Workspace, name: str, *, repo_url: str | None = None, branch: str | None = None) -> dict[str, Any]:
    contexts = list_contexts(workspace)
    found = False
    updated: dict[str, Any] | None = None
    for item in contexts:
        if item.get("name") == name:
            found = True
            if repo_url is not None:
                item["repoUrl"] = repo_url
            if branch is not None:
                item["branch"] = branch
            updated = item
    if not found or updated is None:
        raise DadaiaError(f"Context not found: {name}", code="CONTEXT_NOT_FOUND", exit_code=1)
    _save_registry(workspace, contexts)
    return updated


def alive_context(workspace: Workspace, name: str) -> dict[str, Any]:
    contexts = list_contexts(workspace)
    current = show_context(workspace, name)
    target = workspace.repos_dir / str(current["repoSlug"])
    workspace.repos_dir.mkdir(parents=True, exist_ok=True)
    repo_url = current.get("repoUrl")
    if not target.exists():
        if not repo_url:
            raise DadaiaError(f"Context {name} has no repoUrl; cannot clone", code="CONTEXT_NO_REPO", exit_code=1)
        result = subprocess.run(["git", "clone", "--branch", current.get("branch", "main"), str(repo_url), str(target)], cwd=workspace.root, text=True, capture_output=True)
        if result.returncode != 0:
            raise DadaiaError(result.stderr.strip() or f"git clone failed for {name}", code="GIT_CLONE_FAILED", exit_code=1)
    updated = {k: v for k, v in current.items() if k not in ["deadSince"]}
    updated["state"] = "ALIVE"
    updated["aliveSince"] = now()
    _save_registry(workspace, [updated if item.get("name") == name else item for item in contexts])
    return updated


def dead_context(workspace: Workspace, name: str) -> dict[str, Any]:
    contexts = list_contexts(workspace)
    current = show_context(workspace, name)
    target = workspace.repos_dir / str(current["repoSlug"])
    if target.exists():
        shutil.rmtree(target)
    updated = {k: v for k, v in current.items() if k not in ["aliveSince"]}
    updated["state"] = "DEAD"
    updated["deadSince"] = now()
    _save_registry(workspace, [updated if item.get("name") == name else item for item in contexts])
    return updated


def _parse_mode(mode: str | None) -> str:
    value = (mode or "read").lower()
    if value == "read":
        return "READ"
    if value == "implementation":
        return "BOUND_IMPLEMENTATION"
    if value == "review":
        return "BOUND_REVIEW"
    raise DadaiaError(f"Invalid mode: {mode}", code="INVALID_MODE", exit_code=2)


def bind_context(workspace: Workspace, name: str, *, session_id: str, mode: str | None = None, release: str | None = None, pid: int | None = None, ttl_seconds: int = 86400) -> dict[str, Any]:
    if not _SESSION_RE.match(session_id):
        raise DadaiaError(f"Invalid session id: {session_id}", code="INVALID_SESSION", exit_code=2)
    context = show_context(workspace, name)
    parsed_mode = _parse_mode(mode)
    if parsed_mode in {"BOUND_IMPLEMENTATION", "BOUND_REVIEW"} and not release:
        raise DadaiaError(f"Mode {parsed_mode} requires --release <id>", code="RELEASE_REQUIRED", exit_code=2)
    timestamp = now()
    record: dict[str, Any] = {
        "sessionId": session_id,
        "context": context["name"],
        "mode": parsed_mode,
        "boundAt": timestamp,
        "lastSeenAt": timestamp,
        "ttlSeconds": ttl_seconds,
    }
    if release:
        record["release"] = release
    if pid:
        record["pid"] = pid
    write_json_atomic(workspace.sessions_dir / f"{session_id}.json", record)
    write_text_atomic(workspace.sessions_dir / "runtime" / f"{context['name']}.ptr", f"{session_id}\n")
    write_text_atomic(workspace.sessions_dir / "runtime" / f"{session_id}.ptr", f"{context['name']}\n")
    write_text_atomic(workspace.states_dir / "bind_epoch" / str(context["name"]), timestamp)
    return record


def release_context(workspace: Workspace, session_id: str) -> None:
    import json

    path = workspace.sessions_dir / f"{session_id}.json"
    if not path.exists():
        return
    record = json.loads(path.read_text(encoding="utf-8"))
    path.unlink()
    (workspace.sessions_dir / "runtime" / f"{session_id}.ptr").unlink(missing_ok=True)
    ctx_ptr = workspace.sessions_dir / "runtime" / f"{record.get('context')}.ptr"
    if ctx_ptr.exists() and ctx_ptr.read_text(encoding="utf-8").strip() == session_id:
        ctx_ptr.unlink()
