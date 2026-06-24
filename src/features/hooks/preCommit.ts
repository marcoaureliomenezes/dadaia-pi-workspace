import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { ContextService } from "../context/service.js";
import { classifyPath } from "../gate/classifier.js";
import { LeaseStore } from "../gate/lease.js";
import { gitOutput } from "../../infrastructure/git/gitClient.js";
import { matchesWriteSet, readReservedTaskWriteSet } from "./taskWriteSet.js";

export interface HookCheckResult {
  readonly ok: boolean;
  readonly messages: readonly string[];
}

async function activeRelease(repoRoot: string): Promise<string | undefined> {
  try {
    const text = await readFile(join(repoRoot, "specs", "releases", "ACTIVE.md"), "utf8");
    const match = text.match(/^release:\s*(.+)$/m);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

async function hasApprovedImplementationWorkflow(workspaceRoot: string, context: string, release: string): Promise<boolean> {
  const dir = join(workspaceRoot, ".dadaia-pi", "workflows", context);
  try {
    const files = (await readdir(dir)).filter((file) => file.endsWith(".json"));
    for (const file of files) {
      const raw = await readFile(join(dir, file), "utf8");
      const manifest = JSON.parse(raw) as { workflowId?: string; release?: string; sdk?: { accepted?: boolean }; verdict?: { value?: string; blockingFindings?: number }; orchestration?: unknown };
      if (
        manifest.release === release &&
        manifest.workflowId === "release-implementation" &&
        manifest.sdk?.accepted === true &&
        manifest.verdict?.value === "APPROVED" &&
        (manifest.verdict.blockingFindings ?? 0) === 0 &&
        manifest.orchestration
      ) return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function hasApprovedTasks(repoRoot: string, release: string): Promise<boolean> {
  try {
    const text = await readFile(join(repoRoot, "specs", "releases", release, "TASKS.md"), "utf8");
    return text.includes("**Status:** Aprovado");
  } catch {
    return false;
  }
}

export async function preCommitCheck(workspaceRoot: string, repoRoot: string, sessionId?: string): Promise<HookCheckResult> {
  const messages: string[] = [];
  let staged: string[] = [];
  try {
    const output = await gitOutput(["diff", "--cached", "--name-only"], repoRoot);
    staged = output.length > 0 ? output.split(/\r?\n/).filter(Boolean) : [];
  } catch (error) {
    return { ok: false, messages: [`pre-commit check failed to read staged files: ${(error as Error).message}`] };
  }

  const contexts = await new ContextService(workspaceRoot).list();
  const context = contexts.find((item) => join(workspaceRoot, "repos", item.repoSlug) === repoRoot || repoRoot.endsWith(`/repos/${item.repoSlug}`));
  if (!context) return { ok: true, messages: ["pre-commit check skipped: repo is not a registered context"] };

  const mutating = staged.filter((path) => classifyPath(workspaceRoot, join(repoRoot, path)).pathClass === "MUTATING");
  if (mutating.length === 0) return { ok: true, messages: ["pre-commit check ok: no mutating staged paths"] };

  if (!sessionId) {
    messages.push("pre-commit blocked: mutating paths require DADAIA_PI_SESSION_ID to match the context lease holder");
  } else {
    const lease = await new LeaseStore(workspaceRoot).read(context.name);
    if (!lease) messages.push(`pre-commit blocked: no mutating lease for context ${context.name}`);
    else if (lease.sessionId !== sessionId) messages.push(`pre-commit blocked: context ${context.name} lease held by ${lease.sessionId}, not ${sessionId}`);
  }

  const release = await activeRelease(repoRoot);
  if (!release) messages.push("pre-commit blocked: specs/releases/ACTIVE.md has no release");
  else if (!(await hasApprovedTasks(repoRoot, release))) {
    messages.push(`pre-commit blocked: active release ${release} needs approved TASKS.md`);
  } else {
    const writeSet = await readReservedTaskWriteSet(repoRoot, release);
    if (!writeSet) messages.push(`pre-commit blocked: active release ${release} needs exactly one [-] reserved task with a Write set`);
    else if (writeSet.patterns.length === 0) messages.push(`pre-commit blocked: reserved task is missing backtick paths in its Write set`);
    else {
      const outside = mutating.filter((path) => !matchesWriteSet(path, writeSet.patterns));
      if (outside.length > 0) messages.push(`pre-commit blocked: staged mutating paths outside reserved task write set: ${outside.join(", ")}; write set: ${writeSet.patterns.join(", ")}`);
    }
    if (!(await hasApprovedImplementationWorkflow(workspaceRoot, context.name, release))) {
      messages.push(`pre-commit blocked: active release ${release} requires APPROVED release-implementation workflow evidence before mutating commit`);
    }
  }

  if (messages.length > 0) {
    messages.push(`mutating staged paths: ${mutating.join(", ")}`);
    return { ok: false, messages };
  }
  return { ok: true, messages: [`pre-commit check ok: ${mutating.length} mutating path(s) covered by lease, task, and release-implementation workflow evidence`] };
}
