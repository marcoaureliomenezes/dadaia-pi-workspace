from __future__ import annotations

import json
from pathlib import Path

from dadaia_pi.workspace_ops import doctor_workspace_install, init_workspace


def test_authority_doctor_requires_python_bin_and_legacy_markers(tmp_path):
    root = tmp_path / "ws"
    package = tmp_path / "pkg"
    (package / "extensions").mkdir(parents=True)
    (package / "src" / "cli").mkdir(parents=True)
    (package / "src" / "features").mkdir(parents=True)
    (package / "skills").mkdir()
    (package / "prompts").mkdir()
    (package / "extensions" / "dadaia-pi.ts").write_text("pi-bridge", encoding="utf-8")
    (package / "package.json").write_text(json.dumps({"bin": {"dadaia-pi": "./dist/src/cli/main.js"}}), encoding="utf-8")
    init_workspace(root, package, skip_assets=True)
    result = doctor_workspace_install(root, package)
    codes = {issue["code"] for issue in result["issues"]}
    assert "PY-AUTHORITY-2" in codes
    assert "PY-AUTHORITY-3" in codes


def test_authority_doctor_current_package_boundary_ok(tmp_path):
    root = tmp_path / "ws"
    package = Path(__file__).resolve().parents[1]
    init_workspace(root, package, skip_assets=False)
    result = doctor_workspace_install(root, package)
    codes = {issue["code"] for issue in result["issues"]}
    assert "PY-AUTHORITY-2" not in codes
    assert "PY-AUTHORITY-3" not in codes
