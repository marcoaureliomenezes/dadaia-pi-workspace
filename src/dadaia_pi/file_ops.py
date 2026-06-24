"""Filesystem helpers with atomic JSON/text writes."""

from __future__ import annotations

import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any


def write_text_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(content)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def write_json_atomic(path: Path, payload: Any) -> None:
    write_text_atomic(path, json.dumps(payload, indent=2) + "\n")


def write_if_missing(path: Path, content: str) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return False
    path.write_text(content, encoding="utf-8")
    return True


def copy_tree_managed(src: Path, dst: Path) -> list[str]:
    actions: list[str] = []
    dst.mkdir(parents=True, exist_ok=True)
    if not src.exists():
        return actions
    managed: set[str] = set()
    for source in sorted(item for item in src.rglob("*") if item.is_file()):
        rel = source.relative_to(src).as_posix()
        managed.add(rel)
        target = dst / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        data = source.read_bytes()
        if target.exists() and target.read_bytes() == data:
            actions.append(f"[skip] {target}")
        else:
            target.write_bytes(data)
            actions.append(f"[ok] {target}")
    for target in sorted(item for item in dst.rglob("*") if item.is_file()):
        rel = target.relative_to(dst).as_posix()
        if rel not in managed:
            target.unlink()
            actions.append(f"[prune] {target}")
    return actions


def remove_tree(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
