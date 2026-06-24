"""Python-owned read-only browser panel backend."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from .memory import list_memory, show_memory
from .status import build_status
from .version import __version__
from .workflows import workflow_list
from .workspace import Workspace

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 4999


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: Any) -> None:
    body = (json.dumps(payload, indent=2) + "\n").encode("utf-8")
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(body)))
    handler.send_header("x-content-type-options", "nosniff")
    handler.send_header("cache-control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def _text_response(handler: BaseHTTPRequestHandler, status: int, body: str, content_type: str = "text/plain; charset=utf-8") -> None:
    data = body.encode("utf-8")
    handler.send_response(status)
    handler.send_header("content-type", content_type)
    handler.send_header("content-length", str(len(data)))
    handler.send_header("x-content-type-options", "nosniff")
    handler.send_header("cache-control", "no-store")
    handler.end_headers()
    handler.wfile.write(data)


def _html() -> str:
    return """<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>dadaia-pi panel</title><style>body{margin:0;background:#111816;color:#eef8f2;font:14px system-ui}header{padding:24px;border-bottom:1px solid #2b4038}main{padding:24px;display:grid;gap:16px}.card{background:#18231f;border:1px solid #2b4038;border-radius:14px;padding:16px}pre{white-space:pre-wrap;background:#0b100e;padding:12px;border-radius:10px}a{color:#87d6ad}</style></head><body><header><h1>dadaia-pi workspace panel</h1><p>Python backend · local loopback · read-only</p></header><main><section class=\"card\"><h2>Status</h2><pre id=\"status\">loading...</pre></section><section class=\"card\"><h2>Workflows</h2><pre id=\"workflows\">loading...</pre></section><section class=\"card\"><h2>Reports</h2><pre id=\"reports\">loading...</pre></section></main><script>async function j(p){const r=await fetch(p);return r.json()}Promise.all([j('/api/status'),j('/api/workflow-definitions'),j('/api/reports')]).then(([s,w,r])=>{status.textContent=JSON.stringify(s,null,2);workflows.textContent=JSON.stringify(w,null,2);reports.textContent=JSON.stringify(r,null,2)}).catch(e=>{status.textContent=e.message})</script></body></html>"""


def _list_handoffs(workspace: Workspace, context: str | None = None) -> list[dict[str, Any]]:
    roots = [workspace.state_dir / "handoff" / context] if context else [p for p in (workspace.state_dir / "handoff").iterdir() if p.is_dir()] if (workspace.state_dir / "handoff").exists() else []
    out: list[dict[str, Any]] = []
    for root in roots:
        for path in sorted(root.rglob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                payload = {}
            out.append({
                "context": root.name,
                "path": path.relative_to(workspace.root).as_posix(),
                "agent": payload.get("agent"),
                "verdict": payload.get("verdict"),
                "producedAt": payload.get("producedAt") or payload.get("timestamp"),
            })
    return out


def _collect_reports(workspace: Workspace) -> dict[str, Any]:
    contexts = []
    reports_root = workspace.state_dir / "reports"
    if reports_root.exists():
        for ctx in sorted(p for p in reports_root.iterdir() if p.is_dir()):
            reports = []
            for path in sorted(ctx.rglob("*"), key=lambda p: p.stat().st_mtime if p.is_file() else 0, reverse=True):
                if path.is_file() and path.suffix.lower() in {".md", ".txt", ".json", ".html"}:
                    reports.append({"name": path.name, "path": path.relative_to(workspace.root).as_posix(), "modifiedAt": path.stat().st_mtime})
                if len(reports) >= 50:
                    break
            contexts.append({"context": ctx.name, "reports": reports})
    return {"contexts": contexts}


def _workflow_summary(workspace: Workspace) -> dict[str, Any]:
    status = build_status(workspace)
    contexts = []
    for context in status.get("contexts", []):
        name = context.get("name")
        latest = []
        workflow_dir = workspace.state_dir / "workflows" / str(name)
        if workflow_dir.exists():
            latest = [p.name for p in sorted(workflow_dir.glob("*.json"))[-5:]]
        contexts.append({"context": name, "repoSlug": context.get("repoSlug"), "release": (context.get("release") or {}).get("release"), "phase": (context.get("release") or {}).get("phase"), "latestManifests": latest})
    return {"contexts": contexts, "doctorIssues": [], "runtime": "python"}


def make_handler(workspace: Workspace):
    class PanelHandler(BaseHTTPRequestHandler):
        server_version = "dadaia-pi-python-panel/0.1"

        def log_message(self, _format: str, *args: Any) -> None:
            return

        def do_GET(self) -> None:  # noqa: N802 - stdlib callback
            try:
                parsed = urlparse(self.path)
                params = parse_qs(parsed.query)
                context = params.get("context", [None])[0]
                if parsed.path == "/":
                    _text_response(self, 200, _html(), "text/html; charset=utf-8")
                elif parsed.path in {"/health", "/api/panel-status"}:
                    _json_response(self, 200, {"status": "ok", "version": __version__, "root": str(workspace.root), "runtime": "python"})
                elif parsed.path in {"/api/status", "/api/contexts"}:
                    status = build_status(workspace)
                    _json_response(self, 200, status["contexts"] if parsed.path == "/api/contexts" else status)
                elif parsed.path == "/api/memory":
                    _json_response(self, 200, list_memory(workspace, context))
                elif parsed.path.startswith("/api/memory/"):
                    slug = unquote(parsed.path.removeprefix("/api/memory/"))
                    _json_response(self, 200, show_memory(workspace, slug, context))
                elif parsed.path == "/api/handoffs":
                    _json_response(self, 200, _list_handoffs(workspace, context))
                elif parsed.path == "/api/workflows":
                    _json_response(self, 200, _workflow_summary(workspace))
                elif parsed.path == "/api/workflow-definitions":
                    _json_response(self, 200, workflow_list())
                elif parsed.path == "/api/reports":
                    _json_response(self, 200, _collect_reports(workspace))
                else:
                    _text_response(self, 404, "not found\n")
            except Exception as exc:  # panel endpoint should report JSON errors
                _json_response(self, 500, {"error": str(exc), "runtime": "python"})
    return PanelHandler


class RunningPanel:
    def __init__(self, server: ThreadingHTTPServer, url: str) -> None:
        self.server = server
        self.url = url

    def stop(self) -> None:
        self.server.shutdown()
        self.server.server_close()


def start_panel_server(workspace: Workspace, *, host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> RunningPanel:
    if host != DEFAULT_HOST:
        raise ValueError(f"dadaia-pi panel supports loopback bind only. Got: {host}")
    server = ThreadingHTTPServer((host, port), make_handler(workspace))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    actual_port = int(server.server_address[1])
    return RunningPanel(server, f"http://{host}:{actual_port}/")


def run_panel(workspace: Workspace, *, host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    panel = start_panel_server(workspace, host=host, port=port)
    print(f"Panel running at {panel.url}", flush=True)
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        panel.stop()
