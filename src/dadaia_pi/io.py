"""CLI formatting helpers."""

from __future__ import annotations

import json
import sys
from typing import Any, TextIO


def emit_json(payload: Any, *, stream: TextIO | None = None) -> None:
    target = stream or sys.stdout
    target.write(json.dumps(payload, indent=2, sort_keys=False) + "\n")


def emit_text(message: str, *, stream: TextIO | None = None) -> None:
    target = stream or sys.stdout
    target.write(message.rstrip() + "\n")


def error_payload(message: str, *, code: str = "DADAIA_ERROR") -> dict[str, Any]:
    return {"ok": False, "error": {"code": code, "message": message}}
