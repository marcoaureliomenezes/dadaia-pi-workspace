#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { SpecContextRecord } from "../core/context.js";
import type { DoctorReport } from "../core/issues.js";
import { VERSION } from "../core/version.js";
import { ContextService } from "../features/context/service.js";
import { SessionBindingService } from "../features/context/sessionBinding.js";
import { runWorkspaceDoctor } from "../features/doctor/workspaceDoctor.js";
import { emitSecurityApproval, formatHandoffItem, listHandoffs, validateHandoffFile } from "../features/handoff/index.js";
import { installAllHooks, preCommitCheck, prePushCheck, uninstallAllHooks } from "../features/hooks/index.js";
import { listMemoryCatalog, showMemoryAtom } from "../features/memory/index.js";
import { runPanel } from "../features/panel/index.js";
import { buildWorkspaceStatus, type WorkspaceStatusReport } from "../features/status/index.js";
import { doctorWorkspaceInstall, initWorkspace, installWorkspace } from "../features/workspace/index.js";
import {
  advanceWorkflowPhase,
  applyControlledPatch,
  bundleReleaseEvidence,
  checkBacklogHygiene,
  consumeBacklogItem,
  commitRangeFromEndpoints,
  createReleaseCandidate,
  getWorkflowDefinition,
  inspectReleaseCandidate,
  listReleaseCandidates,
  listWorkflowDefinitions,
  runWorkflow,
  workflowGovernanceStatus,
  workflowReadiness,
} from "../features/workflows/index.js";
import { writeProjectSettings } from "../pi/projectSettings.js";
import { runSpecsDoctor } from "../features/specs/doctor.js";
import { scaffoldSpecs } from "../features/specs/scaffold.js";

function usage(): string {
  return [
    "dadaia-pi - Pi-native SDD workspace manager",
    "",
    "Usage:",
    "  dadaia-pi --help",
    "  dadaia-pi --version",
    "  dadaia-pi doctor [--json]",
    "  dadaia-pi status [--session-id <id>] [--context <name>] [--json]",
    "  dadaia-pi panel [--port <port>] [--bind 127.0.0.1] [--no-open]",
    "  dadaia-pi workspace init [--package-root <path>] [--skip-assets] [--json]",
    "  dadaia-pi workspace install [--package-root <path>] [--json]",
    "  dadaia-pi workspace doctor [--package-root <path>] [--json]",
    "  dadaia-pi memory list [--context <name>] [--json]",
    "  dadaia-pi memory show <slug> [--context <name>] [--json]",
    "  dadaia-pi specs scaffold [--specs-dir <path>]",
    "  dadaia-pi specs doctor [--specs-dir <path>] [--json]",
    "  dadaia-pi context create <name> --repo <slug> [--url <url>] [--branch <branch>] [--json]",
    "  dadaia-pi context list [--json]",
    "  dadaia-pi context show <name> [--json]",
    "  dadaia-pi context update <name> [--url <url>] [--branch <branch>] [--json]",
    "  dadaia-pi context alive <name> [--json]",
    "  dadaia-pi context dead <name> [--json]",
    "  dadaia-pi context bind <name> --session-id <id> [--mode read|implementation|review] [--release <id>] [--json]",
    "  dadaia-pi context status --session-id <id> [--json]",
    "  dadaia-pi context release --session-id <id>",
    "  dadaia-pi handoff validate <file> [--json]",
    "  dadaia-pi handoff list [--context <name>] [--json]",
    "  dadaia-pi handoff approve-security --context <name> --commit <sha> [--session-id <id>] [--scope <text>] [--release <id>] [--json]",
    "  dadaia-pi workflow list [--json]",
    "  dadaia-pi workflow show <workflow> [--json]",
    "  dadaia-pi workflow status --context <name> --release <id> [--json]",
    "  dadaia-pi workflow advance --context <name> --release <id> --to <phase> [--json]",
    "  dadaia-pi workflow run <workflow> --context <name> [--release <id>] [--prompt-file <path>] [--model <pattern>] [--verdict APPROVED|NEEDS_CHANGES|REJECTED] [--rc-id <id>] [--approve] [--dry-run] [--json]",
    "  dadaia-pi workflow backlog-check --context <name> --prompt-file <path> [--json]",
    "  dadaia-pi workflow backlog-consume --context <name> --release <id> --backlog <path> [--json]",
    "  dadaia-pi workflow rc create --context <name> --release <id> --rc-id <id> (--commits <range> | --from <base> --to <head>) [--json]",
    "  dadaia-pi workflow rc list --context <name> --release <id> [--json]",
    "  dadaia-pi workflow rc inspect --context <name> --release <id> --rc-id <id> [--json]",
    "  dadaia-pi workflow patch apply --context <name> --release <id> --patch-file <path> --approve [--json]",
    "  dadaia-pi workflow evidence bundle --context <name> --release <id> [--prune] [--json]",
    "  dadaia-pi workflow readiness --context <name> --release <id> [--json]",
    "  dadaia-pi hooks install [--repo-root <path>]",
    "  dadaia-pi hooks uninstall [--repo-root <path>]",
    "  dadaia-pi hooks pre-commit-check [--repo-root <path>]",
    "  dadaia-pi hooks pre-push-check",
    "  dadaia-pi package project-settings --source <package-source>",
    "",
    "Commands:",
    "  doctor          Check workspace/runtime state",
    "  status          Summarize workspace, context, binding, release, tasks, and evidence",
    "  workspace       Scaffold, install, and doctor instantiated workspace resources",
    "  panel           Start the local browser panel at http://127.0.0.1:4999/",
    "  specs scaffold  Create a canonical specs tree if files are missing",
    "  specs doctor    Check committed SDD specs structure",
    "  context         Manage Spec Context Project registry and ALIVE/DEAD lifecycle",
    "  handoff        Validate, list, and emit lifecycle handoffs",
    "  workflow       Run deterministic lifecycle workflows with bounded Pi SDK steps",
    "  memory         Navigate product memory catalog and atoms",
    "  hooks           Install and run git chokepoint checks",
    "  package         Generate consumer Pi project settings",
  ].join("\n");
}

function defaultPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
}

function packageRoot(argv: readonly string[]): string {
  return resolve(optionValue(argv, "--package-root") ?? defaultPackageRoot());
}

function optionValue(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  return argv[index + 1];
}

function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(name);
}

function printReport(report: DoctorReport, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  if (report.issues.length === 0) {
    process.stdout.write(`ok: ${report.root}\n`);
    return;
  }

  for (const item of report.issues) {
    process.stdout.write(`[${item.severity.toUpperCase()}] ${item.code} ${item.path} — ${item.message}\n`);
  }
  process.stdout.write(`summary: ${report.summary.errors} error(s), ${report.summary.warnings} warning(s)\n`);
}

function printContext(record: SpecContextRecord, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${record.name}\t${record.state}\t${record.repoSlug}\t${record.branch}\t${record.repoUrl ?? ""}\n`);
}

function printContextList(records: readonly SpecContextRecord[], json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
    return;
  }
  for (const record of records) printContext(record, false);
}

function printStatus(report: WorkspaceStatusReport, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(`workspace: ${report.root}\n`);
  process.stdout.write(`doctor: ${report.doctor.errors} error(s), ${report.doctor.warnings} warning(s)\n`);
  if (report.binding) {
    process.stdout.write(`binding: ${report.binding.sessionId} -> ${report.binding.context} (${report.binding.mode}${report.binding.release ? `, ${report.binding.release}` : ""})\n`);
  } else if (report.bindingMissing) {
    process.stdout.write("binding: missing\n");
  }
  process.stdout.write("contexts:\n");
  if (report.contexts.length === 0) process.stdout.write("  (none)\n");
  for (const context of report.contexts) {
    process.stdout.write(`  ${context.selected ? "*" : "-"} ${context.name} ${context.state} repo=${context.repoSlug} branch=${context.branch}${context.repoUrl ? ` url=${context.repoUrl}` : ""}\n`);
    if (context.release) {
      process.stdout.write(`    release: ${context.release.release ?? "none"} phase=${context.release.phase ?? "unknown"}\n`);
      const tasks = context.release.tasks;
      if (tasks) process.stdout.write(`    tasks: open=${tasks.open} in_progress=${tasks.inProgress} done=${tasks.done}\n`);
    }
    if (context.evidence) process.stdout.write(`    evidence: handoffs=${context.evidence.handoffs} reports=${context.evidence.reports}\n`);
  }
  for (const warning of report.warnings) process.stdout.write(`warning: ${warning}\n`);
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  return Buffer.concat(chunks).toString("utf8");
}

async function runWorkspace(argv: readonly string[], cwd: string): Promise<number> {
  const [, subcommand] = argv;
  const json = hasFlag(argv, "--json");
  const root = packageRoot(argv);
  if (subcommand === "init") {
    const result = await initWorkspace(cwd, root, hasFlag(argv, "--skip-assets"));
    if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else process.stdout.write(`${result.actions.join("\n")}\n`);
    return 0;
  }
  if (subcommand === "install") {
    const result = await installWorkspace(cwd, root);
    if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else process.stdout.write(`${result.actions.join("\n")}\n`);
    return 0;
  }
  if (subcommand === "doctor") {
    const result = await doctorWorkspaceInstall(cwd, root);
    if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else process.stdout.write(`${result.reports.join("\n")}\n`);
    return result.ok ? 0 : 1;
  }
  throw new Error(`Unknown workspace command: ${subcommand ?? ""}`);
}

async function runMemory(argv: readonly string[], cwd: string): Promise<number> {
  const [, subcommand, slug] = argv;
  const json = hasFlag(argv, "--json");
  const context = optionValue(argv, "--context");
  if (subcommand === "list") {
    const entries = await listMemoryCatalog(cwd, context);
    if (json) process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
    else process.stdout.write(entries.map((entry) => `${entry.slug}\t${entry.title ?? ""}\t${entry.tldr ?? ""}`).join("\n") + (entries.length > 0 ? "\n" : ""));
    return 0;
  }
  if (subcommand === "show") {
    if (!slug) throw new Error("memory show requires <slug>");
    const atom = await showMemoryAtom(cwd, slug, context);
    if (json) process.stdout.write(`${JSON.stringify(atom, null, 2)}\n`);
    else process.stdout.write(atom.content);
    return 0;
  }
  throw new Error(`Unknown memory command: ${subcommand ?? ""}`);
}

async function runPackage(argv: readonly string[], cwd: string): Promise<number> {
  const [, subcommand] = argv;
  if (subcommand === "project-settings") {
    const source = optionValue(argv, "--source");
    if (!source) throw new Error("package project-settings requires --source <package-source>");
    const path = await writeProjectSettings(cwd, source);
    process.stdout.write(`wrote ${path}\n`);
    return 0;
  }
  throw new Error(`Unknown package command: ${subcommand ?? ""}`);
}

async function runHandoff(argv: readonly string[], cwd: string): Promise<number> {
  const [, subcommand, file] = argv;
  const json = hasFlag(argv, "--json");
  if (subcommand === "validate") {
    if (!file) throw new Error("handoff validate requires <file>");
    const result = await validateHandoffFile(file);
    if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else process.stdout.write(result.ok ? `ok: ${result.path}\n` : `[ERROR] ${result.path} — ${result.errors.join("; ")}\n`);
    return result.ok ? 0 : 1;
  }
  if (subcommand === "list") {
    const items = await listHandoffs(cwd, optionValue(argv, "--context"));
    if (json) process.stdout.write(`${JSON.stringify(items, null, 2)}\n`);
    else process.stdout.write(items.length === 0 ? "no handoffs\n" : `${items.map(formatHandoffItem).join("\n")}\n`);
    return items.some((item) => !item.ok) ? 1 : 0;
  }
  if (subcommand === "approve-security") {
    const context = optionValue(argv, "--context");
    const commitSha = optionValue(argv, "--commit");
    if (!context) throw new Error("handoff approve-security requires --context <name>");
    if (!commitSha) throw new Error("handoff approve-security requires --commit <sha>");
    const input: { context: string; commitSha: string; sessionId?: string; scope?: string; release?: string } = { context, commitSha };
    const sessionId = optionValue(argv, "--session-id");
    const scope = optionValue(argv, "--scope");
    const release = optionValue(argv, "--release");
    if (sessionId) input.sessionId = sessionId;
    if (scope) input.scope = scope;
    if (release) input.release = release;
    const path = await emitSecurityApproval(cwd, input);
    if (json) process.stdout.write(`${JSON.stringify({ path }, null, 2)}\n`);
    else process.stdout.write(`wrote ${path}\n`);
    return 0;
  }
  throw new Error(`Unknown handoff command: ${subcommand ?? ""}`);
}

async function runWorkflowCommand(argv: readonly string[], cwd: string): Promise<number> {
  const [, subcommand, workflowId] = argv;
  const json = hasFlag(argv, "--json");

  if (subcommand === "list") {
    const definitions = listWorkflowDefinitions();
    if (json) process.stdout.write(`${JSON.stringify(definitions, null, 2)}\n`);
    else process.stdout.write(`${definitions.map((item) => `${item.id}\t${item.phase}\t${item.title}`).join("\n")}\n`);
    return 0;
  }

  if (subcommand === "show") {
    if (!workflowId) throw new Error("workflow show requires <workflow>");
    const definition = getWorkflowDefinition(workflowId);
    if (json) process.stdout.write(`${JSON.stringify(definition, null, 2)}\n`);
    else process.stdout.write(`${definition.id}\n${definition.title}\n${definition.purpose}\n`);
    return 0;
  }

  if (subcommand === "status") {
    const context = optionValue(argv, "--context");
    const release = optionValue(argv, "--release");
    if (!context) throw new Error("workflow status requires --context <name>");
    if (!release) throw new Error("workflow status requires --release <id>");
    const status = await workflowGovernanceStatus(cwd, context, release);
    if (json) process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    else process.stdout.write(`release: ${status.release}\nphase: ${status.phase}\nallowed next: ${status.allowedNext.join(", ") || "none"}\nmissing gates: ${status.gates.filter((gate) => !gate.ok).map((gate) => gate.name).join(", ") || "none"}\n`);
    return status.canAdvance || status.allowedNext.length === 0 ? 0 : 1;
  }

  if (subcommand === "advance") {
    const context = optionValue(argv, "--context");
    const release = optionValue(argv, "--release");
    const target = optionValue(argv, "--to");
    if (!context) throw new Error("workflow advance requires --context <name>");
    if (!release) throw new Error("workflow advance requires --release <id>");
    if (!target) throw new Error("workflow advance requires --to <phase>");
    const status = await advanceWorkflowPhase(cwd, context, release, target);
    if (json) process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    else process.stdout.write(`advanced ${release} to ${status.phase}\n`);
    return 0;
  }

  if (subcommand === "backlog-check") {
    const context = optionValue(argv, "--context");
    const promptFile = optionValue(argv, "--prompt-file");
    if (!context) throw new Error("workflow backlog-check requires --context <name>");
    if (!promptFile) throw new Error("workflow backlog-check requires --prompt-file <path>");
    const result = await checkBacklogHygiene(cwd, context, promptFile);
    if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else process.stdout.write(`conflicts: ${result.conflicts.length}\ngrill-me: ${result.grillMeRecord}\n`);
    return result.conflicts.length > 0 ? 1 : 0;
  }

  if (subcommand === "backlog-consume") {
    const context = optionValue(argv, "--context");
    const release = optionValue(argv, "--release");
    const backlog = optionValue(argv, "--backlog");
    if (!context) throw new Error("workflow backlog-consume requires --context <name>");
    if (!release) throw new Error("workflow backlog-consume requires --release <id>");
    if (!backlog) throw new Error("workflow backlog-consume requires --backlog <path>");
    const result = await consumeBacklogItem(cwd, context, release, backlog);
    if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else process.stdout.write(`consumed ${result.path}\n`);
    return 0;
  }

  if (subcommand === "rc") {
    const action = workflowId;
    const context = optionValue(argv, "--context");
    const release = optionValue(argv, "--release");
    if (!context) throw new Error("workflow rc requires --context <name>");
    if (!release) throw new Error("workflow rc requires --release <id>");
    if (action === "create") {
      const rcId = optionValue(argv, "--rc-id");
      const commits = optionValue(argv, "--commits");
      const from = optionValue(argv, "--from");
      const to = optionValue(argv, "--to");
      if (!rcId) throw new Error("workflow rc create requires --rc-id <id>");
      const range = commits ?? (from && to ? commitRangeFromEndpoints(from, to) : undefined);
      if (!range) throw new Error("workflow rc create requires --commits <range> or --from <base> --to <head>");
      const result = await createReleaseCandidate(cwd, context, release, rcId, range);
      if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      else process.stdout.write(`created ${result.path}\n`);
      return 0;
    }
    if (action === "list") {
      const result = await listReleaseCandidates(cwd, context, release);
      if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      else process.stdout.write(result.map((item) => `${item.id}\t${item.commitRange}`).join("\n") + (result.length > 0 ? "\n" : ""));
      return 0;
    }
    if (action === "inspect") {
      const rcId = optionValue(argv, "--rc-id");
      if (!rcId) throw new Error("workflow rc inspect requires --rc-id <id>");
      const result = await inspectReleaseCandidate(cwd, context, release, rcId);
      if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      else process.stdout.write([`rc: ${result.id}`, `range: ${result.commitRange}`, `stale: ${result.stale ? "yes" : "no"}`, `reviews: qa=${result.reviewStatus.qa ? "yes" : "no"} security=${result.reviewStatus.security ? "yes" : "no"} code=${result.reviewStatus.code ? "yes" : "no"}`, `commits: ${result.commits.length}`, `changed files: ${result.changedFiles.length}`].join("\n") + "\n");
      return 0;
    }
    throw new Error(`Unknown workflow rc command: ${action ?? ""}`);
  }

  if (subcommand === "patch") {
    const action = workflowId;
    if (action !== "apply") throw new Error(`Unknown workflow patch command: ${action ?? ""}`);
    const context = optionValue(argv, "--context");
    const release = optionValue(argv, "--release");
    const patchFile = optionValue(argv, "--patch-file");
    if (!context) throw new Error("workflow patch apply requires --context <name>");
    if (!release) throw new Error("workflow patch apply requires --release <id>");
    if (!patchFile) throw new Error("workflow patch apply requires --patch-file <path>");
    const result = await applyControlledPatch(cwd, { context, release, patchFile, approved: hasFlag(argv, "--approve") });
    if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else process.stdout.write(`applied ${result.applied.length} patch(es); audit: ${result.audit}\n`);
    return 0;
  }

  if (subcommand === "evidence") {
    const action = workflowId;
    if (action !== "bundle") throw new Error(`Unknown workflow evidence command: ${action ?? ""}`);
    const context = optionValue(argv, "--context");
    const release = optionValue(argv, "--release");
    if (!context) throw new Error("workflow evidence bundle requires --context <name>");
    if (!release) throw new Error("workflow evidence bundle requires --release <id>");
    const result = await bundleReleaseEvidence(cwd, { context, release, prune: hasFlag(argv, "--prune") });
    if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else process.stdout.write(`bundle: ${result.path}${result.pruned.length ? `\npruned: ${result.pruned.length}` : ""}\n`);
    return 0;
  }

  if (subcommand === "readiness") {
    const context = optionValue(argv, "--context");
    const release = optionValue(argv, "--release");
    if (!context) throw new Error("workflow readiness requires --context <name>");
    if (!release) throw new Error("workflow readiness requires --release <id>");
    const result = await workflowReadiness(cwd, context, release);
    if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else process.stdout.write(`release: ${result.release}\nphase: ${result.phase}\nscore: ${result.score}\nmissing gates: ${result.missingGates.join(", ") || "none"}\npre-push ready: ${result.prePushReady ? "yes" : "no"}\nclosure ready: ${result.closureReady ? "yes" : "no"}\n`);
    return result.doctorIssues.some((issue) => (issue as { severity?: string }).severity === "error") ? 1 : 0;
  }

  if (subcommand === "run") {
    if (!workflowId) throw new Error("workflow run requires <workflow>");
    const context = optionValue(argv, "--context");
    if (!context) throw new Error("workflow run requires --context <name>");
    const input: {
      workflowId: string;
      context: string;
      release?: string;
      promptFile?: string;
      model?: string;
      approveProjectResources?: boolean;
      dryRun?: boolean;
      sessionId?: string;
      verdict?: "APPROVED" | "NEEDS_CHANGES" | "REJECTED";
      rcId?: string;
    } = {
      workflowId,
      context,
      approveProjectResources: hasFlag(argv, "--approve"),
      dryRun: hasFlag(argv, "--dry-run"),
    };
    const release = optionValue(argv, "--release");
    const promptFile = optionValue(argv, "--prompt-file");
    const model = optionValue(argv, "--model");
    const sessionId = optionValue(argv, "--session-id");
    const verdict = optionValue(argv, "--verdict");
    const rcId = optionValue(argv, "--rc-id");
    if (release) input.release = release;
    if (promptFile) input.promptFile = promptFile;
    if (model) input.model = model;
    if (sessionId) input.sessionId = sessionId;
    if (verdict === "APPROVED" || verdict === "NEEDS_CHANGES" || verdict === "REJECTED") input.verdict = verdict;
    else if (verdict) throw new Error(`Invalid workflow verdict: ${verdict}`);
    if (rcId) input.rcId = rcId;
    const result = await runWorkflow(cwd, input);
    if (json) process.stdout.write(`${JSON.stringify(result.manifest, null, 2)}\n`);
    else process.stdout.write(`workflow ${result.manifest.workflowId} wrote ${result.manifest.artifacts.manifest} and ${result.manifest.artifacts.report}\n`);
    return 0;
  }

  throw new Error(`Unknown workflow command: ${subcommand ?? ""}`);
}

async function runHooks(argv: readonly string[], cwd: string): Promise<number> {
  const [, subcommand] = argv;
  const repoRoot = optionValue(argv, "--repo-root") ?? cwd;
  if (subcommand === "install") {
    const paths = await installAllHooks(repoRoot);
    process.stdout.write(`installed hooks:\n${paths.join("\n")}\n`);
    return 0;
  }
  if (subcommand === "uninstall") {
    await uninstallAllHooks(repoRoot);
    process.stdout.write("uninstalled hooks\n");
    return 0;
  }
  if (subcommand === "pre-commit-check") {
    const result = await preCommitCheck(cwd, repoRoot, process.env.DADAIA_PI_SESSION_ID);
    process.stdout.write(`${result.messages.join("\n")}\n`);
    return result.ok ? 0 : 1;
  }
  if (subcommand === "pre-push-check") {
    const result = await prePushCheck(cwd, await readStdin());
    process.stdout.write(`${result.messages.join("\n")}\n`);
    return result.ok ? 0 : 1;
  }
  throw new Error(`Unknown hooks command: ${subcommand ?? ""}`);
}

async function runContext(argv: readonly string[], cwd: string): Promise<number> {
  const [, subcommand, name] = argv;
  const service = new ContextService(cwd);
  const json = hasFlag(argv, "--json");

  if (subcommand === "list") {
    printContextList(await service.list(), json);
    return 0;
  }

  if (subcommand === "status") {
    const sessionId = optionValue(argv, "--session-id");
    if (!sessionId) throw new Error("context status requires --session-id <id>");
    const record = await new SessionBindingService(cwd).status(sessionId);
    process.stdout.write(`${JSON.stringify(record, null, json ? 2 : 0)}\n`);
    return 0;
  }

  if (subcommand === "release") {
    const sessionId = optionValue(argv, "--session-id");
    if (!sessionId) throw new Error("context release requires --session-id <id>");
    await new SessionBindingService(cwd).release(sessionId);
    process.stdout.write(`released session: ${sessionId}\n`);
    return 0;
  }

  if (!name) throw new Error(`context ${subcommand ?? ""} requires <name>`);

  if (subcommand === "bind") {
    const sessionId = optionValue(argv, "--session-id");
    if (!sessionId) throw new Error("context bind requires --session-id <id>");
    const input: { sessionId: string; context: string; mode?: string; release?: string; pid: number } = {
      sessionId,
      context: name,
      pid: process.pid,
    };
    const mode = optionValue(argv, "--mode");
    const release = optionValue(argv, "--release");
    if (mode) input.mode = mode;
    if (release) input.release = release;
    const record = await new SessionBindingService(cwd).bind(input);
    process.stdout.write(`${JSON.stringify(record, null, json ? 2 : 0)}\n`);
    return 0;
  }

  if (subcommand === "create") {
    const repoSlug = optionValue(argv, "--repo");
    if (!repoSlug) throw new Error("context create requires --repo <slug>");
    const input: { name: string; repoSlug: string; repoUrl?: string; branch?: string } = { name, repoSlug };
    const repoUrl = optionValue(argv, "--url");
    const branch = optionValue(argv, "--branch");
    if (repoUrl) input.repoUrl = repoUrl;
    if (branch) input.branch = branch;
    printContext(await service.create(input), json);
    return 0;
  }

  if (subcommand === "show") {
    printContext(await service.show(name), json);
    return 0;
  }

  if (subcommand === "update") {
    const input: { repoUrl?: string; branch?: string } = {};
    const repoUrl = optionValue(argv, "--url");
    const branch = optionValue(argv, "--branch");
    if (repoUrl) input.repoUrl = repoUrl;
    if (branch) input.branch = branch;
    printContext(await service.update(name, input), json);
    return 0;
  }

  if (subcommand === "alive") {
    printContext(await service.alive(name), json);
    return 0;
  }

  if (subcommand === "dead") {
    printContext(await service.dead(name), json);
    return 0;
  }

  throw new Error(`Unknown context command: ${subcommand ?? ""}`);
}

export async function run(argv: readonly string[], cwd = process.cwd()): Promise<number> {
  const [command, subcommand] = argv;

  if (command === undefined || command === "--help" || command === "-h") {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  if (command === "--version" || command === "-v") {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  if (command === "doctor") {
    const report = await runWorkspaceDoctor(cwd);
    printReport(report, hasFlag(argv, "--json"));
    return report.summary.errors > 0 ? 1 : 0;
  }

  if (command === "status") {
    const input: { sessionId?: string; context?: string } = {};
    const sessionId = optionValue(argv, "--session-id");
    const context = optionValue(argv, "--context");
    if (sessionId) input.sessionId = sessionId;
    if (context) input.context = context;
    const report = await buildWorkspaceStatus(cwd, input);
    printStatus(report, hasFlag(argv, "--json"));
    return 0;
  }

  if (command === "workspace") {
    return runWorkspace(argv, cwd);
  }

  if (command === "panel") {
    const bind = optionValue(argv, "--bind") ?? "127.0.0.1";
    const portText = optionValue(argv, "--port") ?? "4999";
    const port = Number.parseInt(portText, 10);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`Invalid panel port: ${portText}`);
    await runPanel(cwd, { host: bind, port, open: !hasFlag(argv, "--no-open") });
    return 0;
  }

  if (command === "memory") {
    return runMemory(argv, cwd);
  }

  if (command === "specs" && subcommand === "scaffold") {
    const specsDir = optionValue(argv, "--specs-dir") ?? `${cwd}/specs`;
    await scaffoldSpecs(specsDir);
    process.stdout.write(`scaffolded specs: ${specsDir}\n`);
    return 0;
  }

  if (command === "specs" && subcommand === "doctor") {
    const specsDir = optionValue(argv, "--specs-dir") ?? `${cwd}/specs`;
    const report = await runSpecsDoctor(specsDir);
    printReport(report, hasFlag(argv, "--json"));
    return report.summary.errors > 0 ? 1 : 0;
  }

  if (command === "context") {
    return runContext(argv, cwd);
  }

  if (command === "handoff") {
    return runHandoff(argv, cwd);
  }

  if (command === "workflow") {
    return runWorkflowCommand(argv, cwd);
  }

  if (command === "hooks") {
    return runHooks(argv, cwd);
  }

  if (command === "package") {
    return runPackage(argv, cwd);
  }

  process.stderr.write(`Unknown command: ${argv.join(" ")}\n\n${usage()}\n`);
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`${(error as Error).message}\n`);
      process.exitCode = 1;
    },
  );
}
