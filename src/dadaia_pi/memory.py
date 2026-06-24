"""Product memory navigation."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .context import specs_dir_for_context
from .errors import DadaiaError
from .json_store import read_json_required
from .workspace import Workspace


def _entry(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict) or not isinstance(value.get("slug"), str) or not isinstance(value.get("path"), str):
        return None
    result: dict[str, Any] = {"slug": value["slug"], "path": value["path"]}
    for key in ["title", "tldr", "summary"]:
        if isinstance(value.get(key), str):
            result[key] = value[key]
    if isinstance(value.get("tags"), list) and all(isinstance(tag, str) for tag in value["tags"]):
        result["tags"] = value["tags"]
    return result


def _specs_dir(workspace: Workspace, context: str | None) -> Path:
    return Path(specs_dir_for_context(workspace, context)[1])


def list_memory(workspace: Workspace, context: str | None = None) -> list[dict[str, Any]]:
    specs_dir = _specs_dir(workspace, context)
    payload = read_json_required(specs_dir / "memory" / "product" / "catalog.json")
    features = payload.get("features", []) if isinstance(payload, dict) else []
    return [entry for item in features if (entry := _entry(item)) is not None]


def show_memory(workspace: Workspace, slug: str, context: str | None = None) -> dict[str, Any]:
    specs_dir = _specs_dir(workspace, context)
    entries = list_memory(workspace, context)
    entry = next((item for item in entries if item["slug"] == slug), None)
    if not entry:
        raise DadaiaError(f"Memory atom not found: {slug}", code="MEMORY_NOT_FOUND", exit_code=1)
    raw_path = str(entry["path"])
    path = specs_dir / raw_path.removeprefix("specs/") if raw_path.startswith("specs/") else specs_dir / raw_path
    return {**entry, "content": path.read_text(encoding="utf-8")}
