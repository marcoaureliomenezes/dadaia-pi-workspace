"""Python console entrypoint for dadaia-pi."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Sequence

from .context import list_contexts, read_binding, show_context
from .bridge import run_bridge
from .context_mutation import alive_context, bind_context, create_context, dead_context, release_context, update_context
from .errors import DadaiaError
from .handoff import emit_security_approval, format_handoff_item, list_handoffs, validate_handoff_file
from .hooks import default_workspace_for_hook, install_hooks, pre_commit_check, pre_push_check, uninstall_hooks
from .io import emit_json, emit_text, error_payload
from .memory import list_memory, show_memory
from .panel import run_panel, start_panel_server
from .specs_doctor import run_specs_doctor
from .specs_scaffold import scaffold_specs
from .status import build_status
from .version import __version__
from .workspace import Workspace, discover_workspace
from .workspace_ops import doctor_workspace_install, init_workspace, install_workspace, project_settings
from .workflows import WorkflowRunOptions, backlog_check, backlog_consume, commit_range_from_endpoints, evidence_bundle, patch_apply, rc_create, rc_inspect, rc_list, readiness, run_workflow, workflow_advance, workflow_list, workflow_show, workflow_status


def _add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--json", action="store_true", help="Emit JSON output.")
    parser.add_argument("--root", help="Workspace root or descendant path. Defaults to current directory.")


def _add_package_root(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--package-root", default=".", help="Package/source root used for skills/prompts projection.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="dadaia-pi", description="Python-first Pi-native SDD workspace manager.")
    parser.add_argument("--version", action="store_true", help="Print the Python CLI version and exit.")
    subparsers = parser.add_subparsers(dest="command")

    status = subparsers.add_parser("status", help="Show workspace status.")
    _add_common(status)
    status.add_argument("--session-id")
    status.add_argument("--context")

    panel = subparsers.add_parser("panel", help="Start the Python read-only browser panel.")
    _add_common(panel)
    panel.add_argument("--port", type=int, default=4999)
    panel.add_argument("--bind", default="127.0.0.1")
    panel.add_argument("--no-open", action="store_true", help="Accepted for compatibility; Python panel does not open a browser yet.")

    workspace = subparsers.add_parser("workspace", help="Scaffold, install, and doctor workspace resources.")
    workspace_sub = workspace.add_subparsers(dest="workspace_command")
    for name in ["init", "install", "doctor"]:
        command = workspace_sub.add_parser(name)
        _add_common(command)
        _add_package_root(command)
    workspace_sub.choices["init"].add_argument("--skip-assets", action="store_true")

    context = subparsers.add_parser("context", help="Manage Spec Context registry.")
    context_sub = context.add_subparsers(dest="context_command")
    context_list = context_sub.add_parser("list"); _add_common(context_list)
    context_show = context_sub.add_parser("show"); _add_common(context_show); context_show.add_argument("name")
    context_create = context_sub.add_parser("create"); _add_common(context_create); context_create.add_argument("name"); context_create.add_argument("--repo", required=True); context_create.add_argument("--url"); context_create.add_argument("--branch", default="main")
    context_update = context_sub.add_parser("update"); _add_common(context_update); context_update.add_argument("name"); context_update.add_argument("--url"); context_update.add_argument("--branch")
    context_alive = context_sub.add_parser("alive"); _add_common(context_alive); context_alive.add_argument("name")
    context_dead = context_sub.add_parser("dead"); _add_common(context_dead); context_dead.add_argument("name")
    context_bind = context_sub.add_parser("bind"); _add_common(context_bind); context_bind.add_argument("name"); context_bind.add_argument("--session-id", required=True); context_bind.add_argument("--mode", choices=["read", "implementation", "review"], default="read"); context_bind.add_argument("--release")
    context_status = context_sub.add_parser("status"); _add_common(context_status); context_status.add_argument("--session-id", required=True)
    context_release = context_sub.add_parser("release"); _add_common(context_release); context_release.add_argument("--session-id", required=True)

    memory = subparsers.add_parser("memory", help="Navigate product memory.")
    memory_sub = memory.add_subparsers(dest="memory_command")
    memory_list = memory_sub.add_parser("list"); _add_common(memory_list); memory_list.add_argument("--context")
    memory_show = memory_sub.add_parser("show"); _add_common(memory_show); memory_show.add_argument("slug"); memory_show.add_argument("--context")

    specs = subparsers.add_parser("specs", help="Specs tree commands.")
    specs_sub = specs.add_subparsers(dest="specs_command")
    specs_scaffold = specs_sub.add_parser("scaffold"); specs_scaffold.add_argument("--specs-dir", default="specs"); specs_scaffold.add_argument("--json", action="store_true")
    specs_doctor = specs_sub.add_parser("doctor"); specs_doctor.add_argument("--specs-dir", default="specs"); specs_doctor.add_argument("--json", action="store_true")

    bridge = subparsers.add_parser("pi-bridge", help="Internal JSON bridge for Pi extension adapters.")
    bridge.add_argument("operation")

    handoff = subparsers.add_parser("handoff", help="Validate, list, and emit lifecycle handoffs.")
    handoff_sub = handoff.add_subparsers(dest="handoff_command")
    hv = handoff_sub.add_parser("validate"); hv.add_argument("file"); hv.add_argument("--json", action="store_true")
    hl = handoff_sub.add_parser("list"); _add_common(hl); hl.add_argument("--context")
    hs = handoff_sub.add_parser("approve-security"); _add_common(hs); hs.add_argument("--context", required=True); hs.add_argument("--commit", required=True); hs.add_argument("--session-id"); hs.add_argument("--scope"); hs.add_argument("--release")

    hooks = subparsers.add_parser("hooks", help="Install and run git chokepoint checks.")
    hooks_sub = hooks.add_subparsers(dest="hooks_command")
    hi = hooks_sub.add_parser("install"); hi.add_argument("--repo-root", default="."); hi.add_argument("--json", action="store_true")
    hu = hooks_sub.add_parser("uninstall"); hu.add_argument("--repo-root", default="."); hu.add_argument("--json", action="store_true")
    hpc = hooks_sub.add_parser("pre-commit-check"); hpc.add_argument("--repo-root", default="."); hpc.add_argument("--session-id", default=os.environ.get("DADAIA_PI_SESSION_ID")); hpc.add_argument("--json", action="store_true")
    hpp = hooks_sub.add_parser("pre-push-check"); hpp.add_argument("--json", action="store_true")

    workflow = subparsers.add_parser("workflow", help="Run deterministic lifecycle workflows.")
    workflow_sub = workflow.add_subparsers(dest="workflow_command")
    wl = workflow_sub.add_parser("list"); _add_common(wl)
    ws = workflow_sub.add_parser("show"); _add_common(ws); ws.add_argument("workflow")
    wb = workflow_sub.add_parser("backlog-check"); _add_common(wb); wb.add_argument("--context", required=True); wb.add_argument("--prompt-file", required=True)
    wbc = workflow_sub.add_parser("backlog-consume"); _add_common(wbc); wbc.add_argument("--context", required=True); wbc.add_argument("--release", required=True); wbc.add_argument("--backlog", required=True)
    we = workflow_sub.add_parser("evidence"); we_sub = we.add_subparsers(dest="evidence_command"); web = we_sub.add_parser("bundle"); _add_common(web); web.add_argument("--context", required=True); web.add_argument("--release", required=True); web.add_argument("--prune", action="store_true")
    wrd = workflow_sub.add_parser("readiness"); _add_common(wrd); wrd.add_argument("--context", required=True); wrd.add_argument("--release", required=True)
    wg = workflow_sub.add_parser("status"); _add_common(wg); wg.add_argument("--context", required=True); wg.add_argument("--release", required=True)
    wa = workflow_sub.add_parser("advance"); _add_common(wa); wa.add_argument("--context", required=True); wa.add_argument("--release", required=True); wa.add_argument("--to", required=True)
    patch = workflow_sub.add_parser("patch"); patch_sub = patch.add_subparsers(dest="patch_command")
    pa = patch_sub.add_parser("apply"); _add_common(pa); pa.add_argument("--context", required=True); pa.add_argument("--release", required=True); pa.add_argument("--patch-file", required=True); pa.add_argument("--approve", action="store_true")
    rc = workflow_sub.add_parser("rc"); rc_sub = rc.add_subparsers(dest="rc_command")
    rcc = rc_sub.add_parser("create"); _add_common(rcc); rcc.add_argument("--context", required=True); rcc.add_argument("--release", required=True); rcc.add_argument("--rc-id", required=True); rcc.add_argument("--commits"); rcc.add_argument("--from", dest="from_sha"); rcc.add_argument("--to", dest="to_sha")
    rcl = rc_sub.add_parser("list"); _add_common(rcl); rcl.add_argument("--context", required=True); rcl.add_argument("--release", required=True)
    rci = rc_sub.add_parser("inspect"); _add_common(rci); rci.add_argument("--context", required=True); rci.add_argument("--release", required=True); rci.add_argument("--rc-id", required=True)
    wr = workflow_sub.add_parser("run"); _add_common(wr); wr.add_argument("workflow"); wr.add_argument("--context", required=True); wr.add_argument("--release"); wr.add_argument("--prompt-file"); wr.add_argument("--model"); wr.add_argument("--verdict", choices=["APPROVED", "NEEDS_CHANGES", "REJECTED"]); wr.add_argument("--dry-run", action="store_true"); wr.add_argument("--pi-mode", choices=["headless", "rpc"], default="headless")

    package = subparsers.add_parser("package", help="Package helper commands.")
    package_sub = package.add_subparsers(dest="package_command")
    ps = package_sub.add_parser("project-settings"); _add_common(ps); ps.add_argument("--source", required=True)

    return parser


def _workspace_from_args(args: argparse.Namespace) -> Workspace:
    start = Path(args.root).resolve() if getattr(args, "root", None) else Path.cwd()
    return discover_workspace(start)


def _workspace_root_for_mutation(args: argparse.Namespace) -> Path:
    if getattr(args, "root", None):
        return Path(args.root).resolve()
    return Path.cwd().resolve()


def _package_root(args: argparse.Namespace) -> Path:
    return Path(args.package_root).resolve()


def _emit(payload, args: argparse.Namespace, text: str | None = None) -> None:
    if getattr(args, "json", False):
        emit_json(payload)
    else:
        emit_text(text if text is not None else str(payload))


def _command_status(args: argparse.Namespace) -> int:
    payload = build_status(_workspace_from_args(args), session_id=args.session_id, context=args.context)
    if args.json:
        emit_json(payload)
    else:
        emit_text(f"workspace: {payload['root']}")
        emit_text(f"runtime: {payload['runtime']}")
        emit_text(f"doctor: {payload['doctor']['errors']} errors, {payload['doctor']['warnings']} warnings")
        for context in payload["contexts"]:
            marker = "*" if context.get("selected") else "-"
            emit_text(f"{marker} {context.get('name')} [{context.get('state')}]")
    return 0


def _command_panel(args: argparse.Namespace) -> int:
    workspace = _workspace_from_args(args)
    if args.json:
        panel = start_panel_server(workspace, host=args.bind, port=args.port)
        try:
            emit_json({"url": panel.url, "runtime": "python"})
        finally:
            panel.stop()
        return 0
    run_panel(workspace, host=args.bind, port=args.port)
    return 0


def _command_workspace(args: argparse.Namespace) -> int:
    root = _workspace_root_for_mutation(args)
    package_root = _package_root(args)
    if args.workspace_command == "init":
        payload = init_workspace(root, package_root, skip_assets=args.skip_assets)
        _emit(payload, args, "\n".join(payload["actions"]))
        return 0
    if args.workspace_command == "install":
        workspace = _workspace_from_args(args)
        payload = install_workspace(workspace.root, package_root)
        _emit(payload, args, "\n".join(payload["actions"]))
        return 0
    if args.workspace_command == "doctor":
        workspace = _workspace_from_args(args)
        payload = doctor_workspace_install(workspace.root, package_root)
        _emit(payload, args, "\n".join(payload["reports"]))
        return 0 if payload["ok"] else 1
    raise DadaiaError("Missing workspace subcommand", code="USAGE", exit_code=2)


def _command_context(args: argparse.Namespace) -> int:
    workspace = _workspace_from_args(args)
    cmd = args.context_command
    if cmd == "list":
        payload = list_contexts(workspace); _emit(payload, args, "\n".join(f"{c.get('name')}\t{c.get('repoSlug')}\t{c.get('state')}" for c in payload)); return 0
    if cmd == "show":
        payload = show_context(workspace, args.name); _emit(payload, args, f"{payload.get('name')} -> repos/{payload.get('repoSlug')} [{payload.get('state')}]"); return 0
    if cmd == "create":
        payload = create_context(workspace, args.name, args.repo, repo_url=args.url, branch=args.branch); _emit(payload, args, f"created {payload['name']}"); return 0
    if cmd == "update":
        payload = update_context(workspace, args.name, repo_url=args.url, branch=args.branch); _emit(payload, args, f"updated {payload['name']}"); return 0
    if cmd == "alive":
        payload = alive_context(workspace, args.name); _emit(payload, args, f"alive {payload['name']}"); return 0
    if cmd == "dead":
        payload = dead_context(workspace, args.name); _emit(payload, args, f"dead {payload['name']}"); return 0
    if cmd == "bind":
        payload = bind_context(workspace, args.name, session_id=args.session_id, mode=args.mode, release=args.release, pid=os.getpid()); _emit(payload, args, f"bound {payload['sessionId']} -> {payload['context']}"); return 0
    if cmd == "status":
        payload = read_binding(workspace, args.session_id)
        if not payload: raise DadaiaError(f"No binding for session: {args.session_id}", code="BINDING_NOT_FOUND", exit_code=1)
        _emit(payload, args, f"{payload.get('sessionId')} -> {payload.get('context')} [{payload.get('mode')}]"); return 0
    if cmd == "release":
        release_context(workspace, args.session_id); _emit({"released": args.session_id}, args, f"released {args.session_id}"); return 0
    raise DadaiaError("Missing context subcommand", code="USAGE", exit_code=2)


def _command_memory(args: argparse.Namespace) -> int:
    workspace = _workspace_from_args(args)
    if args.memory_command == "list":
        payload = list_memory(workspace, args.context); _emit(payload, args, "\n".join(f"{i.get('slug')}\t{i.get('title', '')}" for i in payload)); return 0
    if args.memory_command == "show":
        payload = show_memory(workspace, args.slug, args.context); _emit(payload, args, payload["content"]); return 0
    raise DadaiaError("Missing memory subcommand", code="USAGE", exit_code=2)


def _command_specs(args: argparse.Namespace) -> int:
    if args.specs_command == "scaffold":
        payload = scaffold_specs(Path(args.specs_dir)); _emit(payload, args, "\n".join(payload["actions"])); return 0
    if args.specs_command == "doctor":
        payload = run_specs_doctor(Path(args.specs_dir)); _emit(payload, args, f"Specs doctor: {payload['summary']['errors']} errors, {payload['summary']['warnings']} warnings"); return 1 if payload["summary"]["errors"] else 0
    raise DadaiaError("Missing specs subcommand", code="USAGE", exit_code=2)


def _command_handoff(args: argparse.Namespace) -> int:
    if args.handoff_command == "validate":
        payload = validate_handoff_file(Path(args.file))
        _emit(payload, args, f"ok: {payload['path']}" if payload["ok"] else f"[ERROR] {payload['path']} — {'; '.join(payload['errors'])}")
        return 0 if payload["ok"] else 1
    if args.handoff_command == "list":
        workspace = _workspace_from_args(args)
        payload = list_handoffs(workspace, args.context)
        _emit(payload, args, "no handoffs" if not payload else "\n".join(format_handoff_item(item) for item in payload))
        return 1 if any(not item.get("ok") for item in payload) else 0
    if args.handoff_command == "approve-security":
        workspace = _workspace_from_args(args)
        try:
            path = emit_security_approval(workspace, context=args.context, commit_sha=args.commit, session_id=args.session_id, scope=args.scope, release=args.release)
        except ValueError as exc:
            raise DadaiaError(str(exc), code="HANDOFF_ERROR", exit_code=1) from exc
        payload = {"path": str(path)}
        _emit(payload, args, f"wrote {path}")
        return 0
    raise DadaiaError("Missing handoff subcommand", code="USAGE", exit_code=2)


def _command_hooks(args: argparse.Namespace) -> int:
    if args.hooks_command == "install":
        payload = {"hooks": install_hooks(Path(args.repo_root).resolve())}
        _emit(payload, args, "\n".join(payload["hooks"]))
        return 0
    if args.hooks_command == "uninstall":
        uninstall_hooks(Path(args.repo_root).resolve())
        _emit({"ok": True}, args, "hooks uninstalled")
        return 0
    if args.hooks_command == "pre-commit-check":
        repo_root = Path(args.repo_root).resolve()
        payload = pre_commit_check(default_workspace_for_hook(repo_root), repo_root, args.session_id)
        _emit(payload, args, "\n".join(payload["messages"]))
        return 0 if payload["ok"] else 1
    if args.hooks_command == "pre-push-check":
        payload = pre_push_check(default_workspace_for_hook(Path.cwd()), sys.stdin.read())
        _emit(payload, args, "\n".join(payload["messages"]))
        return 0 if payload["ok"] else 1
    raise DadaiaError("Missing hooks subcommand", code="USAGE", exit_code=2)


def _command_workflow(args: argparse.Namespace) -> int:
    if args.workflow_command == "list":
        payload = workflow_list()
        _emit(payload, args, "\n".join(f"{item['id']}\t{item['phase']}\t{item['title']}" for item in payload))
        return 0
    if args.workflow_command == "show":
        try:
            payload = workflow_show(args.workflow)
        except KeyError as exc:
            raise DadaiaError(str(exc), code="WORKFLOW_NOT_FOUND", exit_code=1) from exc
        _emit(payload, args, f"{payload['id']}: {payload['title']}")
        return 0
    if args.workflow_command == "backlog-check":
        workspace = _workspace_from_args(args)
        payload = backlog_check(workspace, args.context, args.prompt_file)
        _emit(payload, args, f"wrote {payload['report']}")
        return 0
    if args.workflow_command == "backlog-consume":
        workspace = _workspace_from_args(args)
        payload = backlog_consume(workspace, args.context, args.release, args.backlog)
        _emit(payload, args, f"consumed {payload['backlog']}")
        return 0
    if args.workflow_command == "evidence":
        if args.evidence_command == "bundle":
            workspace = _workspace_from_args(args)
            payload = evidence_bundle(workspace, args.context, args.release, args.prune)
            _emit(payload, args, f"wrote {payload['path']}")
            return 0
        raise DadaiaError("Missing workflow evidence subcommand", code="USAGE", exit_code=2)
    if args.workflow_command == "readiness":
        workspace = _workspace_from_args(args)
        payload = readiness(workspace, args.context, args.release)
        _emit(payload, args, f"readiness score={payload['score']}")
        return 0
    if args.workflow_command == "status":
        workspace = _workspace_from_args(args)
        payload = workflow_status(workspace, args.context, args.release)
        _emit(payload, args, f"{payload['context']} {payload['release']} phase={payload['phase']} canAdvance={payload['canAdvance']}")
        return 0
    if args.workflow_command == "advance":
        workspace = _workspace_from_args(args)
        try:
            payload = workflow_advance(workspace, args.context, args.release, args.to)
        except ValueError as exc:
            raise DadaiaError(str(exc), code="WORKFLOW_GATE", exit_code=1) from exc
        _emit(payload, args, f"advanced {payload['release']} to {payload['phase']}")
        return 0
    if args.workflow_command == "patch":
        if args.patch_command == "apply":
            workspace = _workspace_from_args(args)
            try:
                payload = patch_apply(workspace, args.context, args.release, args.patch_file, args.approve)
            except ValueError as exc:
                raise DadaiaError(str(exc), code="PATCH_ERROR", exit_code=1) from exc
            _emit(payload, args, f"applied patch: {payload['report']}")
            return 0
        raise DadaiaError("Missing workflow patch subcommand", code="USAGE", exit_code=2)
    if args.workflow_command == "rc":
        workspace = _workspace_from_args(args)
        try:
            if args.rc_command == "create":
                commit_range = args.commits or (commit_range_from_endpoints(args.from_sha, args.to_sha) if args.from_sha and args.to_sha else None)
                if not commit_range:
                    raise DadaiaError("workflow rc create requires --commits or --from/--to", code="USAGE", exit_code=2)
                payload = rc_create(workspace, args.context, args.release, args.rc_id, commit_range)
                _emit(payload, args, f"created {payload['path']}")
                return 0
            if args.rc_command == "list":
                payload = rc_list(workspace, args.context, args.release)
                _emit(payload, args, "no release candidates" if not payload else "\n".join(item["path"] for item in payload))
                return 0
            if args.rc_command == "inspect":
                payload = rc_inspect(workspace, args.context, args.release, args.rc_id)
                _emit(payload, args, f"{payload['id']} {payload['commitRange']}")
                return 0
        except ValueError as exc:
            raise DadaiaError(str(exc), code="RC_ERROR", exit_code=1) from exc
        raise DadaiaError("Missing workflow rc subcommand", code="USAGE", exit_code=2)
    if args.workflow_command == "run":
        workspace = _workspace_from_args(args)
        try:
            payload = run_workflow(workspace, WorkflowRunOptions(
                workflow_id=args.workflow,
                context=args.context,
                release=args.release,
                prompt_file=args.prompt_file,
                model=args.model,
                verdict=args.verdict,
                dry_run=args.dry_run,
                pi_mode=args.pi_mode,
            ))
        except KeyError as exc:
            raise DadaiaError(str(exc), code="WORKFLOW_NOT_FOUND", exit_code=1) from exc
        _emit(payload, args, f"workflow {payload['manifest']['runId']} -> {payload['manifest']['artifacts']['manifest']}")
        return 0
    raise DadaiaError("Missing workflow subcommand", code="USAGE", exit_code=2)


def _command_package(args: argparse.Namespace) -> int:
    if args.package_command == "project-settings":
        workspace = _workspace_from_args(args)
        payload = project_settings(workspace.root, args.source)
        _emit(payload, args, f"wrote {payload['path']}")
        return 0
    raise DadaiaError("Missing package subcommand", code="USAGE", exit_code=2)


def run(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.version:
        emit_text(__version__); return 0
    try:
        if args.command == "pi-bridge": return run_bridge([args.operation])
        if args.command == "status": return _command_status(args)
        if args.command == "panel": return _command_panel(args)
        if args.command == "workspace": return _command_workspace(args)
        if args.command == "context": return _command_context(args)
        if args.command == "memory": return _command_memory(args)
        if args.command == "specs": return _command_specs(args)
        if args.command == "handoff": return _command_handoff(args)
        if args.command == "hooks": return _command_hooks(args)
        if args.command == "workflow": return _command_workflow(args)
        if args.command == "package": return _command_package(args)
        parser.print_help(); return 0
    except DadaiaError as exc:
        wants_json = bool(getattr(args, "json", False))
        if wants_json: emit_json(error_payload(exc.message, code=exc.code), stream=sys.stderr)
        else: emit_text(f"error: {exc.message}", stream=sys.stderr)
        return exc.exit_code


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()
