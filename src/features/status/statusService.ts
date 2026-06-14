import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { SpecContextRecord } from "../../core/context.js";
import type { DoctorSummary } from "../../core/issues.js";
import type { SessionBindingRecord } from "../../core/session.js";
import { STATE_DIR_NAME } from "../../core/workspace.js";
import { ContextService } from "../context/service.js";
import { SessionBindingService } from "../context/sessionBinding.js";
import { runWorkspaceDoctor } from "../doctor/workspaceDoctor.js";

export interface TaskMarkerSummary {
  readonly open: number;
  readonly inProgress: number;
  readonly done: number;
}

export interface ReleaseStatusSummary {
  readonly release?: string;
  readonly phase?: string;
  readonly specsDir: string;
  readonly artifacts: {
    readonly spec?: string;
    readonly plan?: string;
    readonly tasks?: string;
    readonly closure?: string;
  };
  readonly tasks?: TaskMarkerSummary;
  readonly warnings: readonly string[];
}

export interface EvidenceStatusSummary {
  readonly handoffs: number;
  readonly reports: number;
}

export interface ContextStatusSummary extends SpecContextRecord {
  readonly selected: boolean;
  readonly release?: ReleaseStatusSummary;
  readonly evidence?: EvidenceStatusSummary;
}

export interface WorkspaceStatusReport {
  readonly root: string;
  readonly doctor: DoctorSummary;
  readonly contexts: readonly ContextStatusSummary[];
  readonly binding?: SessionBindingRecord;
  readonly bindingMissing?: boolean;
  readonly selectedContext?: string;
  readonly warnings: readonly string[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseFrontmatterLike(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^(release|phase|status):\s*(.+?)\s*$/.exec(line);
    if (match?.[1] && match[2]) result[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return result;
}

function artifactStatus(text: string): string | undefined {
  const frontmatter = parseFrontmatterLike(text);
  if (frontmatter.status) return frontmatter.status;
  const match = /\*\*Status:\*\*\s*([^\n]+)/.exec(text);
  return match?.[1]?.trim();
}

function taskSummary(text: string): TaskMarkerSummary {
  return {
    open: (text.match(/^- \[ \]/gm) ?? []).length,
    inProgress: (text.match(/^- \[-\]/gm) ?? []).length,
    done: (text.match(/^- \[x\]/gim) ?? []).length,
  };
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

async function countFiles(path: string, recursive: boolean): Promise<number> {
  if (!(await exists(path))) return 0;
  let count = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isFile()) count += 1;
    else if (recursive && entry.isDirectory()) count += await countFiles(join(path, entry.name), true);
  }
  return count;
}

async function releaseSummary(root: string, context: SpecContextRecord): Promise<ReleaseStatusSummary | undefined> {
  const specsDir = join(root, "repos", context.repoSlug, "specs");
  const fallbackSpecsDir = join(root, "specs");
  const base = context.state === "ALIVE" && (await exists(specsDir)) ? specsDir : context.name === "dadaia-pi-workspace" ? fallbackSpecsDir : specsDir;
  if (!(await exists(base))) return undefined;

  const warnings: string[] = [];
  const activePath = join(base, "releases", "ACTIVE.md");
  const active = await readOptional(activePath);
  if (!active) return { specsDir: base, artifacts: {}, warnings: [`missing ${activePath}`] };
  const activeData = parseFrontmatterLike(active);
  const release = activeData.release === "none" ? undefined : activeData.release;
  const phase = activeData.phase;
  const artifacts: { spec?: string; plan?: string; tasks?: string; closure?: string } = {};
  let tasks: TaskMarkerSummary | undefined;

  if (release) {
    const releaseDir = join(base, "releases", release);
    for (const [key, file] of [
      ["spec", "SPEC.md"],
      ["plan", "PLAN.md"],
      ["tasks", "TASKS.md"],
      ["closure", "CLOSURE.md"],
    ] as const) {
      const text = await readOptional(join(releaseDir, file));
      if (!text) continue;
      artifacts[key] = artifactStatus(text) ?? "unknown";
      if (key === "tasks") tasks = taskSummary(text);
    }
  }

  return { ...(release ? { release } : {}), ...(phase ? { phase } : {}), specsDir: base, artifacts, ...(tasks ? { tasks } : {}), warnings };
}

async function evidenceSummary(root: string, contextName: string): Promise<EvidenceStatusSummary> {
  return {
    handoffs: await countFiles(join(root, STATE_DIR_NAME, "handoff", contextName), false),
    reports: await countFiles(join(root, STATE_DIR_NAME, "reports", contextName), true),
  };
}

export async function buildWorkspaceStatus(
  root: string,
  input: { readonly sessionId?: string; readonly context?: string } = {},
): Promise<WorkspaceStatusReport> {
  const warnings: string[] = [];
  const doctor = await runWorkspaceDoctor(root);
  const contexts = await new ContextService(root).list();
  let binding: SessionBindingRecord | undefined;
  let bindingMissing = false;
  if (input.sessionId) {
    binding = await new SessionBindingService(root).read(input.sessionId);
    bindingMissing = !binding;
  }
  const selectedContext = input.context ?? binding?.context;

  const enriched: ContextStatusSummary[] = [];
  for (const context of contexts) {
    const selected = context.name === selectedContext;
    const release = selected ? await releaseSummary(root, context) : undefined;
    const evidence = selected ? await evidenceSummary(root, context.name) : undefined;
    enriched.push({
      ...context,
      selected,
      ...(release ? { release } : {}),
      ...(evidence ? { evidence } : {}),
    });
  }
  if (selectedContext && !contexts.some((context) => context.name === selectedContext)) warnings.push(`selected context not found: ${selectedContext}`);

  return {
    root,
    doctor: doctor.summary,
    contexts: enriched,
    ...(binding ? { binding } : {}),
    ...(input.sessionId ? { bindingMissing } : {}),
    ...(selectedContext ? { selectedContext } : {}),
    warnings,
  };
}
