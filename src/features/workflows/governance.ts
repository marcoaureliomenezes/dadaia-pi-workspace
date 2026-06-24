import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { ContextService } from "../context/service.js";
import type { WorkflowRunManifest } from "./types.js";

export type ReleasePhase = "BACKLOG" | "RESEARCH" | "RELEASE_DEFINITION" | "SPEC_REVIEW" | "IMPLEMENTATION" | "QA_REVIEW" | "SECURITY_REVIEW" | "CODE_REVIEW" | "CLOSURE" | "ARCHIVED";

export interface WorkflowGateStatus {
  readonly name: string;
  readonly ok: boolean;
  readonly message: string;
}

export interface WorkflowGovernanceStatus {
  readonly context: string;
  readonly repoSlug: string;
  readonly release: string;
  readonly phase: ReleasePhase | string;
  readonly allowedNext: readonly ReleasePhase[];
  readonly gates: readonly WorkflowGateStatus[];
  readonly canAdvance: boolean;
}

const PHASES: readonly ReleasePhase[] = ["BACKLOG", "RESEARCH", "RELEASE_DEFINITION", "SPEC_REVIEW", "IMPLEMENTATION", "QA_REVIEW", "SECURITY_REVIEW", "CODE_REVIEW", "CLOSURE", "ARCHIVED"];

const GATES_BY_TARGET: Readonly<Record<ReleasePhase, readonly string[]>> = {
  BACKLOG: [],
  RESEARCH: [],
  RELEASE_DEFINITION: [],
  SPEC_REVIEW: [],
  IMPLEMENTATION: ["spec-review"],
  QA_REVIEW: ["implementation-task"],
  SECURITY_REVIEW: ["qa-review"],
  CODE_REVIEW: ["security-review"],
  CLOSURE: ["qa-review", "security-review", "code-review", "tasks-complete"],
  ARCHIVED: ["release-closure"],
};

function parseActive(text: string): { release?: string; phase?: string } {
  const result: { release?: string; phase?: string } = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^(release|phase):\s*(.+?)\s*$/.exec(line);
    const value = match?.[2];
    if (match?.[1] === "release" && value) result.release = value;
    if (match?.[1] === "phase" && value) result.phase = value;
  }
  return result;
}

function isReleasePhase(value: string): value is ReleasePhase {
  return (PHASES as readonly string[]).includes(value);
}

function allowedNext(phase: string): readonly ReleasePhase[] {
  if (phase === "BACKLOG") return ["RESEARCH", "RELEASE_DEFINITION"];
  if (phase === "RESEARCH") return ["RELEASE_DEFINITION"];
  if (phase === "RELEASE_DEFINITION") return ["SPEC_REVIEW"];
  if (phase === "SPEC_REVIEW") return ["IMPLEMENTATION"];
  if (phase === "IMPLEMENTATION") return ["QA_REVIEW"];
  if (phase === "QA_REVIEW") return ["SECURITY_REVIEW"];
  if (phase === "SECURITY_REVIEW") return ["CODE_REVIEW"];
  if (phase === "CODE_REVIEW") return ["CLOSURE"];
  if (phase === "CLOSURE") return ["ARCHIVED"];
  return [];
}

async function readActive(repoRoot: string): Promise<{ release?: string; phase?: string; path: string }> {
  const path = join(repoRoot, "specs", "releases", "ACTIVE.md");
  return { ...parseActive(await readFile(path, "utf8")), path };
}

async function readManifests(workspaceRoot: string, context: string): Promise<WorkflowRunManifest[]> {
  const dir = join(workspaceRoot, ".dadaia-pi", "workflows", context);
  const result: WorkflowRunManifest[] = [];
  try {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        result.push(JSON.parse(await readFile(join(dir, entry.name), "utf8")) as WorkflowRunManifest);
      } catch {
        // Malformed workflow evidence is ignored by gate collection; doctor can own schema diagnostics later.
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return result;
}

function hasApprovedManifest(manifests: readonly WorkflowRunManifest[], context: string, release: string, workflowId: string): boolean {
  return manifests.some(
    (item) => item.context === context && item.release === release && item.workflowId === workflowId && item.sdk.accepted === true && item.verdict?.value === "APPROVED" && (item.verdict.blockingFindings ?? 0) === 0,
  );
}

async function tasksComplete(repoRoot: string, release: string): Promise<boolean> {
  const text = await readFile(join(repoRoot, "specs", "releases", release, "TASKS.md"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (/^- \[( |-)\] /.test(line) && !/deferred|deferido/i.test(line)) return false;
  }
  return true;
}

async function evaluateGates(workspaceRoot: string, repoRoot: string, context: string, release: string, target: ReleasePhase): Promise<WorkflowGateStatus[]> {
  const manifests = await readManifests(workspaceRoot, context);
  const gates: WorkflowGateStatus[] = [];
  for (const gate of GATES_BY_TARGET[target]) {
    if (gate === "tasks-complete") {
      const ok = await tasksComplete(repoRoot, release);
      gates.push({ name: gate, ok, message: ok ? "all tasks complete or explicitly deferred" : "open or in-progress tasks remain" });
      continue;
    }
    const ok = hasApprovedManifest(manifests, context, release, gate);
    gates.push({ name: gate, ok, message: ok ? `found APPROVED ${gate} workflow manifest` : `missing APPROVED ${gate} workflow manifest` });
  }
  return gates;
}

export async function workflowGovernanceStatus(workspaceRoot: string, contextName: string, release: string): Promise<WorkflowGovernanceStatus> {
  const context = await new ContextService(workspaceRoot).show(contextName);
  const repoRoot = join(workspaceRoot, "repos", context.repoSlug);
  const active = await readActive(repoRoot);
  const phase = active.release === release && active.phase ? active.phase : "BACKLOG";
  const next = allowedNext(phase);
  const target = next[0];
  const gates = target ? await evaluateGates(workspaceRoot, repoRoot, context.name, release, target) : [];
  return {
    context: context.name,
    repoSlug: context.repoSlug,
    release,
    phase,
    allowedNext: next,
    gates,
    canAdvance: next.length > 0 && gates.every((gate) => gate.ok),
  };
}

export async function advanceWorkflowPhase(workspaceRoot: string, contextName: string, release: string, target: string): Promise<WorkflowGovernanceStatus> {
  if (!isReleasePhase(target)) throw new Error(`Unknown release phase: ${target}`);
  const context = await new ContextService(workspaceRoot).show(contextName);
  const repoRoot = join(workspaceRoot, "repos", context.repoSlug);
  const active = await readActive(repoRoot);
  const current = active.release === release && active.phase ? active.phase : "BACKLOG";
  const next = allowedNext(current);
  if (!next.includes(target)) throw new Error(`Cannot advance ${release} from ${current} to ${target}; allowed: ${next.join(", ") || "none"}`);
  const gates = await evaluateGates(workspaceRoot, repoRoot, context.name, release, target);
  const missing = gates.filter((gate) => !gate.ok);
  if (missing.length > 0) throw new Error(`Cannot advance ${release} to ${target}; ${missing.map((gate) => gate.message).join("; ")}`);

  const activeText = `---\nrelease: ${release}\nphase: ${target}\n---\n`;
  await mkdir(join(repoRoot, "specs", "releases"), { recursive: true });
  await writeFile(active.path, activeText, "utf8");
  return workflowGovernanceStatus(workspaceRoot, contextName, release);
}
