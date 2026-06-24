from __future__ import annotations

import json
import subprocess
from pathlib import Path

from dadaia_pi.cli import run


def make_workspace(tmp_path: Path) -> Path:
    root = tmp_path / "ws"
    repo = root / "repos" / "demo"
    (root / ".dadaia-pi" / "states").mkdir(parents=True)
    (root / ".dadaia-pi" / "sessions").mkdir(parents=True)
    repo.mkdir(parents=True)
    (root / ".dadaia-pi" / "states" / "spec_contexts.json").write_text(json.dumps({"schemaVersion": 1, "contexts": [{"name": "demo", "repoSlug": "demo", "branch": "main", "state": "ALIVE"}]}), encoding="utf-8")
    subprocess.run(["git", "init"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "a@example.com"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.name", "a"], cwd=repo, check=True)
    (repo / "a.txt").write_text("a", encoding="utf-8")
    subprocess.run(["git", "add", "a.txt"], cwd=repo, check=True)
    subprocess.run(["git", "commit", "-m", "a"], cwd=repo, check=True, capture_output=True)
    base = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True).strip()
    (repo / "a.txt").write_text("b", encoding="utf-8")
    subprocess.run(["git", "commit", "-am", "b"], cwd=repo, check=True, capture_output=True)
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True).strip()
    (root / "range.txt").write_text(f"{base}..{head}", encoding="utf-8")
    return root


def test_rc_create_list_inspect(capsys, tmp_path):
    root = make_workspace(tmp_path)
    commit_range = (root / "range.txt").read_text().strip()
    assert run(["workflow", "rc", "create", "--context", "demo", "--release", "r1", "--rc-id", "rc-1", "--commits", commit_range, "--root", str(root), "--json"]) == 0
    created = json.loads(capsys.readouterr().out)
    assert created["id"] == "rc-1"
    assert created["reviews"] == {"qa": [], "security": [], "code": []}

    assert run(["workflow", "rc", "list", "--context", "demo", "--release", "r1", "--root", str(root), "--json"]) == 0
    listed = json.loads(capsys.readouterr().out)
    assert listed[0]["id"] == "rc-1"

    assert run(["workflow", "rc", "inspect", "--context", "demo", "--release", "r1", "--rc-id", "rc-1", "--root", str(root), "--json"]) == 0
    inspected = json.loads(capsys.readouterr().out)
    assert inspected["changedFiles"] == ["a.txt"]
    assert inspected["reviewStatus"] == {"qa": False, "security": False, "code": False}


def test_rc_create_from_to(capsys, tmp_path):
    root = make_workspace(tmp_path)
    base, head = (root / "range.txt").read_text().strip().split("..")
    assert run(["workflow", "rc", "create", "--context", "demo", "--release", "r1", "--rc-id", "rc-2", "--from", base, "--to", head, "--root", str(root), "--json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["commitRange"] == f"{base}..{head}"
