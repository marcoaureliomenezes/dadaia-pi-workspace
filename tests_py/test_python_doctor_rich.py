from __future__ import annotations

import json
from pathlib import Path

from dadaia_pi.workspace_ops import doctor_workspace_install, init_workspace


def test_python_doctor_reports_workflow_and_rc_issues(tmp_path):
    root = tmp_path / "ws"
    package = Path(__file__).resolve().parents[1]
    init_workspace(root, package, skip_assets=False)
    wf = root / ".dadaia-pi" / "workflows" / "demo"
    wf.mkdir(parents=True)
    (wf / "bad.json").write_text("{", encoding="utf-8")
    rc = root / ".dadaia-pi" / "release-candidates" / "demo" / "r1"
    rc.mkdir(parents=True)
    (rc / "bad.json").write_text(json.dumps({"schemaVersion": 1, "id": "rc1", "reviews": {"qa": []}}), encoding="utf-8")
    result = doctor_workspace_install(root, package)
    codes = {issue["code"] for issue in result["issues"]}
    assert "PY-WORKFLOW-1" in codes
    assert "PY-RC-1" in codes
    assert result["ok"] is False


def test_python_doctor_passes_clean_workspace(tmp_path):
    root = tmp_path / "ws"
    package = Path(__file__).resolve().parents[1]
    init_workspace(root, package, skip_assets=False)
    result = doctor_workspace_install(root, package)
    assert result["ok"] is True
    assert result["authority"] == "python"
    assert result["mixedAuthorityDrift"] == []
