"""Read-only specs doctor implementation."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

Issue = dict[str, str]

APPROVED_TOKEN = "**Status:** Aprovado"
REQUIRED_FILES = [
    "constitution.md",
    "AGENTS.md",
    "memory/AGENTS.md",
    "memory/architecture.md",
    "memory/tech-stack.md",
    "memory/quality-assurance.md",
    "memory/product/index.md",
    "memory/product/catalog.json",
    "releases/ACTIVE.md",
]
REQUIRED_DIRS = ["backlog", "bugs", "releases", "audits", "memory/product"]


def issue(code: str, severity: str, path: str, message: str) -> Issue:
    return {"code": code, "severity": severity, "path": path, "message": message}


def summarize(issues: list[Issue]) -> dict[str, int]:
    return {
        "errors": sum(1 for item in issues if item.get("severity") == "error"),
        "warnings": sum(1 for item in issues if item.get("severity") == "warning"),
    }


def parse_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    if end < 0:
        return {}
    result: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if ":" not in line:
            continue
        key, raw = line.split(":", 1)
        result[key.strip()] = raw.strip().strip('"\'')
    return result


def read_active(specs_dir: Path, issues: list[Issue]) -> dict[str, str]:
    path = specs_dir / "releases" / "ACTIVE.md"
    if not path.exists():
        issues.append(issue("SPEC-DOC-003", "error", "releases/ACTIVE.md", "ACTIVE.md is missing"))
        return {}
    fields = parse_frontmatter(path.read_text(encoding="utf-8"))
    if not fields.get("release"):
        issues.append(issue("SPEC-DOC-003", "error", "releases/ACTIVE.md", "ACTIVE.md is missing release"))
    if not fields.get("phase"):
        issues.append(issue("SPEC-DOC-003", "error", "releases/ACTIVE.md", "ACTIVE.md is missing phase"))
    return fields


def check_required(specs_dir: Path) -> list[Issue]:
    issues: list[Issue] = []
    for relative in REQUIRED_FILES:
        if not (specs_dir / relative).exists():
            severity = "warning" if "AGENTS.md" in relative else "error"
            issues.append(issue("TREE-REQUIRED", severity, relative, "Required specs file is missing"))
    for relative in REQUIRED_DIRS:
        if not (specs_dir / relative).exists():
            issues.append(issue("TREE-DIR", "error", relative, "Required specs directory is missing"))
    return issues


def check_catalog(specs_dir: Path) -> list[Issue]:
    path = specs_dir / "memory" / "product" / "catalog.json"
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [issue("CAT-1", "error", "memory/product/catalog.json", f"Cannot validate catalog: {exc}")]
    features = payload.get("features", []) if isinstance(payload, dict) else []
    catalog_slugs = {item.get("slug") for item in features if isinstance(item, dict) and isinstance(item.get("slug"), str)}
    atom_slugs = {p.stem for p in (specs_dir / "memory" / "product").glob("*.md") if p.name != "index.md"}
    issues: list[Issue] = []
    for slug in sorted(atom_slugs - catalog_slugs):
        issues.append(issue("CAT-1", "warning", "memory/product/catalog.json", f"Product atom '{slug}' is missing from catalog"))
    for slug in sorted(catalog_slugs - atom_slugs):
        issues.append(issue("CAT-1", "warning", "memory/product/catalog.json", f"Catalog references missing product atom '{slug}'"))
    return issues


def check_active_release(specs_dir: Path, active: dict[str, str]) -> list[Issue]:
    issues: list[Issue] = []
    release = active.get("release")
    if not release or release == "none":
        return issues
    release_dir = specs_dir / "releases" / release
    if not release_dir.exists():
        return [issue("SPEC-DOC-004", "error", f"releases/{release}", "Active release directory is missing")]
    for artifact in ["SPEC.md", "PLAN.md", "TASKS.md"]:
        path = release_dir / artifact
        relative = f"releases/{release}/{artifact}"
        if not path.exists():
            issues.append(issue("SPEC-DOC-004", "error", relative, "Active release artifact is missing"))
            continue
        if APPROVED_TOKEN not in path.read_text(encoding="utf-8"):
            issues.append(issue("SPEC-DOC-005", "error", relative, f"Active release artifact lacks {APPROVED_TOKEN}"))
    tasks_path = release_dir / "TASKS.md"
    if tasks_path.exists():
        tasks = tasks_path.read_text(encoding="utf-8")
        task_lines = [line for line in tasks.splitlines() if re.match(r"^- \[[ x-]\] ", line)]
        if active.get("phase") == "IMPLEMENTATION" and not any(line.startswith("- [-] ") or line.startswith("- [x] ") for line in task_lines):
            issues.append(issue("SPEC-DOC-024", "warning", f"releases/{release}/TASKS.md", "IMPLEMENTATION phase has no in-progress or completed task"))
    return issues


def check_audits(specs_dir: Path) -> list[Issue]:
    audits = specs_dir / "audits"
    if not audits.exists():
        return []
    pattern = re.compile(r"^\d{8}T\d{6}Z-[a-zA-Z0-9]{8}$")
    return [
        issue("SPEC-DOC-030", "warning", f"audits/{entry.name}", "Audit directory should use <YYYYMMDDTHHMMSSZ>-<session_id_8> naming")
        for entry in audits.iterdir()
        if entry.is_dir() and entry.name != "_archive" and not pattern.match(entry.name)
    ]


def run_specs_doctor(specs_dir: str | Path) -> dict[str, Any]:
    root = Path(specs_dir)
    issues: list[Issue] = []
    issues.extend(check_required(root))
    active = read_active(root, issues)
    issues.extend(check_catalog(root))
    issues.extend(check_active_release(root, active))
    issues.extend(check_audits(root))
    return {"root": str(root), "issues": issues, "summary": summarize(issues)}
