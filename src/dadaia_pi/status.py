"""Workspace status model for the Python CLI."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .context import list_contexts, read_binding
from .specs_doctor import summarize
from .workspace import Workspace


def _count_files(path: Path, recursive: bool = False) -> int:
    if not path.exists():
        return 0
    count = 0
    for child in path.iterdir():
        if child.is_file():
            count += 1
        elif recursive and child.is_dir():
            count += _count_files(child, recursive=True)
    return count


def _parse_frontmatter_like(text: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in text.splitlines():
        match = re.match(r"^(release|phase|status):\s*(.+?)\s*$", line)
        if match:
            result[match.group(1)] = match.group(2).strip().strip('"\'')
    return result


def _artifact_status(text: str) -> str | None:
    frontmatter = _parse_frontmatter_like(text)
    if frontmatter.get("status"):
        return frontmatter["status"]
    match = re.search(r"\*\*Status:\*\*\s*([^\n]+)", text)
    return match.group(1).strip() if match else None


def _task_summary(text: str) -> dict[str, int]:
    return {
        "open": len(re.findall(r"^- \[ \]", text, flags=re.MULTILINE)),
        "inProgress": len(re.findall(r"^- \[-\]", text, flags=re.MULTILINE)),
        "done": len(re.findall(r"^- \[x\]", text, flags=re.MULTILINE | re.IGNORECASE)),
    }


def _read_optional(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None


def _doctor_summary(workspace: Workspace) -> dict[str, int]:
    issues: list[dict[str, str]] = []
    if not workspace.state_dir.exists():
        issues.append({"severity": "error"})
    if not (workspace.states_dir / "spec_contexts.json").exists():
        issues.append({"severity": "error"})
    if not workspace.repos_dir.exists():
        issues.append({"severity": "error"})
    return summarize(issues)


def _release_summary(workspace: Workspace, context: dict[str, Any]) -> dict[str, Any] | None:
    repo_slug = context.get("repoSlug")
    if not isinstance(repo_slug, str):
        return None
    specs_dir = workspace.repos_dir / repo_slug / "specs"
    if not specs_dir.exists() and context.get("name") == "dadaia-pi-workspace":
        specs_dir = workspace.root / "specs"
    if not specs_dir.exists():
        return None
    active_text = _read_optional(specs_dir / "releases" / "ACTIVE.md")
    if not active_text:
        return {"specsDir": str(specs_dir), "artifacts": {}, "warnings": [f"missing {specs_dir / 'releases' / 'ACTIVE.md'}"]}
    active = _parse_frontmatter_like(active_text)
    release = active.get("release") if active.get("release") != "none" else None
    phase = active.get("phase")
    artifacts: dict[str, str] = {}
    tasks = None
    if release:
        release_dir = specs_dir / "releases" / release
        for key, filename in [("spec", "SPEC.md"), ("plan", "PLAN.md"), ("tasks", "TASKS.md"), ("closure", "CLOSURE.md")]:
            text = _read_optional(release_dir / filename)
            if not text:
                continue
            artifacts[key] = _artifact_status(text) or "unknown"
            if key == "tasks":
                tasks = _task_summary(text)
    result: dict[str, Any] = {"specsDir": str(specs_dir), "artifacts": artifacts, "warnings": []}
    if release:
        result["release"] = release
    if phase:
        result["phase"] = phase
    if tasks:
        result["tasks"] = tasks
    return result


def _evidence_summary(workspace: Workspace, context_name: str) -> dict[str, int]:
    return {
        "handoffs": _count_files(workspace.state_dir / "handoff" / context_name),
        "reports": _count_files(workspace.state_dir / "reports" / context_name, recursive=True),
    }


def build_status(workspace: Workspace, *, session_id: str | None = None, context: str | None = None) -> dict[str, Any]:
    contexts = list_contexts(workspace)
    binding = read_binding(workspace, session_id) if session_id else None
    selected_context = context or (binding or {}).get("context")
    warnings: list[str] = []
    enriched: list[dict[str, Any]] = []
    for item in contexts:
        selected = item.get("name") == selected_context
        context_summary = {**item, "selected": selected}
        if selected:
            release = _release_summary(workspace, item)
            if release:
                context_summary["release"] = release
            if isinstance(item.get("name"), str):
                context_summary["evidence"] = _evidence_summary(workspace, item["name"])
        enriched.append(context_summary)
    if selected_context and not any(item.get("name") == selected_context for item in contexts):
        warnings.append(f"selected context not found: {selected_context}")
    payload: dict[str, Any] = {
        "root": str(workspace.root),
        "runtime": "python",
        "doctor": _doctor_summary(workspace),
        "contexts": enriched,
        "warnings": warnings,
    }
    if binding:
        payload["binding"] = binding
    if session_id:
        payload["bindingMissing"] = binding is None
    if selected_context:
        payload["selectedContext"] = selected_context
    return payload
