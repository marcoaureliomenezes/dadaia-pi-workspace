"""Python workflow orchestration surface."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .context import show_context
from .file_ops import write_json_atomic, write_text_atomic
from .gate import matches_write_set, parse_reserved_task_write_set
import subprocess
from .pi_rpc import PiRpcClient, run_headless_prompt, text_from_rpc_events
from .workspace import Workspace

COMMON_STEPS = [
    {"id": "load-context", "title": "Load context", "kind": "deterministic", "description": "Resolve context, release, memory, and prompt."},
    {"id": "bounded-reasoning", "title": "Bounded Pi reasoning", "kind": "sdk", "prompt": "workflow", "model": "default", "description": "Run Pi through RPC/headless or deterministic fallback."},
    {"id": "write-evidence", "title": "Write evidence", "kind": "gate", "description": "Emit manifest and report."},
]

PHASES = ["BACKLOG", "RESEARCH", "RELEASE_DEFINITION", "SPEC_REVIEW", "IMPLEMENTATION", "QA_REVIEW", "SECURITY_REVIEW", "CODE_REVIEW", "CLOSURE", "ARCHIVED"]

GATES_BY_TARGET = {
    "BACKLOG": [],
    "RESEARCH": [],
    "RELEASE_DEFINITION": [],
    "SPEC_REVIEW": [],
    "IMPLEMENTATION": ["spec-review"],
    "QA_REVIEW": ["implementation-task"],
    "SECURITY_REVIEW": ["qa-review"],
    "CODE_REVIEW": ["security-review"],
    "CLOSURE": ["qa-review", "security-review", "code-review", "tasks-complete"],
    "ARCHIVED": ["release-closure"],
}


def allowed_next(phase: str) -> list[str]:
    if phase == "BACKLOG":
        return ["RESEARCH", "RELEASE_DEFINITION"]
    if phase == "RESEARCH":
        return ["RELEASE_DEFINITION"]
    if phase == "RELEASE_DEFINITION":
        return ["SPEC_REVIEW"]
    if phase == "SPEC_REVIEW":
        return ["IMPLEMENTATION"]
    if phase == "IMPLEMENTATION":
        return ["QA_REVIEW"]
    if phase == "QA_REVIEW":
        return ["SECURITY_REVIEW"]
    if phase == "SECURITY_REVIEW":
        return ["CODE_REVIEW"]
    if phase == "CODE_REVIEW":
        return ["CLOSURE"]
    if phase == "CLOSURE":
        return ["ARCHIVED"]
    return []


WORKFLOWS: dict[str, dict[str, Any]] = {
    "backlog-intake": {"id": "backlog-intake", "title": "Backlog intake and conflict resolution", "phase": "BACKLOG_DEFINITION", "activity": "ADDITIVE", "steps": COMMON_STEPS},
    "research": {"id": "research", "title": "Scoped source and product research", "phase": "RESEARCH", "activity": "ADDITIVE", "steps": COMMON_STEPS},
    "release-define": {"id": "release-define", "title": "Release definition from clean backlog", "phase": "RELEASE_DEFINITION", "activity": "MUTATING", "steps": COMMON_STEPS},
    "spec-review": {"id": "spec-review", "title": "Independent SPEC/PLAN/TASKS review", "phase": "SPEC_REVIEW", "activity": "ADDITIVE", "steps": COMMON_STEPS},
    "implementation-task": {"id": "implementation-task", "title": "Reserved task implementation", "phase": "IMPLEMENTATION", "activity": "MUTATING", "steps": COMMON_STEPS},
    "qa-review": {"id": "qa-review", "title": "QA review", "phase": "QA_REVIEW", "activity": "ADDITIVE", "steps": COMMON_STEPS},
    "security-review": {"id": "security-review", "title": "Security review", "phase": "SECURITY_REVIEW", "activity": "ADDITIVE", "steps": COMMON_STEPS},
    "code-review": {"id": "code-review", "title": "Code review", "phase": "CODE_REVIEW", "activity": "ADDITIVE", "steps": COMMON_STEPS},
    "release-closure": {"id": "release-closure", "title": "Release closure", "phase": "CLOSURE", "activity": "MUTATING", "steps": COMMON_STEPS},
    "release-implementation": {"id": "release-implementation", "title": "TDD release implementation by task group", "phase": "IMPLEMENTATION", "activity": "MUTATING", "steps": COMMON_STEPS},
}


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def slug(value: str) -> str:
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9._-]+", "-", value.lower())) or "workflow"


def workflow_list() -> list[dict[str, Any]]:
    return [WORKFLOWS[key] for key in sorted(WORKFLOWS)]


def workflow_show(workflow_id: str) -> dict[str, Any]:
    if workflow_id not in WORKFLOWS:
        raise KeyError(f"Workflow not found: {workflow_id}")
    return WORKFLOWS[workflow_id]


def _parse_active(text: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in text.splitlines():
        if line.startswith("release:"):
            result["release"] = line.split(":", 1)[1].strip()
        elif line.startswith("phase:"):
            result["phase"] = line.split(":", 1)[1].strip()
    return result


def _repo_root(workspace: Workspace, context_name: str) -> tuple[dict[str, Any], Path]:
    context = show_context(workspace, context_name)
    return context, workspace.repos_dir / str(context["repoSlug"])


def _active_release(repo_root: Path) -> dict[str, str]:
    path = repo_root / "specs" / "releases" / "ACTIVE.md"
    return _parse_active(path.read_text(encoding="utf-8")) if path.exists() else {}


def _read_manifests(workspace: Workspace, context: str) -> list[dict[str, Any]]:
    directory = workspace.state_dir / "workflows" / context
    manifests: list[dict[str, Any]] = []
    if not directory.exists():
        return manifests
    for path in sorted(directory.glob("*.json")):
        try:
            manifests.append(json.loads(path.read_text(encoding="utf-8")))
        except Exception:
            pass
    return manifests


def _approved_manifest(manifests: list[dict[str, Any]], context: str, release: str, workflow_id: str) -> bool:
    return any(
        item.get("context") == context
        and item.get("release") == release
        and item.get("workflowId") == workflow_id
        and (item.get("sdk") or {}).get("accepted") is True
        and (item.get("verdict") or {}).get("value") == "APPROVED"
        and ((item.get("verdict") or {}).get("blockingFindings") or 0) == 0
        for item in manifests
    )


def _tasks_complete(repo_root: Path, release: str) -> bool:
    path = repo_root / "specs" / "releases" / release / "TASKS.md"
    if not path.exists():
        return False
    for line in path.read_text(encoding="utf-8").splitlines():
        if re.match(r"^- \[( |-)] ", line) and not re.search(r"deferred|deferido", line, flags=re.IGNORECASE):
            return False
    return True


def _evaluate_gates(workspace: Workspace, repo_root: Path, context: str, release: str, target: str) -> list[dict[str, Any]]:
    manifests = _read_manifests(workspace, context)
    gates: list[dict[str, Any]] = []
    for gate in GATES_BY_TARGET.get(target, []):
        if gate == "tasks-complete":
            ok = _tasks_complete(repo_root, release)
            gates.append({"name": gate, "ok": ok, "message": "all tasks complete or explicitly deferred" if ok else "open or in-progress tasks remain"})
        else:
            ok = _approved_manifest(manifests, context, release, gate)
            gates.append({"name": gate, "ok": ok, "message": f"found APPROVED {gate} workflow manifest" if ok else f"missing APPROVED {gate} workflow manifest"})
    return gates


def workflow_status(workspace: Workspace, context_name: str, release: str) -> dict[str, Any]:
    context, repo_root = _repo_root(workspace, context_name)
    active = _active_release(repo_root)
    phase = active.get("phase") if active.get("release") == release and active.get("phase") else "BACKLOG"
    next_phases = allowed_next(phase)
    target = next_phases[0] if next_phases else None
    gates = _evaluate_gates(workspace, repo_root, context["name"], release, target) if target else []
    return {
        "context": context["name"],
        "repoSlug": context["repoSlug"],
        "release": release,
        "phase": phase,
        "allowedNext": next_phases,
        "gates": gates,
        "canAdvance": bool(next_phases) and all(gate["ok"] for gate in gates),
    }


def _safe_id(value: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "-", value)
    if not safe:
        raise ValueError("release candidate id cannot be empty")
    return safe


def commit_range_from_endpoints(base: str, head: str) -> str:
    return f"{base}..{head}"


def _git_lines(cwd: Path, args: list[str]) -> list[str]:
    try:
        result = subprocess.run(["git", *args], cwd=cwd, text=True, capture_output=True, check=True)
        return [line.strip() for line in result.stdout.splitlines() if line.strip()]
    except Exception:
        return []


def rc_create(workspace: Workspace, context_name: str, release: str, rc_id: str, commit_range: str) -> dict[str, Any]:
    context, repo_root = _repo_root(workspace, context_name)
    rc_id = _safe_id(rc_id)
    directory = workspace.state_dir / "release-candidates" / context["name"] / release
    directory.mkdir(parents=True, exist_ok=True)
    record = {
        "schemaVersion": 1,
        "id": rc_id,
        "context": context["name"],
        "release": release,
        "commitRange": commit_range,
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "reviews": {"qa": [], "security": [], "code": []},
    }
    path = directory / f"{rc_id}.json"
    write_json_atomic(path, record)
    return {**record, "path": path.relative_to(workspace.root).as_posix()}


def rc_list(workspace: Workspace, context_name: str, release: str) -> list[dict[str, Any]]:
    context, repo_root = _repo_root(workspace, context_name)
    directory = workspace.state_dir / "release-candidates" / context["name"] / release
    records = []
    if directory.exists():
        for path in sorted(directory.glob("*.json")):
            try:
                records.append({**json.loads(path.read_text(encoding="utf-8")), "path": path.relative_to(workspace.root).as_posix()})
            except Exception:
                pass
    return sorted(records, key=lambda item: item.get("id", ""))


def rc_inspect(workspace: Workspace, context_name: str, release: str, rc_id: str) -> dict[str, Any]:
    context, repo_root = _repo_root(workspace, context_name)
    path = workspace.state_dir / "release-candidates" / context["name"] / release / f"{_safe_id(rc_id)}.json"
    record = json.loads(path.read_text(encoding="utf-8"))
    commits = _git_lines(repo_root, ["rev-list", "--reverse", record["commitRange"]])
    changed = _git_lines(repo_root, ["diff", "--name-only", record["commitRange"]])
    head = (_git_lines(repo_root, ["rev-parse", "HEAD"]) or [None])[0]
    range_commits = set(_git_lines(repo_root, ["rev-list", record["commitRange"]]))
    reviews = record.get("reviews", {})
    return {
        **record,
        "path": path.relative_to(workspace.root).as_posix(),
        "commits": commits,
        "changedFiles": changed,
        "reviewStatus": {"qa": bool(reviews.get("qa")), "security": bool(reviews.get("security")), "code": bool(reviews.get("code"))},
        "stale": bool(head and range_commits and head not in range_commits),
        **({"headSha": head} if head else {}),
    }


def evidence_bundle(workspace: Workspace, context_name: str, release: str, prune: bool = False) -> dict[str, Any]:
    context, repo_root = _repo_root(workspace, context_name)
    manifests = [m for m in _read_manifests(workspace, context["name"]) if m.get("release") == release]
    bundle_dir = workspace.state_dir / "evidence-bundles" / context["name"] / release
    bundle_dir.mkdir(parents=True, exist_ok=True)
    bundle = {
        "schemaVersion": 1,
        "context": context["name"],
        "release": release,
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "manifestCount": len(manifests),
        "manifests": [m.get("artifacts", {}).get("manifest") for m in manifests if m.get("artifacts")],
        "pruned": prune,
    }
    path = bundle_dir / f"{timestamp()}-evidence-bundle.json"
    write_json_atomic(path, bundle)
    return {**bundle, "path": path.relative_to(workspace.root).as_posix()}


def readiness(workspace: Workspace, context_name: str, release: str) -> dict[str, Any]:
    status = workflow_status(workspace, context_name, release)
    rcs = rc_list(workspace, context_name, release)
    doctor_issues: list[Any] = []
    missing = [gate for gate in status["gates"] if not gate["ok"]]
    closure_ready = status["phase"] in {"CLOSURE", "ARCHIVED"} and not missing
    score = max(0, 100 - len(missing) * 20 - len(doctor_issues) * 10)
    return {**status, "releaseCandidates": rcs, "doctorIssues": doctor_issues, "prePushReady": any((rc.get("reviews", {}).get("security") for rc in rcs)), "closureReady": closure_ready, "score": score}


def backlog_check(workspace: Workspace, context_name: str, prompt_file: str) -> dict[str, Any]:
    context, repo_root = _repo_root(workspace, context_name)
    demand = Path(prompt_file).read_text(encoding="utf-8")
    report_dir = workspace.state_dir / "reports" / context["name"] / "backlog"
    report_dir.mkdir(parents=True, exist_ok=True)
    path = report_dir / f"{timestamp()}-backlog-check.md"
    existing = sorted((repo_root / "specs" / "backlog").glob("*.md")) if (repo_root / "specs" / "backlog").exists() else []
    write_text_atomic(path, "# Backlog check\n\n## Demand\n\n" + demand + "\n\n## Existing backlog\n" + "\n".join(f"- {p.name}" for p in existing) + "\n")
    return {"context": context["name"], "report": path.relative_to(workspace.root).as_posix(), "existingBacklog": [p.name for p in existing]}


def backlog_consume(workspace: Workspace, context_name: str, release: str, backlog_path: str) -> dict[str, Any]:
    context, repo_root = _repo_root(workspace, context_name)
    path = Path(backlog_path)
    if not path.is_absolute():
        path = repo_root / path
    text = path.read_text(encoding="utf-8")
    marker = f"\n\n---\nconsumed_by_release: {release}\nconsumed_at: {datetime.now(timezone.utc).isoformat().replace('+00:00','Z')}\n"
    if "consumed_by_release:" not in text:
        path.write_text(text.rstrip() + marker, encoding="utf-8")
    return {"context": context["name"], "release": release, "backlog": path.relative_to(repo_root).as_posix(), "consumed": True}


def patch_apply(workspace: Workspace, context_name: str, release: str, patch_file: str, approve: bool) -> dict[str, Any]:
    if not approve:
        raise ValueError("workflow patch apply requires --approve")
    context, repo_root = _repo_root(workspace, context_name)
    tasks_path = repo_root / "specs" / "releases" / release / "TASKS.md"
    write_set = parse_reserved_task_write_set(tasks_path.read_text(encoding="utf-8")) if tasks_path.exists() else None
    if not write_set or not write_set.get("patterns"):
        raise ValueError(f"active release {release} needs exactly one [-] reserved task with a Write set")
    payload_text = Path(patch_file).read_text(encoding="utf-8")
    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"unsupported patch format; JSON required for Python parity v1: {exc}") from exc
    operations = payload.get("operations") if isinstance(payload, dict) else None
    if operations is None and isinstance(payload, dict) and "path" in payload:
        operations = [payload]
    if not isinstance(operations, list):
        raise ValueError("patch JSON must contain operations[] or a single operation object")
    applied = []
    for op in operations:
        if not isinstance(op, dict) or not isinstance(op.get("path"), str):
            raise ValueError("each patch operation requires path")
        rel = op["path"].replace("\\", "/").removeprefix("./")
        if not matches_write_set(rel, write_set["patterns"]):
            raise ValueError(f"patch path outside reserved task write set: {rel}; write set: {', '.join(write_set['patterns'])}")
        target = repo_root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if "content" in op and isinstance(op["content"], str):
            target.write_text(op["content"], encoding="utf-8")
        elif isinstance(op.get("oldText"), str) and isinstance(op.get("newText"), str):
            current = target.read_text(encoding="utf-8")
            if op["oldText"] not in current:
                raise ValueError(f"oldText not found in {rel}")
            target.write_text(current.replace(op["oldText"], op["newText"], 1), encoding="utf-8")
        else:
            raise ValueError("unsupported patch operation; use content or oldText/newText")
        applied.append(rel)
    stamp = timestamp()
    report_dir = workspace.state_dir / "reports" / context["name"] / "patches"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / f"{stamp}-patch-apply.md"
    write_text_atomic(report_path, "# Controlled patch apply\n\n" + "\n".join(f"- {p}" for p in applied) + "\n")
    return {"context": context["name"], "release": release, "applied": applied, "report": report_path.relative_to(workspace.root).as_posix()}


def workflow_advance(workspace: Workspace, context_name: str, release: str, target: str) -> dict[str, Any]:
    if target not in PHASES:
        raise ValueError(f"Unknown release phase: {target}")
    context, repo_root = _repo_root(workspace, context_name)
    active = _active_release(repo_root)
    current = active.get("phase") if active.get("release") == release and active.get("phase") else "BACKLOG"
    next_phases = allowed_next(current)
    if target not in next_phases:
        raise ValueError(f"Cannot advance {release} from {current} to {target}; allowed: {', '.join(next_phases) or 'none'}")
    gates = _evaluate_gates(workspace, repo_root, context["name"], release, target)
    missing = [gate for gate in gates if not gate["ok"]]
    if missing:
        raise ValueError(f"Cannot advance {release} to {target}; {'; '.join(gate['message'] for gate in missing)}")
    active_path = repo_root / "specs" / "releases" / "ACTIVE.md"
    write_text_atomic(active_path, f"---\nrelease: {release}\nphase: {target}\n---\n")
    return workflow_status(workspace, context_name, release)


def _read_prompt(path: str | None) -> str:
    return Path(path).resolve().read_text(encoding="utf-8") if path else ""


def _extract_verdict(summary: str, explicit: str | None, dry_run: bool) -> dict[str, Any]:
    if explicit:
        value = explicit
        source = "cli"
    else:
        match = re.search(r"\b(APPROVED|NEEDS_CHANGES|REJECTED)\b", summary)
        value = match.group(1) if match else "APPROVED" if dry_run else "NEEDS_CHANGES"
        source = "summary" if match else "dry-run-default" if dry_run else "fallback-default"
    blocking = 0 if value == "APPROVED" else 1
    return {"value": value, "source": source, "findings": [], "blockingFindings": blocking, "risk": "low" if value == "APPROVED" else "unknown", "reviewedPaths": [], "acceptanceCoverage": []}


def _fallback_execution(step: dict[str, Any], dry_run: bool) -> dict[str, Any]:
    return {"id": step["id"], "title": step["title"], "kind": step["kind"], "mode": "dry-run" if dry_run else "fallback", "accepted": True, "summary": step.get("description", "executed")}


def _run_reasoning(prompt: str, mode: str, dry_run: bool, model: str | None) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if dry_run:
        summary = "Python workflow dry-run fallback. APPROVED blockingFindings=0 risk=low"
        return {"mode": "dry-run", "accepted": True, "summary": summary}, []
    if mode == "rpc":
        client = PiRpcClient()
        try:
            events = client.start().prompt(prompt or "Run dadaia-pi workflow step and return a concise verdict.")
            summary = text_from_rpc_events(events) or "RPC workflow completed. APPROVED"
            return {"mode": "rpc", "accepted": True, "summary": summary}, events
        finally:
            client.close()
    headless = run_headless_prompt(prompt or "Run dadaia-pi workflow step and return a concise verdict.", model=model)
    summary = headless["stdout"] or headless["stderr"] or "headless workflow completed"
    return {"mode": "headless", "accepted": bool(headless["accepted"]), "summary": summary}, []


def render_report(manifest: dict[str, Any], prompt: str) -> str:
    lines = [
        f"# Workflow report - {manifest['workflowId']}",
        "",
        f"- Run: {manifest['runId']}",
        f"- Context: {manifest['context']}",
        f"- Release: {manifest.get('release', 'none')}",
        f"- Runtime: python",
        f"- Pi mode: {manifest['sdk']['mode']}",
        f"- Verdict: {manifest['verdict']['value']}",
        "",
        "## Summary",
        manifest["sdk"]["summary"],
        "",
        "## Step executions",
    ]
    for execution in manifest["orchestration"]["executions"]:
        lines.append(f"- {execution['id']} ({execution['kind']}, mode={execution['mode']}): {'accepted' if execution['accepted'] else 'blocked'}")
    lines.extend(["", "## Operator prompt", "", prompt.strip() or "(none)", ""])
    return "\n".join(lines)


@dataclass
class WorkflowRunOptions:
    workflow_id: str
    context: str
    release: str | None = None
    prompt_file: str | None = None
    model: str | None = None
    verdict: str | None = None
    dry_run: bool = False
    pi_mode: str = "headless"


def run_workflow(workspace: Workspace, options: WorkflowRunOptions) -> dict[str, Any]:
    definition = workflow_show(options.workflow_id)
    context = show_context(workspace, options.context)
    prompt = _read_prompt(options.prompt_file)
    sdk, _events = _run_reasoning(prompt, options.pi_mode, options.dry_run, options.model)
    executions = [_fallback_execution(step, options.dry_run) for step in definition["steps"]]
    for execution in executions:
        if execution["kind"] == "sdk":
            execution.update({"mode": sdk["mode"], "model": options.model or "default", "summary": sdk["summary"], "accepted": sdk["accepted"]})
    run_id = f"{timestamp()}-{slug(options.workflow_id)}"
    workflow_dir = workspace.state_dir / "workflows" / options.context
    report_dir = workspace.state_dir / "reports" / options.context / "workflows"
    workflow_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = workflow_dir / f"{run_id}.json"
    report_path = report_dir / f"{run_id}.md"
    manifest: dict[str, Any] = {
        "schemaVersion": 1,
        "runId": run_id,
        "workflowId": definition["id"],
        "title": definition["title"],
        "phase": definition["phase"],
        "activity": definition["activity"],
        "context": options.context,
        "repoSlug": context["repoSlug"],
        "runtime": "python",
        "dryRun": options.dry_run,
        "sdk": sdk,
        "orchestration": {"engine": "python", "steps": definition["steps"], "executions": executions},
        "verdict": _extract_verdict(sdk["summary"], options.verdict, options.dry_run),
        "linkedHandoffs": [],
        "artifacts": {"manifest": str(manifest_path.relative_to(workspace.root)), "report": str(report_path.relative_to(workspace.root))},
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    if options.release:
        manifest["release"] = options.release
    if options.prompt_file:
        manifest["promptFile"] = options.prompt_file
    if options.model:
        manifest["model"] = options.model
    report = render_report(manifest, prompt)
    write_json_atomic(manifest_path, manifest)
    write_text_atomic(report_path, report)
    return {"manifest": manifest, "reportText": report}
