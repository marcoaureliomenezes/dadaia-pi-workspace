from __future__ import annotations

import subprocess
from pathlib import Path


def test_node_bin_shim_reaches_python_cli():
    repo = Path(__file__).resolve().parents[1]
    result = subprocess.run(["node", "bin/dadaia-pi.mjs", "--version"], cwd=repo, text=True, capture_output=True)
    assert result.returncode == 0
    assert result.stdout.strip() == "0.2.0"


def test_node_bin_shim_status_json():
    repo = Path(__file__).resolve().parents[1]
    result = subprocess.run(["node", "bin/dadaia-pi.mjs", "status", "--root", ".", "--json"], cwd=repo, text=True, capture_output=True)
    assert result.returncode == 0
    assert '"runtime": "python"' in result.stdout
