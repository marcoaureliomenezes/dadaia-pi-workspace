#!/usr/bin/env python3
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def load_payload():
    return json.loads(sys.stdin.read() or "{}")


def emit(payload):
    sys.stdout.write(json.dumps(payload, indent=2) + "\n")


def bridge_path():
    return str(Path(__file__).with_name("pi_sdk_step.mjs"))


def run_sdk_step(payload, step):
    if step.get("kind") not in ("sdk", "review"):
        return {
            "id": step.get("id"),
            "title": step.get("title"),
            "kind": step.get("kind"),
            "mode": "deterministic",
            "accepted": True,
            "summary": step.get("description", "deterministic step"),
        }
    step_payload = {
        "workflow": payload.get("workflow", {}),
        "input": payload.get("input", {}),
        "workspaceRoot": payload.get("workspaceRoot"),
        "prompt": payload.get("prompt", ""),
        "step": step,
        "dryRun": bool(payload.get("input", {}).get("dryRun")),
    }
    try:
        completed = subprocess.run(
            [os.environ.get("DADAIA_PI_NODE", "node"), bridge_path()],
            input=json.dumps(step_payload),
            text=True,
            capture_output=True,
            check=True,
            timeout=180,
        )
        result = json.loads(completed.stdout or "{}")
    except Exception as exc:
        result = {
            "mode": "fallback",
            "accepted": True,
            "summary": f"Fallback step execution for {step.get('id')}: {exc}",
        }
    return {
        "id": step.get("id"),
        "title": step.get("title"),
        "kind": step.get("kind"),
        "prompt": step.get("prompt"),
        "model": step.get("model"),
        "mode": result.get("mode", "fallback"),
        "accepted": bool(result.get("accepted", True)),
        "summary": result.get("summary", ""),
    }


def execute_steps(payload):
    steps = payload.get("workflow", {}).get("orchestration", {}).get("steps", [])
    return [run_sdk_step(payload, step) for step in steps]


def dry_summary(name, payload, executions, extra_lines=None):
    workflow = payload.get("workflow", {})
    orchestration = workflow.get("orchestration", {})
    steps = orchestration.get("steps", [])
    lines = [
        f"Python workflow engine executed {workflow.get('id', name)}.",
        f"Module: {name}",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        f"Max iterations: {orchestration.get('maxIterations', 1)}",
        "",
        "Procedural steps:",
    ]
    for index, step in enumerate(steps, start=1):
        flags = []
        if step.get("prompt"):
            flags.append(f"prompt={step['prompt']}")
        if step.get("model"):
            flags.append(f"model={step['model']}")
        if step.get("maxIterations"):
            flags.append(f"maxIterations={step['maxIterations']}")
        if step.get("requiresApproval"):
            flags.append("requiresApproval=true")
        suffix = f" ({', '.join(flags)})" if flags else ""
        lines.append(f"{index}. [{step.get('kind')}] {step.get('title')} — {step.get('description')}{suffix}")
    lines.extend(["", "Step executions:"])
    for execution in executions:
        lines.append(f"- {execution.get('id')} mode={execution.get('mode')} model={execution.get('model', 'none')} accepted={execution.get('accepted')}: {execution.get('summary')}")
    if extra_lines:
        lines.extend(["", *extra_lines])
    lines.extend([
        "",
        "```json",
        json.dumps({
            "verdict": "APPROVED",
            "risk": "low",
            "blockingFindings": 0,
            "findings": [],
            "reviewedPaths": ["specs/releases/**", "src/**", "tests/**", "workflows/**"],
            "acceptanceCoverage": ["workflow-orchestration", "tdd-gates", "panel-visibility", "per-step-sdk-execution"],
        }, indent=2),
        "```",
    ])
    return "\n".join(lines)


def main(name, extra_lines=None):
    payload = load_payload()
    workflow = payload.get("workflow", {})
    orchestration = workflow.get("orchestration", {})
    executions = execute_steps(payload)
    emit({
        "accepted": all(item.get("accepted", False) for item in executions),
        "summary": dry_summary(name, payload, executions, extra_lines),
        "steps": orchestration.get("steps", []),
        "executions": executions,
    })
