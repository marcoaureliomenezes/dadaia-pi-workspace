from __future__ import annotations

import json
from pathlib import Path

from dadaia_pi.cli import run


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_workspace_init_install_doctor_and_context_lifecycle(tmp_path, capsys):
    repo_root = Path(__file__).resolve().parents[1]
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    assert run(["workspace", "init", "--root", str(workspace), "--package-root", str(repo_root), "--json"]) == 0
    init_payload = json.loads(capsys.readouterr().out)
    assert init_payload["actions"]
    assert (workspace / ".dadaia-pi" / "states" / "spec_contexts.json").exists()
    assert (workspace / ".pi" / "settings.json").exists()

    assert run(["workspace", "doctor", "--root", str(workspace), "--package-root", str(repo_root), "--json"]) == 0
    doctor_payload = json.loads(capsys.readouterr().out)
    assert doctor_payload["ok"] is True
    assert doctor_payload["authority"] == "python"
    assert doctor_payload["mixedAuthorityDrift"] == []

    assert run(["context", "create", "demo", "--repo", "demo", "--url", "https://example.invalid/demo.git", "--root", str(workspace), "--json"]) == 0
    created = json.loads(capsys.readouterr().out)
    assert created["state"] == "DEAD"

    assert run(["context", "update", "demo", "--branch", "trunk", "--root", str(workspace), "--json"]) == 0
    updated = json.loads(capsys.readouterr().out)
    assert updated["branch"] == "trunk"

    (workspace / "repos" / "demo").mkdir(parents=True)
    assert run(["context", "alive", "demo", "--root", str(workspace), "--json"]) == 0
    alive = json.loads(capsys.readouterr().out)
    assert alive["state"] == "ALIVE"

    assert run(["context", "bind", "demo", "--session-id", "s1", "--mode", "implementation", "--release", "r1", "--root", str(workspace), "--json"]) == 0
    binding = json.loads(capsys.readouterr().out)
    assert binding["mode"] == "BOUND_IMPLEMENTATION"
    assert read_json(workspace / ".dadaia-pi" / "sessions" / "s1.json")["context"] == "demo"

    assert run(["context", "release", "--session-id", "s1", "--root", str(workspace), "--json"]) == 0
    capsys.readouterr()
    assert not (workspace / ".dadaia-pi" / "sessions" / "s1.json").exists()

    assert run(["context", "dead", "demo", "--root", str(workspace), "--json"]) == 0
    dead = json.loads(capsys.readouterr().out)
    assert dead["state"] == "DEAD"


def test_specs_scaffold_and_package_project_settings(tmp_path, capsys):
    workspace = tmp_path / "workspace"
    specs = tmp_path / "specs"
    workspace.mkdir()
    assert run(["workspace", "init", "--root", str(workspace), "--skip-assets", "--json"]) == 0
    capsys.readouterr()

    assert run(["specs", "scaffold", "--specs-dir", str(specs), "--json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["actions"]
    assert (specs / "constitution.md").exists()
    assert (specs / "memory" / "product" / "catalog.json").exists()

    assert run(["package", "project-settings", "--source", "npm:dadaia-pi-workspace@0.2.0", "--root", str(workspace), "--json"]) == 0
    settings = read_json(workspace / ".pi" / "settings.json")
    assert settings == {"packages": ["npm:dadaia-pi-workspace@0.2.0"]}
