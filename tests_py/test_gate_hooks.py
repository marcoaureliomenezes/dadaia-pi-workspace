from __future__ import annotations

import json
import subprocess
from pathlib import Path

from dadaia_pi.gate import (
    acquire_lease,
    classify_path,
    evaluate_gate,
    infer_bash_target_paths,
    matches_write_set,
    parse_reserved_task_write_set,
)
from dadaia_pi.hooks import install_hooks, pre_commit_check, pre_push_check
from dadaia_pi.workspace import Workspace


def make_workspace(tmp_path: Path) -> Workspace:
    root = tmp_path / "ws"
    (root / ".dadaia-pi" / "states").mkdir(parents=True)
    (root / ".dadaia-pi" / "sessions").mkdir(parents=True)
    (root / "repos").mkdir()
    (root / ".dadaia-pi" / "states" / "spec_contexts.json").write_text(json.dumps({
        "schemaVersion": 1,
        "contexts": [{"name": "demo", "repoSlug": "demo", "branch": "main", "state": "ALIVE"}],
    }), encoding="utf-8")
    return Workspace(root)


def test_path_classification_and_bash_targets(tmp_path):
    ws = make_workspace(tmp_path)
    assert classify_path(ws, ws.root / "repos" / "demo" / "src" / "app.py")["pathClass"] == "MUTATING"
    assert classify_path(ws, ws.root / "repos" / "demo" / "specs" / "backlog" / "x.md")["pathClass"] == "ADDITIVE"
    assert classify_path(ws, ws.root / ".dadaia-pi" / "states" / "x.json")["pathClass"] == "PROTECTED"
    targets = infer_bash_target_paths(ws.root, "mkdir foo && echo hi > repos/demo/src/out.txt && rm old.txt")
    assert str(ws.root / "repos/demo/src/out.txt") in targets
    assert str(ws.root / "foo") in targets


def test_gate_leases_allow_reclaim_and_block(tmp_path):
    ws = make_workspace(tmp_path)
    session = {"sessionId": "s1", "context": "demo", "mode": "BOUND_IMPLEMENTATION", "release": "r1"}
    (ws.sessions_dir / "s1.json").write_text(json.dumps(session), encoding="utf-8")
    decision = evaluate_gate(ws, session_id="s1", target_paths=[str(ws.root / "repos/demo/src/app.py")], pid=123)
    assert decision["allow"] is True
    assert decision["lease"]["status"] == "ACQUIRED"

    other = {"sessionId": "s2", "context": "demo", "mode": "BOUND_IMPLEMENTATION", "release": "r1"}
    (ws.sessions_dir / "s2.json").write_text(json.dumps(other), encoding="utf-8")
    blocked = evaluate_gate(ws, session_id="s2", target_paths=[str(ws.root / "repos/demo/src/app.py")])
    assert blocked["allow"] is False
    assert "held by s1" in blocked["reason"]


def test_write_set_parser_and_matching():
    text = """# TASKS\n\n- [-] T-1 Do thing\n  - Write set: `src/**`, `tests/*.py`\n\n- [ ] T-2 Other\n"""
    parsed = parse_reserved_task_write_set(text)
    assert parsed is not None
    assert matches_write_set("src/app/main.py", parsed["patterns"])
    assert matches_write_set("tests/test_app.py", parsed["patterns"])
    assert not matches_write_set("docs/readme.md", parsed["patterns"])


def test_hook_install_and_precommit_no_mutating_paths(tmp_path):
    ws = make_workspace(tmp_path)
    repo = ws.root / "repos" / "demo"
    repo.mkdir(parents=True)
    subprocess.run(["git", "init"], cwd=repo, check=True, capture_output=True)
    paths = install_hooks(repo)
    assert all(Path(path).exists() for path in paths)
    (repo / "specs" / "backlog").mkdir(parents=True)
    (repo / "specs" / "backlog" / "idea.md").write_text("idea", encoding="utf-8")
    subprocess.run(["git", "add", "specs/backlog/idea.md"], cwd=repo, check=True)
    result = pre_commit_check(ws, repo, session_id="s1")
    assert result["ok"] is True
    assert "no mutating" in result["messages"][0]


def test_prepush_requires_security_handoff(tmp_path):
    ws = make_workspace(tmp_path)
    stdin = "refs/heads/main abcdef123456 refs/heads/main 111111111111\n"
    blocked = pre_push_check(ws, stdin)
    assert blocked["ok"] is False
    handoff = ws.state_dir / "handoff" / "demo" / "security.json"
    handoff.parent.mkdir(parents=True)
    handoff.write_text(json.dumps({"agent": "security-reviewer", "verdict": "APPROVED", "metrics": {"commit_sha": "abcdef123456"}}), encoding="utf-8")
    ok = pre_push_check(ws, stdin)
    assert ok["ok"] is True
