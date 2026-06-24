from __future__ import annotations

import json
import sys
from pathlib import Path

from dadaia_pi.cli import run
from dadaia_pi.pi_rpc import PiRpcClient, run_headless_prompt, text_from_rpc_events


def make_workspace(tmp_path: Path) -> Path:
    root = tmp_path / "ws"
    (root / ".dadaia-pi" / "states").mkdir(parents=True)
    (root / ".dadaia-pi" / "sessions").mkdir(parents=True)
    (root / "repos" / "demo" / "specs" / "releases" / "r1").mkdir(parents=True)
    (root / ".dadaia-pi" / "states" / "spec_contexts.json").write_text(json.dumps({
        "schemaVersion": 1,
        "contexts": [{"name": "demo", "repoSlug": "demo", "branch": "main", "state": "ALIVE"}],
    }), encoding="utf-8")
    for name in ["SPEC.md", "PLAN.md", "TASKS.md"]:
        (root / "repos" / "demo" / "specs" / "releases" / "r1" / name).write_text("**Status:** Aprovado\n", encoding="utf-8")
    return root


def test_rpc_client_lf_jsonl_with_fake_process(tmp_path):
    script = tmp_path / "fake_rpc.py"
    script.write_text(
        "import json,sys\n"
        "sys.stdin.readline()\n"
        "print(json.dumps({'type':'message_update','assistantMessageEvent':{'type':'text_delta','delta':'APPROVED'}}), flush=True)\n"
        "print(json.dumps({'type':'agent_end'}), flush=True)\n",
        encoding="utf-8",
    )
    client = PiRpcClient([sys.executable, str(script)]).start()
    try:
        events = client.prompt("hello")
    finally:
        client.close()
    assert events[-1]["type"] == "agent_end"
    assert text_from_rpc_events(events) == "APPROVED"


def test_headless_runner_with_fake_command():
    result = run_headless_prompt("ignored", command=[sys.executable, "-c", "print('APPROVED blockingFindings=0')"])
    assert result["accepted"] is True
    assert "APPROVED" in result["stdout"]


def test_workflow_list_show_and_dry_run(capsys, tmp_path):
    root = make_workspace(tmp_path)
    assert run(["workflow", "list", "--root", str(root), "--json"]) == 0
    workflows = json.loads(capsys.readouterr().out)
    assert any(item["id"] == "spec-review" for item in workflows)

    assert run(["workflow", "show", "spec-review", "--root", str(root), "--json"]) == 0
    shown = json.loads(capsys.readouterr().out)
    assert shown["phase"] == "SPEC_REVIEW"

    assert run(["workflow", "run", "spec-review", "--context", "demo", "--release", "r1", "--dry-run", "--root", str(root), "--json"]) == 0
    result = json.loads(capsys.readouterr().out)
    manifest = result["manifest"]
    assert manifest["runtime"] == "python"
    assert manifest["sdk"]["mode"] == "dry-run"
    assert manifest["verdict"]["value"] == "APPROVED"
    assert (root / manifest["artifacts"]["manifest"]).exists()
    assert (root / manifest["artifacts"]["report"]).exists()
