from __future__ import annotations

import json
from pathlib import Path
from urllib.request import urlopen

from dadaia_pi.panel import start_panel_server
from dadaia_pi.workspace import Workspace


def make_workspace(tmp_path: Path) -> Workspace:
    root = tmp_path / "ws"
    (root / ".dadaia-pi" / "states").mkdir(parents=True)
    (root / ".dadaia-pi" / "sessions").mkdir(parents=True)
    (root / ".dadaia-pi" / "reports" / "demo").mkdir(parents=True)
    (root / ".dadaia-pi" / "handoff" / "demo").mkdir(parents=True)
    (root / "repos" / "demo" / "specs" / "memory" / "product").mkdir(parents=True)
    (root / "repos" / "demo" / "specs" / "releases" / "r1").mkdir(parents=True)
    (root / ".dadaia-pi" / "states" / "spec_contexts.json").write_text(json.dumps({
        "schemaVersion": 1,
        "contexts": [{"name": "demo", "repoSlug": "demo", "branch": "main", "state": "ALIVE"}],
    }), encoding="utf-8")
    (root / "repos" / "demo" / "specs" / "memory" / "product" / "catalog.json").write_text(json.dumps({
        "features": [{"slug": "product-vision", "title": "Product Vision", "path": "specs/memory/product/product-vision.md"}]
    }), encoding="utf-8")
    (root / "repos" / "demo" / "specs" / "memory" / "product" / "product-vision.md").write_text("# Product Vision\n", encoding="utf-8")
    (root / "repos" / "demo" / "specs" / "releases" / "ACTIVE.md").write_text("---\nrelease: r1\nphase: TASKS\n---\n", encoding="utf-8")
    for name in ["SPEC.md", "PLAN.md", "TASKS.md"]:
        (root / "repos" / "demo" / "specs" / "releases" / "r1" / name).write_text("**Status:** Aprovado\n", encoding="utf-8")
    (root / ".dadaia-pi" / "reports" / "demo" / "report.md").write_text("# Report\n", encoding="utf-8")
    (root / ".dadaia-pi" / "handoff" / "demo" / "handoff.json").write_text(json.dumps({"agent": "qa", "verdict": "APPROVED"}), encoding="utf-8")
    return Workspace(root)


def get_json(url: str):
    with urlopen(url) as response:
        return json.loads(response.read().decode("utf-8"))


def test_python_panel_serves_read_only_api(tmp_path):
    workspace = make_workspace(tmp_path)
    panel = start_panel_server(workspace, port=0)
    try:
        health = get_json(panel.url + "health")
        assert health["runtime"] == "python"
        status = get_json(panel.url + "api/status")
        assert status["runtime"] == "python"
        assert status["contexts"][0]["name"] == "demo"
        memory = get_json(panel.url + "api/memory?context=demo")
        assert memory[0]["slug"] == "product-vision"
        handoffs = get_json(panel.url + "api/handoffs")
        assert handoffs[0]["verdict"] == "APPROVED"
        workflows = get_json(panel.url + "api/workflow-definitions")
        assert any(item["id"] == "spec-review" for item in workflows)
        reports = get_json(panel.url + "api/reports")
        assert reports["contexts"][0]["reports"][0]["name"] == "report.md"
        with urlopen(panel.url) as response:
            html = response.read().decode("utf-8")
        assert "Python backend" in html
    finally:
        panel.stop()
