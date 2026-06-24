from __future__ import annotations

import json
from pathlib import Path

from dadaia_pi.cli import run


def make_workspace(tmp_path: Path, phase: str = "SPEC_REVIEW") -> Path:
    root = tmp_path / "ws"
    release = root / "repos" / "demo" / "specs" / "releases" / "r1"
    release.mkdir(parents=True)
    (root / ".dadaia-pi" / "states").mkdir(parents=True)
    (root / ".dadaia-pi" / "sessions").mkdir(parents=True)
    (root / ".dadaia-pi" / "workflows" / "demo").mkdir(parents=True)
    (root / "repos" / "demo" / "specs" / "releases" / "ACTIVE.md").write_text(f"---\nrelease: r1\nphase: {phase}\n---\n", encoding="utf-8")
    for name in ["SPEC.md", "PLAN.md"]:
        (release / name).write_text("**Status:** Aprovado\n", encoding="utf-8")
    (release / "TASKS.md").write_text("**Status:** Aprovado\n\n- [x] T-1 Done\n", encoding="utf-8")
    (root / ".dadaia-pi" / "states" / "spec_contexts.json").write_text(json.dumps({
        "schemaVersion": 1,
        "contexts": [{"name": "demo", "repoSlug": "demo", "branch": "main", "state": "ALIVE"}],
    }), encoding="utf-8")
    return root


def manifest(root: Path, workflow_id: str, release: str = "r1") -> None:
    path = root / ".dadaia-pi" / "workflows" / "demo" / f"001-{workflow_id}.json"
    path.write_text(json.dumps({
        "schemaVersion": 1,
        "workflowId": workflow_id,
        "context": "demo",
        "release": release,
        "sdk": {"accepted": True},
        "verdict": {"value": "APPROVED", "blockingFindings": 0},
    }), encoding="utf-8")


def test_workflow_status_blocks_missing_gate(capsys, tmp_path):
    root = make_workspace(tmp_path, "SPEC_REVIEW")
    assert run(["workflow", "status", "--context", "demo", "--release", "r1", "--root", str(root), "--json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["phase"] == "SPEC_REVIEW"
    assert payload["allowedNext"] == ["IMPLEMENTATION"]
    assert payload["canAdvance"] is False
    assert payload["gates"][0]["name"] == "spec-review"


def test_workflow_advance_with_gate(capsys, tmp_path):
    root = make_workspace(tmp_path, "SPEC_REVIEW")
    manifest(root, "spec-review")
    assert run(["workflow", "advance", "--context", "demo", "--release", "r1", "--to", "IMPLEMENTATION", "--root", str(root), "--json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["phase"] == "IMPLEMENTATION"
    assert "phase: IMPLEMENTATION" in (root / "repos" / "demo" / "specs" / "releases" / "ACTIVE.md").read_text(encoding="utf-8")


def test_workflow_advance_rejects_invalid_transition(capsys, tmp_path):
    root = make_workspace(tmp_path, "SPEC_REVIEW")
    assert run(["workflow", "advance", "--context", "demo", "--release", "r1", "--to", "ARCHIVED", "--root", str(root), "--json"]) == 1
    err = json.loads(capsys.readouterr().err)
    assert err["error"]["code"] == "WORKFLOW_GATE"


def test_closure_and_archived_gates(capsys, tmp_path):
    root = make_workspace(tmp_path, "CODE_REVIEW")
    for wid in ["qa-review", "security-review", "code-review"]:
        manifest(root, wid)
    assert run(["workflow", "advance", "--context", "demo", "--release", "r1", "--to", "CLOSURE", "--root", str(root), "--json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["phase"] == "CLOSURE"
    assert payload["canAdvance"] is False

    manifest(root, "release-closure")
    assert run(["workflow", "advance", "--context", "demo", "--release", "r1", "--to", "ARCHIVED", "--root", str(root), "--json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["phase"] == "ARCHIVED"
