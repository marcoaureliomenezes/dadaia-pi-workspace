from __future__ import annotations

import json
from pathlib import Path

from dadaia_pi.cli import run


def make_workspace(tmp_path: Path) -> Path:
    root = tmp_path / "ws"
    repo = root / "repos" / "demo"
    (root / ".dadaia-pi" / "states").mkdir(parents=True)
    (root / ".dadaia-pi" / "sessions").mkdir(parents=True)
    (root / ".dadaia-pi" / "workflows" / "demo").mkdir(parents=True)
    (repo / "specs" / "backlog").mkdir(parents=True)
    (repo / "specs" / "releases" / "r1").mkdir(parents=True)
    (root / ".dadaia-pi" / "states" / "spec_contexts.json").write_text(json.dumps({"schemaVersion": 1, "contexts": [{"name": "demo", "repoSlug": "demo", "branch": "main", "state": "ALIVE"}]}), encoding="utf-8")
    (repo / "specs" / "releases" / "ACTIVE.md").write_text("---\nrelease: r1\nphase: CLOSURE\n---\n", encoding="utf-8")
    (repo / "specs" / "releases" / "r1" / "TASKS.md").write_text("**Status:** Aprovado\n\n- [x] T-1 Done\n", encoding="utf-8")
    for wid in ["qa-review", "security-review", "code-review", "release-closure"]:
        (root / ".dadaia-pi" / "workflows" / "demo" / f"{wid}.json").write_text(json.dumps({"workflowId": wid, "context": "demo", "release": "r1", "sdk": {"accepted": True}, "verdict": {"value": "APPROVED", "blockingFindings": 0}, "artifacts": {"manifest": f"m/{wid}.json"}}), encoding="utf-8")
    (repo / "specs" / "backlog" / "item.md").write_text("# Item\n", encoding="utf-8")
    return root


def test_evidence_bundle_and_readiness(capsys, tmp_path):
    root = make_workspace(tmp_path)
    assert run(["workflow", "evidence", "bundle", "--context", "demo", "--release", "r1", "--root", str(root), "--json"]) == 0
    bundle = json.loads(capsys.readouterr().out)
    assert bundle["manifestCount"] == 4
    assert (root / bundle["path"]).exists()

    assert run(["workflow", "readiness", "--context", "demo", "--release", "r1", "--root", str(root), "--json"]) == 0
    ready = json.loads(capsys.readouterr().out)
    assert ready["score"] >= 80
    assert ready["closureReady"] is True


def test_backlog_check_and_consume(capsys, tmp_path):
    root = make_workspace(tmp_path)
    prompt = tmp_path / "demand.md"
    prompt.write_text("Need feature", encoding="utf-8")
    assert run(["workflow", "backlog-check", "--context", "demo", "--prompt-file", str(prompt), "--root", str(root), "--json"]) == 0
    check = json.loads(capsys.readouterr().out)
    assert (root / check["report"]).exists()

    assert run(["workflow", "backlog-consume", "--context", "demo", "--release", "r1", "--backlog", "specs/backlog/item.md", "--root", str(root), "--json"]) == 0
    consumed = json.loads(capsys.readouterr().out)
    assert consumed["consumed"] is True
    assert "consumed_by_release: r1" in (root / "repos" / "demo" / "specs" / "backlog" / "item.md").read_text()
