from __future__ import annotations

import json
from pathlib import Path

from dadaia_pi.bridge import handle
from dadaia_pi.workspace import Workspace


def make_workspace(tmp_path: Path) -> Workspace:
    root = tmp_path / "ws"
    (root / ".dadaia-pi" / "states").mkdir(parents=True)
    (root / ".dadaia-pi" / "sessions").mkdir(parents=True)
    (root / "repos" / "demo" / "specs" / "releases").mkdir(parents=True)
    (root / "repos" / "demo" / "specs" / "memory" / "product").mkdir(parents=True)
    (root / ".dadaia-pi" / "states" / "spec_contexts.json").write_text(json.dumps({
        "schemaVersion": 1,
        "contexts": [{"name": "demo", "repoSlug": "demo", "branch": "main", "state": "ALIVE"}],
    }), encoding="utf-8")
    (root / "repos" / "demo" / "specs" / "constitution.md").write_text("# Constitution\n", encoding="utf-8")
    (root / "repos" / "demo" / "specs" / "memory" / "tech-stack.md").write_text("# Tech\n", encoding="utf-8")
    (root / "repos" / "demo" / "specs" / "memory" / "product" / "catalog.json").write_text("[]\n", encoding="utf-8")
    (root / "repos" / "demo" / "specs" / "releases" / "ACTIVE.md").write_text("---\nrelease: r1\nphase: IMPLEMENTATION\n---\n", encoding="utf-8")
    return Workspace(root)


def test_bridge_bind_status_bootstrap_release(tmp_path):
    ws = make_workspace(tmp_path)
    payload = {"cwd": str(ws.root), "sessionId": "s1", "args": "demo --mode implementation --release r1", "pid": 123}
    bound = handle("bind", payload)
    assert bound["ok"] is True
    assert bound["binding"]["mode"] == "BOUND_IMPLEMENTATION"

    status = handle("status", {"cwd": str(ws.root), "sessionId": "s1"})
    assert status["binding"]["context"] == "demo"

    bootstrap = handle("bootstrap", {"cwd": str(ws.root), "sessionId": "s1"})
    assert "policy_authority: python bridge" in bootstrap["content"]

    released = handle("release", {"cwd": str(ws.root), "sessionId": "s1"})
    assert released["ok"] is True
    assert not (ws.sessions_dir / "s1.json").exists()


def test_bridge_gate_blocks_read_mode_mutation(tmp_path):
    ws = make_workspace(tmp_path)
    handle("bind", {"cwd": str(ws.root), "sessionId": "s1", "args": "demo --mode read", "pid": 123})
    decision = handle("tool-check", {"cwd": str(ws.root), "sessionId": "s1", "toolName": "write", "input": {"path": "repos/demo/src/app.py"}})
    assert decision["allow"] is False
    assert "READ mode" in decision["reason"]


def test_bridge_bash_blocks_suspicious_implementation(tmp_path):
    ws = make_workspace(tmp_path)
    handle("bind", {"cwd": str(ws.root), "sessionId": "s1", "args": "demo --mode implementation --release r1", "pid": 123})
    decision = handle("bash-check", {"cwd": str(ws.root), "sessionId": "s1", "command": "python3 -c 'open(\"x\",\"w\").write(\"x\")'"})
    assert decision["allow"] is False
    assert "inline interpreter" in decision["reason"]
