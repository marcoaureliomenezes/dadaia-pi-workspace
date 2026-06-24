"""Read-only Spec Context registry support."""

from __future__ import annotations

from typing import Any

from .errors import DadaiaError
from .json_store import read_json
from .workspace import Workspace


def _contexts_payload(workspace: Workspace) -> dict[str, Any]:
    payload = read_json(workspace.states_dir / "spec_contexts.json")
    if not isinstance(payload, dict):
        return {"schemaVersion": 1, "contexts": []}
    return payload


def list_contexts(workspace: Workspace) -> list[dict[str, Any]]:
    payload = _contexts_payload(workspace)
    contexts = payload.get("contexts", [])
    return contexts if isinstance(contexts, list) else []


def show_context(workspace: Workspace, name: str) -> dict[str, Any]:
    for context in list_contexts(workspace):
        if isinstance(context, dict) and context.get("name") == name:
            return context
    raise DadaiaError(f"Context not found: {name}", code="CONTEXT_NOT_FOUND", exit_code=1)


def read_binding(workspace: Workspace, session_id: str) -> dict[str, Any] | None:
    payload = read_json(workspace.sessions_dir / f"{session_id}.json")
    return payload if isinstance(payload, dict) else None


def specs_dir_for_context(workspace: Workspace, context_name: str | None) -> tuple[str | None, str]:
    if not context_name:
        local_specs = workspace.root / "specs"
        return None, str(local_specs)
    context = show_context(workspace, context_name)
    return context_name, str(workspace.repos_dir / str(context["repoSlug"]) / "specs")
