from __future__ import annotations

import json
from pathlib import Path

from dadaia_pi.cli import run
from dadaia_pi.workspace import discover_workspace


def test_version_command(capsys):
    assert run(["--version"]) == 0
    assert capsys.readouterr().out.strip()


def test_workspace_discovery_from_repo_root():
    workspace = discover_workspace(Path(__file__).resolve())
    assert workspace.root.name == "pi-agent"
    assert workspace.state_dir.name == ".dadaia-pi"


def test_status_json_smoke(capsys):
    repo_root = Path(__file__).resolve().parents[1]
    assert run(["status", "--root", str(repo_root), "--json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["runtime"] == "python"
    assert payload["doctor"]["errors"] == 0
    assert isinstance(payload["contexts"], list)
