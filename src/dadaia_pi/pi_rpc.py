"""Pi RPC/headless subprocess clients for Python workflows."""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from typing import Any, Iterable


@dataclass
class RpcEvent:
    payload: dict[str, Any]


class PiRpcClient:
    """Small LF-delimited JSONL client for `pi --mode rpc`.

    The client deliberately reads records by splitting only on LF. This mirrors
    Pi RPC's documented framing and avoids generic line readers with broader
    Unicode separator semantics.
    """

    def __init__(self, command: list[str] | None = None) -> None:
        self.command = command or ["pi", "--mode", "rpc", "--no-session"]
        self.process: subprocess.Popen[str] | None = None
        self._buffer = ""

    def start(self) -> "PiRpcClient":
        self.process = subprocess.Popen(self.command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return self

    def close(self) -> None:
        if self.process and self.process.poll() is None:
            self.process.terminate()

    def send(self, command: dict[str, Any]) -> None:
        if not self.process or not self.process.stdin:
            raise RuntimeError("PiRpcClient is not started")
        self.process.stdin.write(json.dumps(command) + "\n")
        self.process.stdin.flush()

    def read_record(self) -> dict[str, Any]:
        if not self.process or not self.process.stdout:
            raise RuntimeError("PiRpcClient is not started")
        while "\n" not in self._buffer:
            chunk = self.process.stdout.read(1)
            if chunk == "":
                raise EOFError("Pi RPC process closed stdout")
            self._buffer += chunk
        line, self._buffer = self._buffer.split("\n", 1)
        if line.endswith("\r"):
            line = line[:-1]
        return json.loads(line)

    def prompt(self, message: str, *, request_id: str = "req-1") -> list[dict[str, Any]]:
        self.send({"id": request_id, "type": "prompt", "message": message})
        events: list[dict[str, Any]] = []
        while True:
            event = self.read_record()
            events.append(event)
            if event.get("type") == "agent_end":
                return events


def run_headless_prompt(prompt: str, *, mode: str = "json", approve: bool = False, model: str | None = None, command: list[str] | None = None) -> dict[str, Any]:
    args = command or ["pi", "--mode", mode, "-p", prompt]
    if approve and command is None:
        args.append("--approve")
    if model and command is None:
        args.extend(["--model", model])
    completed = subprocess.run(args, text=True, capture_output=True)
    return {
        "mode": "headless",
        "command": args,
        "returncode": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "accepted": completed.returncode == 0,
    }


def text_from_rpc_events(events: Iterable[dict[str, Any]]) -> str:
    chunks: list[str] = []
    for event in events:
        value = event.get("assistantMessageEvent")
        if isinstance(value, dict) and value.get("type") == "text_delta" and isinstance(value.get("delta"), str):
            chunks.append(value["delta"])
    return "".join(chunks)
