"""Git hook installation and Python hook checks."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

from .context import list_contexts
from .gate import classify_path, matches_write_set, parse_reserved_task_write_set, read_lease
from .workspace import Workspace, discover_workspace

HOOK_COMMANDS = {
    "pre-commit": "dadaia-pi hooks pre-commit-check",
    "pre-push": "dadaia-pi hooks pre-push-check",
}


def hook_script(command: str) -> str:
    return f"#!/bin/sh\n# Installed by dadaia-pi-workspace.\nexec {command} \"$@\"\n"


def install_hooks(repo_root: Path) -> list[str]:
    hooks_dir = repo_root / ".git" / "hooks"
    hooks_dir.mkdir(parents=True, exist_ok=True)
    paths: list[str] = []
    for name, command in HOOK_COMMANDS.items():
        path = hooks_dir / name
        path.write_text(hook_script(command), encoding="utf-8")
        path.chmod(0o755)
        paths.append(str(path))
    return paths


def uninstall_hooks(repo_root: Path) -> None:
    for name in HOOK_COMMANDS:
        (repo_root / ".git" / "hooks" / name).unlink(missing_ok=True)


def _git_output(args: list[str], cwd: Path) -> str:
    result = subprocess.run(["git", *args], cwd=cwd, text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "git failed")
    return result.stdout.strip()


def _active_release(repo_root: Path) -> str | None:
    path = repo_root / "specs" / "releases" / "ACTIVE.md"
    if not path.exists():
        return None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("release:"):
            value = line.split(":", 1)[1].strip()
            return None if value == "none" else value
    return None


def _approved_tasks(repo_root: Path, release: str) -> bool:
    path = repo_root / "specs" / "releases" / release / "TASKS.md"
    return path.exists() and "**Status:** Aprovado" in path.read_text(encoding="utf-8")


def _reserved_write_set(repo_root: Path, release: str) -> dict[str, Any] | None:
    path = repo_root / "specs" / "releases" / release / "TASKS.md"
    if not path.exists():
        return None
    return parse_reserved_task_write_set(path.read_text(encoding="utf-8"))


def _approved_implementation_workflow(workspace: Workspace, context: str, release: str) -> bool:
    directory = workspace.state_dir / "workflows" / context
    if not directory.exists():
        return False
    for path in directory.glob("*.json"):
        try:
            manifest = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if (
            manifest.get("release") == release
            and manifest.get("workflowId") in {"release-implementation", "implementation-task"}
            and (manifest.get("sdk") or {}).get("accepted") is True
            and (manifest.get("verdict") or {}).get("value") == "APPROVED"
            and ((manifest.get("verdict") or {}).get("blockingFindings") or 0) == 0
        ):
            return True
    return False


def _context_for_repo(workspace: Workspace, repo_root: Path) -> dict[str, Any] | None:
    repo = repo_root.resolve()
    for context in list_contexts(workspace):
        if (workspace.repos_dir / str(context.get("repoSlug"))).resolve() == repo:
            return context
    return None


def pre_commit_check(workspace: Workspace, repo_root: Path, session_id: str | None = None) -> dict[str, Any]:
    messages: list[str] = []
    try:
        output = _git_output(["diff", "--cached", "--name-only"], repo_root)
        staged = [line for line in output.splitlines() if line]
    except Exception as exc:
        return {"ok": False, "messages": [f"pre-commit check failed to read staged files: {exc}"]}
    context = _context_for_repo(workspace, repo_root)
    if not context:
        return {"ok": True, "messages": ["pre-commit check skipped: repo is not a registered context"]}
    mutating = [path for path in staged if classify_path(workspace, repo_root / path)["pathClass"] == "MUTATING"]
    if not mutating:
        return {"ok": True, "messages": ["pre-commit check ok: no mutating staged paths"]}
    if not session_id:
        messages.append("pre-commit blocked: mutating paths require DADAIA_PI_SESSION_ID to match the context lease holder")
    else:
        lease = read_lease(workspace, str(context["name"]))
        if not lease:
            messages.append(f"pre-commit blocked: no mutating lease for context {context['name']}")
        elif lease.get("sessionId") != session_id:
            messages.append(f"pre-commit blocked: context {context['name']} lease held by {lease.get('sessionId')}, not {session_id}")
    release = _active_release(repo_root)
    if not release:
        messages.append("pre-commit blocked: specs/releases/ACTIVE.md has no release")
    elif not _approved_tasks(repo_root, release):
        messages.append(f"pre-commit blocked: active release {release} needs approved TASKS.md")
    else:
        write_set = _reserved_write_set(repo_root, release)
        if not write_set:
            messages.append(f"pre-commit blocked: active release {release} needs exactly one [-] reserved task with a Write set")
        elif not write_set["patterns"]:
            messages.append("pre-commit blocked: reserved task is missing backtick paths in its Write set")
        else:
            outside = [path for path in mutating if not matches_write_set(path, write_set["patterns"])]
            if outside:
                messages.append(f"pre-commit blocked: staged mutating paths outside reserved task write set: {', '.join(outside)}; write set: {', '.join(write_set['patterns'])}")
        if not _approved_implementation_workflow(workspace, str(context["name"]), release):
            messages.append(f"pre-commit blocked: active release {release} requires APPROVED release-implementation workflow evidence before mutating commit")
    if messages:
        messages.append(f"mutating staged paths: {', '.join(mutating)}")
        return {"ok": False, "messages": messages}
    return {"ok": True, "messages": [f"pre-commit check ok: {len(mutating)} mutating path(s) covered by lease, task, and release-implementation workflow evidence"]}


def _pushed_shas(stdin: str) -> list[str]:
    shas: set[str] = set()
    for line in stdin.splitlines():
        parts = line.strip().split()
        if len(parts) > 1 and not set(parts[1]) <= {"0"}:
            shas.add(parts[1])
    return sorted(shas)


def _collect_json_files(path: Path) -> list[Path]:
    return sorted(path.rglob("*.json")) if path.exists() else []


def _approved_security_shas(workspace: Workspace) -> set[str]:
    shas: set[str] = set()
    for path in _collect_json_files(workspace.state_dir / "handoff"):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if payload.get("agent") == "security-reviewer" and payload.get("verdict") == "APPROVED" and (payload.get("metrics") or {}).get("commit_sha"):
            shas.add(payload["metrics"]["commit_sha"])
    return shas


def pre_push_check(workspace: Workspace, stdin: str) -> dict[str, Any]:
    shas = _pushed_shas(stdin)
    if not shas:
        return {"ok": True, "messages": ["pre-push check ok: no commit shas require security verdict"]}
    approved = _approved_security_shas(workspace)
    missing = [sha for sha in shas if sha not in approved]
    if missing:
        return {"ok": False, "messages": [f"pre-push blocked: commit {sha} has no exact security-reviewer handoff" for sha in missing]}
    return {"ok": True, "messages": [f"pre-push check ok: {len(shas)} commit(s) have security approval"]}


def default_workspace_for_hook(repo_root: Path) -> Workspace:
    env_root = os.environ.get("DADAIA_PI_WORKSPACE_ROOT")
    if env_root:
        return discover_workspace(Path(env_root))
    return discover_workspace(repo_root)
