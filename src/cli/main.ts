#!/usr/bin/env node
import type { SpecContextRecord } from "../core/context.js";
import type { DoctorReport } from "../core/issues.js";
import { VERSION } from "../core/version.js";
import { ContextService } from "../features/context/service.js";
import { SessionBindingService } from "../features/context/sessionBinding.js";
import { runWorkspaceDoctor } from "../features/doctor/workspaceDoctor.js";
import { installAllHooks, preCommitCheck, prePushCheck, uninstallAllHooks } from "../features/hooks/index.js";
import { buildWorkspaceStatus, type WorkspaceStatusReport } from "../features/status/index.js";
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
    "  dadaia-pi hooks install [--repo-root <path>]",
    "  dadaia-pi hooks uninstall [--repo-root <path>]",
    "  dadaia-pi hooks pre-commit-check [--repo-root <path>]",
    "  dadaia-pi hooks pre-push-check",
    "  dadaia-pi package project-settings --source <package-source>",
    "",
    "Commands:",
    "  doctor          Check workspace/runtime state",
    "  status          Summarize workspace, context, binding, release, tasks, and evidence",
    "  specs scaffold  Create a canonical specs tree if files are missing",
    "  specs doctor    Check committed SDD specs structure",
    "  context         Manage Spec Context Project registry and ALIVE/DEAD lifecycle",
    "  hooks           Install and run git chokepoint checks",
    "  package         Generate consumer Pi project settings",
  ].join("\n");
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
