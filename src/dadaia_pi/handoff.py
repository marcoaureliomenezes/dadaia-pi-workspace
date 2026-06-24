"""Machine-readable handoff validation, listing, and emit helpers."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .file_ops import write_json_atomic
from .workspace import Workspace

ARTIFACT_TYPES = {"handoff", "report", "spec", "plan", "tasks", "closure", "memory", "other"}
VERDICTS = {"APPROVED", "REJECTED", "NEEDS_CHANGES"}


def _non_empty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_handoff_record(value: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(value, dict):
        return ["handoff must be a JSON object"]
    if value.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    for field in ["context", "sessionId", "agent", "producedAt", "scope"]:
        if not _non_empty(value.get(field)):
            errors.append(f"{field} must be a non-empty string")
    produced = value.get("producedAt")
    if _non_empty(produced) and not re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$", produced):
        errors.append("producedAt must be an ISO UTC timestamp ending in Z")
    artifact = value.get("artifact")
    if not isinstance(artifact, dict):
        errors.append("artifact must be an object")
    else:
        if artifact.get("type") not in ARTIFACT_TYPES:
            errors.append("artifact.type is invalid")
        if "path" in artifact and not _non_empty(artifact.get("path")):
            errors.append("artifact.path must be a non-empty string when present")
        if "sha256" in artifact and (not isinstance(artifact.get("sha256"), str) or not re.match(r"^[a-f0-9]{64}$", artifact["sha256"])):
            errors.append("artifact.sha256 must be a lowercase 64-character hex string when present")
        if "path" in artifact and "sha256" not in artifact:
            errors.append("artifact.sha256 is required when artifact.path is present")
    if not isinstance(value.get("metrics"), dict):
        errors.append("metrics must be an object")
    if not isinstance(value.get("findings"), list):
        errors.append("findings must be an array")
    if "release" in value and not _non_empty(value.get("release")):
        errors.append("release must be a non-empty string when present")
    if "verdict" in value and value.get("verdict") not in VERDICTS:
        errors.append("verdict is invalid")
    decisions = value.get("decisionsRequired")
    if decisions is not None and (not isinstance(decisions, list) or not all(_non_empty(item) for item in decisions)):
        errors.append("decisionsRequired must be an array of non-empty strings when present")
    if "next" in value and not isinstance(value.get("next"), dict):
        errors.append("next must be an object when present")
    return errors


def validate_handoff_file(path: Path) -> dict[str, Any]:
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return {"path": str(path), "ok": False, "errors": [f"invalid JSON: {exc}"]}
    errors = validate_handoff_record(parsed)
    return {"path": str(path), "ok": not errors, "errors": errors}


def _handoff_files(path: Path) -> list[Path]:
    return sorted(path.rglob("*.handoff.json")) if path.exists() else []


def list_handoffs(workspace: Workspace, context: str | None = None) -> list[dict[str, Any]]:
    base = workspace.state_dir / "handoff" / context if context else workspace.state_dir / "handoff"
    items: list[dict[str, Any]] = []
    for file in _handoff_files(base):
        validation = validate_handoff_file(file)
        parsed: dict[str, Any] = {}
        try:
            parsed = json.loads(file.read_text(encoding="utf-8"))
        except Exception:
            pass
        metrics = parsed.get("metrics") if isinstance(parsed.get("metrics"), dict) else {}
        item: dict[str, Any] = {
            "path": file.relative_to(workspace.root).as_posix() if file.is_relative_to(workspace.root) else str(file),
            "ok": validation["ok"],
            "errors": validation["errors"],
        }
        for key in ["context", "agent", "producedAt", "verdict", "release"]:
            if isinstance(parsed.get(key), str):
                item[key] = parsed[key]
        if isinstance(metrics.get("commit_sha"), str):
            item["commitSha"] = metrics["commit_sha"]
        items.append(item)
    return items


def _format_timestamp(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:23] + "Z"


def emit_security_approval(workspace: Workspace, *, context: str, commit_sha: str, session_id: str | None = None, scope: str | None = None, release: str | None = None) -> Path:
    if not re.match(r"^[a-f0-9]{40}$", commit_sha, flags=re.IGNORECASE):
        raise ValueError("approve-security requires a 40-character commit sha")
    if not re.match(r"^[a-z][a-z0-9-]*$", context):
        raise ValueError("approve-security requires a valid --context <name>")
    produced = _format_timestamp(datetime.now(timezone.utc))
    stamp = produced.replace("-", "").replace(":", "").replace(".000Z", "Z").replace(".", "")
    directory = workspace.state_dir / "handoff" / context
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{stamp}-security-reviewer-{commit_sha[:8]}.handoff.json"
    record: dict[str, Any] = {
        "schemaVersion": 1,
        "context": context,
        "sessionId": session_id or "unknown",
        "agent": "security-reviewer",
        "producedAt": produced,
        "scope": scope or f"security approval for commit {commit_sha}",
        "artifact": {"type": "handoff"},
        "metrics": {"commit_sha": commit_sha},
        "findings": [],
        "verdict": "APPROVED",
        "next": {"agent": "operator", "action": "push"},
    }
    if release:
        record["release"] = release
    errors = validate_handoff_record(record)
    if errors:
        raise ValueError(f"generated handoff is invalid: {'; '.join(errors)}")
    write_json_atomic(path, record)
    return path


def format_handoff_item(item: dict[str, Any]) -> str:
    if not item.get("ok"):
        return f"{item.get('path')}\tINVALID\t{'; '.join(item.get('errors', []))}"
    return "\t".join(str(item.get(key, "")) for key in ["path", "context", "agent", "verdict", "release", "commitSha", "producedAt"])
