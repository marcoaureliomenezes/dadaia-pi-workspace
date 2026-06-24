import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

import { ContextService } from "../context/service.js";

export interface BacklogConflict {
  readonly path: string;
  readonly reason: string;
}

export interface BacklogCheckResult {
  readonly context: string;
  readonly demandFile: string;
  readonly conflicts: readonly BacklogConflict[];
  readonly schemaIssues: readonly BacklogConflict[];
  readonly advisoryClassification: string;
  readonly grillMeRecord: string;
}

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9][a-z0-9_-]{3,}/g) ?? []);
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const item of a) if (b.has(item)) count += 1;
  return count;
}

async function files(dir: string): Promise<string[]> {
  const result: string[] = [];
  try {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) result.push(...(await files(path)));
      else if (entry.isFile() && entry.name.endsWith(".md")) result.push(path);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return result;
}

export async function checkBacklogHygiene(workspaceRoot: string, contextName: string, promptFile: string): Promise<BacklogCheckResult> {
  const context = await new ContextService(workspaceRoot).show(contextName);
  const repoRoot = join(workspaceRoot, "repos", context.repoSlug);
  const demand = await readFile(resolve(promptFile), "utf8");
  const demandWords = words(demand);
  const conflicts: BacklogConflict[] = [];
  const schemaIssues: BacklogConflict[] = [];
  for (const file of await files(join(repoRoot, "specs", "backlog"))) {
    const text = await readFile(file, "utf8");
    const rel = relative(repoRoot, file);
    const score = overlapScore(demandWords, words(text));
    if (score >= 6 || /conflict|duplicate|overlap/i.test(text)) conflicts.push({ path: rel, reason: `textual overlap score ${score}` });
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
    for (const field of ["status", "owner", "supersedes", "conflicts_with", "consumed_by_release"] as const) {
      if (!new RegExp(`^${field}:`, "m").test(frontmatter)) schemaIssues.push({ path: rel, reason: `missing backlog frontmatter field ${field}` });
    }
  }
  const stamp = new Date().toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
  const dir = join(workspaceRoot, ".dadaia-pi", "reports", context.name, "backlog");
  await mkdir(dir, { recursive: true });
  const grillMeRecord = join(dir, `${stamp}-${basename(promptFile).replace(/[^a-zA-Z0-9._-]/g, "-")}-grill-me.md`);
  const questions = [
    "# Backlog grill-me record",
    "",
    `Demand file: ${promptFile}`,
    "",
    "## Required questions",
    "- What user/product outcome must change?",
    "- Which existing backlog item is superseded, conflicted, or duplicated?",
    "- What is explicitly out of scope?",
    "- What evidence would prove this backlog item is ready for release definition?",
    "",
    "## Detected conflicts",
    ...(conflicts.length === 0 ? ["- none"] : conflicts.map((item) => `- ${item.path}: ${item.reason}`)),
    "",
    "## Structured backlog frontmatter issues",
    ...(schemaIssues.length === 0 ? ["- none"] : schemaIssues.map((item) => `- ${item.path}: ${item.reason}`)),
    "",
    "## Advisory model-assisted classification",
    "- not-invoked-deterministic-placeholder",
    "",
  ].join("\n");
  await writeFile(grillMeRecord, questions, "utf8");
  return { context: context.name, demandFile: promptFile, conflicts, schemaIssues, advisoryClassification: "not-invoked-deterministic-placeholder", grillMeRecord: relative(workspaceRoot, grillMeRecord) };
}

export async function consumeBacklogItem(workspaceRoot: string, contextName: string, release: string, backlogPath: string): Promise<{ path: string }> {
  const context = await new ContextService(workspaceRoot).show(contextName);
  const repoRoot = join(workspaceRoot, "repos", context.repoSlug);
  const fullPath = resolve(repoRoot, backlogPath);
  const text = await readFile(fullPath, "utf8");
  const marker = `\n\n---\nconsumed_by_release: ${release}\nconsumed_at: ${new Date().toISOString()}\nstatus: consumed\n`;
  if (text.includes("consumed_by_release:")) return { path: relative(repoRoot, fullPath) };
  await writeFile(fullPath, `${text.trimEnd()}${marker}`, "utf8");
  return { path: relative(repoRoot, fullPath) };
}
