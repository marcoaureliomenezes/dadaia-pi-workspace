"""Specs scaffold support."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from .file_ops import write_if_missing


def _frontmatter(slug: str, title: str, category: str, tldr: str) -> str:
    today = datetime.now(timezone.utc).date().isoformat()
    return "\n".join([
        "---",
        f"slug: {slug}",
        f"title: {title}",
        f"category: {category}",
        f"tldr: {tldr!r}",
        f"summary: {tldr!r}",
        "tags: []",
        "agent_tier: self-pull",
        "token_estimate: 100",
        f"last_updated: {today!r}",
        "release_origin: scaffold",
        "---",
    ])


def scaffold_specs(specs_dir: Path) -> dict[str, list[str]]:
    actions: list[str] = []
    specs_dir.mkdir(parents=True, exist_ok=True)
    for rel in ["memory/product", "backlog", "bugs", "releases", "audits"]:
        (specs_dir / rel).mkdir(parents=True, exist_ok=True)
        actions.append(f"[dir] {specs_dir / rel}")
    files = {
        "constitution.md": "---\nspecs_pattern_version: 1\n---\n\n# Constitution\n\nThis file defines permanent product law.\n",
        "AGENTS.md": "# specs/AGENTS.md\n\nFollow the active release gate before production edits.\n",
        "releases/ACTIVE.md": "---\nrelease: bootstrap\nphase: DEFINITION\n---\n",
        "backlog/README.md": "# Backlog\n",
        "bugs/README.md": "# Bugs\n",
        "audits/README.md": "# Audits\n",
        "releases/README.md": "# Releases\n",
        "memory/AGENTS.md": "# specs/memory/AGENTS.md\n\nMemory is current product truth.\n",
        "memory/architecture.md": _frontmatter("architecture", "Architecture", "core", "Initial architecture placeholder") + "\n\n## Propósito\n\nDescribe the current system architecture.\n",
        "memory/tech-stack.md": _frontmatter("tech-stack", "Tech Stack", "core", "Initial tech stack placeholder") + "\n\n## Propósito\n\nDescribe approved languages, runtimes, dependencies, and commands.\n",
        "memory/quality-assurance.md": _frontmatter("quality-assurance", "Quality Assurance", "core", "Initial QA placeholder") + "\n\n## Propósito\n\nDescribe required validation evidence.\n",
        "memory/product/index.md": _frontmatter("index", "Product Catalog", "product", "Product catalog placeholder") + "\n\n## Visão atômica\n\nAdd product atoms under `specs/memory/product/`.\n",
        "memory/product/catalog.json": "[]\n",
    }
    for rel, content in files.items():
        created = write_if_missing(specs_dir / rel, content)
        actions.append(f"{'[ok]' if created else '[skip]'} {specs_dir / rel}")
    return {"actions": actions}
