import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { ContextService } from "../context/service.js";

const execFileAsync = promisify(execFile);

export interface ReleaseCandidateRecord {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly context: string;
  readonly release: string;
  readonly commitRange: string;
  readonly createdAt: string;
  readonly reviews: {
    readonly qa: readonly string[];
    readonly security: readonly string[];
    readonly code: readonly string[];
  };
}

export interface ReleaseCandidateInspection extends ReleaseCandidateRecord {
  readonly path: string;
  readonly commits: readonly string[];
  readonly changedFiles: readonly string[];
  readonly reviewStatus: {
    readonly qa: boolean;
    readonly security: boolean;
    readonly code: boolean;
  };
  readonly stale: boolean;
  readonly headSha?: string;
}

function safeId(id: string): string {
  const value = id.replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!value) throw new Error("release candidate id cannot be empty");
  return value;
}

async function rcDir(workspaceRoot: string, context: string, release: string): Promise<string> {
  return join(workspaceRoot, ".dadaia-pi", "release-candidates", context, release);
}

export function commitRangeFromEndpoints(base: string, head: string): string {
  return `${base}..${head}`;
}

export async function createReleaseCandidate(workspaceRoot: string, contextName: string, release: string, rcId: string, commitRange: string): Promise<ReleaseCandidateRecord & { path: string }> {
  const context = await new ContextService(workspaceRoot).show(contextName);
  const dir = await rcDir(workspaceRoot, context.name, release);
  await mkdir(dir, { recursive: true });
  const record: ReleaseCandidateRecord = {
    schemaVersion: 1,
    id: safeId(rcId),
    context: context.name,
    release,
    commitRange,
    createdAt: new Date().toISOString(),
    reviews: { qa: [], security: [], code: [] },
  };
  const path = join(dir, `${record.id}.json`);
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { ...record, path: relative(workspaceRoot, path) };
}

export async function appendReleaseCandidateReview(
  workspaceRoot: string,
  contextName: string,
  release: string,
  rcId: string,
  workflowId: string,
  manifestPath: string,
): Promise<void> {
  const context = await new ContextService(workspaceRoot).show(contextName);
  const dir = await rcDir(workspaceRoot, context.name, release);
  const path = join(dir, `${safeId(rcId)}.json`);
  const record = JSON.parse(await readFile(path, "utf8")) as ReleaseCandidateRecord;
  const bucket = workflowId === "qa-review" ? "qa" : workflowId === "security-review" ? "security" : workflowId === "code-review" ? "code" : undefined;
  if (!bucket) return;
  const current = record.reviews[bucket];
  const updated: ReleaseCandidateRecord = {
    ...record,
    reviews: { ...record.reviews, [bucket]: current.includes(manifestPath) ? current : [...current, manifestPath] },
  };
  await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
}

export function validateReleaseCandidateRecord(value: unknown): string[] {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) return ["release candidate must be an object"];
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  for (const field of ["id", "context", "release", "commitRange", "createdAt"] as const) if (typeof record[field] !== "string" || record[field].length === 0) errors.push(`${field} must be a non-empty string`);
  const reviews = record.reviews as Record<string, unknown> | undefined;
  if (typeof reviews !== "object" || reviews === null) errors.push("reviews must be an object");
  else for (const field of ["qa", "security", "code"] as const) if (!Array.isArray(reviews[field])) errors.push(`reviews.${field} must be an array`);
  return errors;
}

export async function commitInRange(workspaceRoot: string, commitRange: string, sha: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", workspaceRoot, "rev-list", commitRange], { maxBuffer: 10 * 1024 * 1024 });
    return stdout.split(/\r?\n/).some((line) => line.trim() === sha);
  } catch {
    return false;
  }
}

export async function approvedSecurityReleaseCandidatesForSha(
  workspaceRoot: string,
  contextName: string | undefined,
  sha: string,
  manifests: readonly { context?: string; release?: string; workflowId?: string; sdk?: { accepted?: boolean }; verdict?: { value?: string; blockingFindings?: number }; releaseCandidate?: { id?: string } }[],
): Promise<string[]> {
  const approved = manifests.filter(
    (manifest) =>
      manifest.workflowId === "security-review" &&
      manifest.sdk?.accepted === true &&
      manifest.verdict?.value === "APPROVED" &&
      (manifest.verdict.blockingFindings ?? 0) === 0 &&
      manifest.releaseCandidate?.id &&
      (!contextName || manifest.context === contextName),
  );
  const matches: string[] = [];
  for (const manifest of approved) {
    if (!manifest.context || !manifest.release || !manifest.releaseCandidate?.id) continue;
    const rcPath = join(workspaceRoot, ".dadaia-pi", "release-candidates", manifest.context, manifest.release, `${safeId(manifest.releaseCandidate.id)}.json`);
    try {
      const rc = JSON.parse(await readFile(rcPath, "utf8")) as ReleaseCandidateRecord;
      let gitRoot = workspaceRoot;
      try {
        const context = await new ContextService(workspaceRoot).show(manifest.context);
        gitRoot = join(workspaceRoot, "repos", context.repoSlug);
      } catch {
        // Tests and legacy workspaces may not have context registry data; fall back to workspace root.
      }
      if (await commitInRange(gitRoot, rc.commitRange, sha)) matches.push(`${manifest.context}/${manifest.release}/${rc.id}`);
    } catch {
      // Doctor owns malformed or missing RC diagnostics.
    }
  }
  return matches;
}

async function gitLines(workspaceRoot: string, args: readonly string[]): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", workspaceRoot, ...args], { maxBuffer: 10 * 1024 * 1024 });
    return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function inspectReleaseCandidate(workspaceRoot: string, contextName: string, release: string, rcId: string): Promise<ReleaseCandidateInspection> {
  const context = await new ContextService(workspaceRoot).show(contextName);
  const path = join(await rcDir(workspaceRoot, context.name, release), `${safeId(rcId)}.json`);
  const repoRoot = join(workspaceRoot, "repos", context.repoSlug);
  const record = JSON.parse(await readFile(path, "utf8")) as ReleaseCandidateRecord;
  const commits = await gitLines(repoRoot, ["rev-list", "--reverse", record.commitRange]);
  const changedFiles = await gitLines(repoRoot, ["diff", "--name-only", record.commitRange]);
  const headSha = (await gitLines(repoRoot, ["rev-parse", "HEAD"]))[0];
  const stale = headSha ? !(await commitInRange(repoRoot, record.commitRange, headSha)) : false;
  return {
    ...record,
    path: relative(workspaceRoot, path),
    commits,
    changedFiles,
    reviewStatus: { qa: record.reviews.qa.length > 0, security: record.reviews.security.length > 0, code: record.reviews.code.length > 0 },
    stale,
    ...(headSha ? { headSha } : {}),
  };
}

export async function listReleaseCandidates(workspaceRoot: string, contextName: string, release: string): Promise<(ReleaseCandidateRecord & { path: string })[]> {
  const context = await new ContextService(workspaceRoot).show(contextName);
  const dir = await rcDir(workspaceRoot, context.name, release);
  const records: (ReleaseCandidateRecord & { path: string })[] = [];
  try {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const path = join(dir, entry.name);
      records.push({ ...(JSON.parse(await readFile(path, "utf8")) as ReleaseCandidateRecord), path: relative(workspaceRoot, path) });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return records.sort((a, b) => a.id.localeCompare(b.id));
}
