from __future__ import annotations

import json
from pathlib import Path

from dadaia_pi.cli import run
from dadaia_pi.specs_doctor import run_specs_doctor
from dadaia_pi.workspace import discover_workspace


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def workspace_root() -> Path:
    return discover_workspace(repo_root()).root


def json_from_command(capsys, args: list[str]):
    assert run(args) == 0
    return json.loads(capsys.readouterr().out)


def test_context_list_and_show(capsys):
    root = repo_root()
    contexts = json_from_command(capsys, ["context", "list", "--root", str(root), "--json"])
    assert any(item["name"] == "dadaia-pi-workspace" for item in contexts)

    context = json_from_command(capsys, ["context", "show", "dadaia-pi-workspace", "--root", str(root), "--json"])
    assert context["repoSlug"] == "dadaia-pi-workspace"


def test_context_status_reads_binding(capsys):
    root = repo_root()
    binding = json_from_command(capsys, ["context", "status", "--session-id", "pi-agent-manual", "--root", str(root), "--json"])
    assert binding["context"] == "dadaia-pi-workspace"


def test_memory_list_and_show(capsys):
    root = repo_root()
    entries = json_from_command(capsys, ["memory", "list", "--context", "dadaia-pi-workspace", "--root", str(root), "--json"])
    assert any(item["slug"] == "product-vision" for item in entries)

    atom = json_from_command(capsys, ["memory", "show", "product-vision", "--context", "dadaia-pi-workspace", "--root", str(root), "--json"])
    assert atom["slug"] == "product-vision"
    assert "content" in atom


def test_specs_doctor_current_specs_passes(capsys):
    root = repo_root()
    payload = json_from_command(capsys, ["specs", "doctor", "--specs-dir", str(root / "specs"), "--json"])
    assert payload["summary"]["errors"] == 0


def test_specs_doctor_function_matches_shape():
    payload = run_specs_doctor(repo_root() / "specs")
    assert set(payload.keys()) == {"root", "issues", "summary"}
    assert payload["summary"]["errors"] == 0


def test_status_selects_bound_context(capsys):
    root = repo_root()
    payload = json_from_command(capsys, ["status", "--session-id", "pi-agent-manual", "--root", str(root), "--json"])
    assert payload["runtime"] == "python"
    assert payload["selectedContext"] == "dadaia-pi-workspace"
    active = (root / "specs" / "releases" / "ACTIVE.md").read_text()
    expected_release = next(line.split(":", 1)[1].strip() for line in active.splitlines() if line.startswith("release:"))
    selected = [item for item in payload["contexts"] if item["selected"]]
    assert selected and selected[0]["release"]["release"] == expected_release
