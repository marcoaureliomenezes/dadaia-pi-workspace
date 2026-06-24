from __future__ import annotations

import json
from pathlib import Path

from dadaia_pi.cli import run
from dadaia_pi.handoff import validate_handoff_record


def make_workspace(tmp_path: Path) -> Path:
    root = tmp_path / "ws"
    (root / ".dadaia-pi" / "states").mkdir(parents=True)
    (root / ".dadaia-pi" / "sessions").mkdir(parents=True)
    (root / ".dadaia-pi" / "handoff" / "demo").mkdir(parents=True)
    (root / "repos").mkdir()
    (root / ".dadaia-pi" / "states" / "spec_contexts.json").write_text(json.dumps({"schemaVersion": 1, "contexts": []}), encoding="utf-8")
    return root


def valid_record(**overrides):
    record = {
        "schemaVersion": 1,
        "context": "demo",
        "sessionId": "s1",
        "agent": "qa-reviewer",
        "producedAt": "2026-06-23T01:00:00Z",
        "scope": "test",
        "artifact": {"type": "handoff"},
        "metrics": {},
        "findings": [],
        "verdict": "APPROVED",
    }
    record.update(overrides)
    return record


def test_handoff_record_validation():
    assert validate_handoff_record(valid_record()) == []
    errors = validate_handoff_record({"schemaVersion": 1})
    assert "context must be a non-empty string" in errors
    assert "artifact must be an object" in errors


def test_handoff_validate_list_and_filter(capsys, tmp_path):
    root = make_workspace(tmp_path)
    good = root / ".dadaia-pi" / "handoff" / "demo" / "good.handoff.json"
    good.write_text(json.dumps(valid_record()), encoding="utf-8")
    bad = root / ".dadaia-pi" / "handoff" / "demo" / "bad.handoff.json"
    bad.write_text(json.dumps({"schemaVersion": 1}), encoding="utf-8")

    assert run(["handoff", "validate", str(good), "--json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["ok"] is True

    assert run(["handoff", "validate", str(bad), "--json"]) == 1
    payload = json.loads(capsys.readouterr().out)
    assert payload["ok"] is False

    assert run(["handoff", "list", "--context", "demo", "--root", str(root), "--json"]) == 1
    items = json.loads(capsys.readouterr().out)
    assert len(items) == 2
    assert any(not item["ok"] for item in items)


def test_approve_security_generates_valid_handoff(capsys, tmp_path):
    root = make_workspace(tmp_path)
    sha = "0123456789abcdef0123456789abcdef01234567"
    assert run([
        "handoff", "approve-security",
        "--context", "demo",
        "--commit", sha,
        "--session-id", "s1",
        "--release", "r1",
        "--scope", "manual approval",
        "--root", str(root),
        "--json",
    ]) == 0
    payload = json.loads(capsys.readouterr().out)
    path = Path(payload["path"])
    assert path.exists()
    assert run(["handoff", "validate", str(path), "--json"]) == 0
    validation = json.loads(capsys.readouterr().out)
    assert validation["ok"] is True

    assert run(["handoff", "list", "--context", "demo", "--root", str(root), "--json"]) == 0
    items = json.loads(capsys.readouterr().out)
    assert items[0]["commitSha"] == sha


def test_approve_security_rejects_bad_sha(capsys, tmp_path):
    root = make_workspace(tmp_path)
    assert run(["handoff", "approve-security", "--context", "demo", "--commit", "bad", "--root", str(root), "--json"]) == 1
    err = json.loads(capsys.readouterr().err)
    assert err["error"]["code"] == "HANDOFF_ERROR"
