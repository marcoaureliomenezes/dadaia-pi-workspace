from __future__ import annotations

import json
from pathlib import Path

from dadaia_pi.cli import run


def make_workspace(tmp_path: Path) -> Path:
    root = tmp_path / "ws"
    repo = root / "repos" / "demo"
    rel = repo / "specs" / "releases" / "r1"
    rel.mkdir(parents=True)
    (root / ".dadaia-pi" / "states").mkdir(parents=True)
    (root / ".dadaia-pi" / "sessions").mkdir(parents=True)
    (root / ".dadaia-pi" / "states" / "spec_contexts.json").write_text(json.dumps({"schemaVersion": 1, "contexts": [{"name": "demo", "repoSlug": "demo", "branch": "main", "state": "ALIVE"}]}), encoding="utf-8")
    (rel / "TASKS.md").write_text("**Status:** Aprovado\n\n- [-] T-1 Patch\n  - Write set: `src/**`, `tests/*.py`\n", encoding="utf-8")
    (repo / "src").mkdir()
    (repo / "src" / "app.py").write_text("old\n", encoding="utf-8")
    return root


def test_patch_apply_content_and_oldtext(capsys, tmp_path):
    root = make_workspace(tmp_path)
    patch = tmp_path / "patch.json"
    patch.write_text(json.dumps({"operations": [{"path": "src/app.py", "oldText": "old", "newText": "new"}, {"path": "src/added.py", "content": "x\n"}]}), encoding="utf-8")
    assert run(["workflow", "patch", "apply", "--context", "demo", "--release", "r1", "--patch-file", str(patch), "--approve", "--root", str(root), "--json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["applied"] == ["src/app.py", "src/added.py"]
    assert (root / "repos" / "demo" / "src" / "app.py").read_text() == "new\n"
    assert (root / payload["report"]).exists()


def test_patch_requires_approve_and_write_set(capsys, tmp_path):
    root = make_workspace(tmp_path)
    patch = tmp_path / "patch.json"
    patch.write_text(json.dumps({"path": "README.md", "content": "x"}), encoding="utf-8")
    assert run(["workflow", "patch", "apply", "--context", "demo", "--release", "r1", "--patch-file", str(patch), "--root", str(root), "--json"]) == 1
    assert json.loads(capsys.readouterr().err)["error"]["code"] == "PATCH_ERROR"
    assert run(["workflow", "patch", "apply", "--context", "demo", "--release", "r1", "--patch-file", str(patch), "--approve", "--root", str(root), "--json"]) == 1
    assert "outside" in json.loads(capsys.readouterr().err)["error"]["message"]
