import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { validateHandoffRecord } from "../../core/handoff.js";
import type { DoctorIssue, DoctorReport } from "../../core/issues.js";
import { summarizeIssues } from "../../core/issues.js";
import { STATE_DIR_NAME } from "../../core/workspace.js";

const execFileAsync = promisify(execFile);

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function issue(code: string, severity: "error" | "warning", path: string, message: string): DoctorIssue {
  return { code, severity, path, message };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateWorkflowManifest(value: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return ["workflow manifest must be an object"];
  for (const field of ["schemaVersion", "runId", "workflowId", "context", "repoSlug", "createdAt"] as const) if (value[field] === undefined) errors.push(`${field} is required`);
  const sdk = value.sdk;
  if (!isObject(sdk) || sdk.accepted !== true) errors.push("sdk.accepted must be true");
  const verdict = value.verdict;
  if (verdict !== undefined) {
    if (!isObject(verdict) || !["APPROVED", "NEEDS_CHANGES", "REJECTED"].includes(String(verdict.value))) errors.push("verdict.value is invalid");
    else {
      if (verdict.blockingFindings !== undefined && (typeof verdict.blockingFindings !== "number" || verdict.blockingFindings < 0)) errors.push("verdict.blockingFindings must be a non-negative number");
      if (verdict.findings !== undefined && !Array.isArray(verdict.findings)) errors.push("verdict.findings must be an array");
      if (verdict.risk !== undefined && !["low", "medium", "high", "unknown"].includes(String(verdict.risk))) errors.push("verdict.risk is invalid");
      if (verdict.reviewedPaths !== undefined && !Array.isArray(verdict.reviewedPaths)) errors.push("verdict.reviewedPaths must be an array");
      if (verdict.acceptanceCoverage !== undefined && !Array.isArray(verdict.acceptanceCoverage)) errors.push("verdict.acceptanceCoverage must be an array");
    }
  }
  if (value.linkedHandoffs !== undefined && !Array.isArray(value.linkedHandoffs)) errors.push("linkedHandoffs must be an array");
  return errors;
}

function validateRcRecord(value: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return ["release candidate must be an object"];
  for (const field of ["schemaVersion", "id", "context", "release", "commitRange", "createdAt"] as const) if (value[field] === undefined) errors.push(`${field} is required`);
  const reviews = value.reviews;
  if (!isObject(reviews)) errors.push("reviews must be an object");
  else for (const field of ["qa", "security", "code"] as const) if (!Array.isArray(reviews[field])) errors.push(`reviews.${field} must be an array`);
  return errors;
}

async function validateHandoffs(root: string, issues: DoctorIssue[], handoffs: Map<string, Record<string, unknown>>): Promise<void> {
  const handoffRoot = join(root, STATE_DIR_NAME, "handoff");
  if (!(await exists(handoffRoot))) return;
  for (const contextEntry of await readdir(handoffRoot, { withFileTypes: true })) {
    if (!contextEntry.isDirectory()) continue;
    const contextDir = join(handoffRoot, contextEntry.name);
    for (const entry of await readdir(contextDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const relative = `${STATE_DIR_NAME}/handoff/${contextEntry.name}/${entry.name}`;
      if (!entry.name.endsWith(".handoff.json")) {
        issues.push(issue("HANDOFF-1", "warning", relative, "Handoff files should use .handoff.json extension"));
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(await readFile(join(contextDir, entry.name), "utf8"));
        if (isObject(parsed)) handoffs.set(relative, parsed);
      } catch (error) {
        issues.push(issue("HANDOFF-1", "error", relative, `Handoff is invalid JSON: ${(error as Error).message}`));
        continue;
      }
      for (const message of validateHandoffRecord(parsed)) issues.push(issue("HANDOFF-1", "error", relative, message));
    }
  }
}

async function collectWorkflows(root: string, issues: DoctorIssue[]): Promise<Map<string, Record<string, unknown>>> {
  const workflows = new Map<string, Record<string, unknown>>();
  const workflowsRoot = join(root, STATE_DIR_NAME, "workflows");
  if (!(await exists(workflowsRoot))) return workflows;
  for (const contextEntry of await readdir(workflowsRoot, { withFileTypes: true })) {
    if (!contextEntry.isDirectory()) continue;
    for (const entry of await readdir(join(workflowsRoot, contextEntry.name), { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const relative = `${STATE_DIR_NAME}/workflows/${contextEntry.name}/${entry.name}`;
      try {
        const parsed = JSON.parse(await readFile(join(workflowsRoot, contextEntry.name, entry.name), "utf8"));
        if (isObject(parsed)) workflows.set(relative, parsed);
        for (const message of validateWorkflowManifest(parsed)) issues.push(issue("WORKFLOW-1", "error", relative, message));
      } catch (error) {
        issues.push(issue("WORKFLOW-1", "error", relative, `Workflow manifest is invalid JSON: ${(error as Error).message}`));
      }
    }
  }
  return workflows;
}

async function collectRcs(root: string, issues: DoctorIssue[]): Promise<Map<string, Record<string, unknown>>> {
  const records = new Map<string, Record<string, unknown>>();
  const rcRoot = join(root, STATE_DIR_NAME, "release-candidates");
  if (!(await exists(rcRoot))) return records;
  async function scan(dir: string, relPrefix: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const rel = `${relPrefix}/${entry.name}`;
      if (entry.isDirectory()) await scan(path, rel);
      else if (entry.isFile() && entry.name.endsWith(".json")) {
        try {
          const parsed = JSON.parse(await readFile(path, "utf8"));
          if (isObject(parsed)) records.set(rel, parsed);
          for (const message of validateRcRecord(parsed)) issues.push(issue("RC-1", "error", rel, message));
        } catch (error) {
          issues.push(issue("RC-1", "error", rel, `Release candidate record is invalid JSON: ${(error as Error).message}`));
        }
      }
    }
  }
  await scan(rcRoot, `${STATE_DIR_NAME}/release-candidates`);
  return records;
}

function approvedWorkflowExists(workflows: Iterable<Record<string, unknown>>, context: string, release: string, workflowId: string): boolean {
  for (const item of workflows) {
    const verdict = isObject(item.verdict) ? item.verdict : {};
    const sdk = isObject(item.sdk) ? item.sdk : {};
    if (item.context === context && item.release === release && item.workflowId === workflowId && sdk.accepted === true && verdict.value === "APPROVED" && (verdict.blockingFindings ?? 0) === 0) return true;
  }
  return false;
}

function workflowHasReviewedPaths(workflows: Map<string, Record<string, unknown>>, path: string): boolean {
  const manifest = workflows.get(path);
  const verdict = manifest && isObject(manifest.verdict) ? manifest.verdict : undefined;
  return Array.isArray(verdict?.reviewedPaths) && verdict.reviewedPaths.length > 0;
}

function workflowHasAcceptanceCoverage(workflows: Map<string, Record<string, unknown>>, path: string): boolean {
  const manifest = workflows.get(path);
  const verdict = manifest && isObject(manifest.verdict) ? manifest.verdict : undefined;
  return Array.isArray(verdict?.acceptanceCoverage) && verdict.acceptanceCoverage.length > 0;
}

function reviewedPaths(workflows: Map<string, Record<string, unknown>>, path: string): string[] {
  const manifest = workflows.get(path);
  const verdict = manifest && isObject(manifest.verdict) ? manifest.verdict : undefined;
  return Array.isArray(verdict?.reviewedPaths) ? verdict.reviewedPaths.filter((item): item is string => typeof item === "string") : [];
}

async function gitChangedFiles(repoRoot: string, range: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoRoot, "diff", "--name-only", range], { maxBuffer: 10 * 1024 * 1024 });
    return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function isSourcePath(path: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|json|css|html)$/.test(path) || path.startsWith("src/") || path.startsWith("extensions/");
}

function isSensitivePath(path: string): boolean {
  return /(^|\/)\.env/.test(path) || path.startsWith("extensions/") || path.startsWith("src/features/hooks/") || path.includes("security") || path === "package.json" || path.includes("package-lock");
}

function missingCoverage(required: readonly string[], reviewed: readonly string[]): string[] {
  if (reviewed.includes("<rc-diff>")) return [];
  const reviewedSet = new Set(reviewed);
  return required.filter((path) => !reviewedSet.has(path));
}

async function validateActivePhase(root: string, workflows: Map<string, Record<string, unknown>>, rcs: Map<string, Record<string, unknown>>, issues: DoctorIssue[]): Promise<void> {
  const reposDir = join(root, "repos");
  if (!(await exists(reposDir))) return;
  const phaseRequirements: Record<string, string[]> = {
    IMPLEMENTATION: ["spec-review"],
    QA_REVIEW: ["implementation-task"],
    SECURITY_REVIEW: ["qa-review"],
    CODE_REVIEW: ["security-review"],
    CLOSURE: ["qa-review", "security-review", "code-review"],
    ARCHIVED: ["release-closure"],
  };
  for (const repo of await readdir(reposDir, { withFileTypes: true })) {
    if (!repo.isDirectory()) continue;
    const activePath = join(reposDir, repo.name, "specs", "releases", "ACTIVE.md");
    if (!(await exists(activePath))) continue;
    const text = await readFile(activePath, "utf8");
    const release = /^release:\s*(.+)$/m.exec(text)?.[1]?.trim();
    const phase = /^phase:\s*(.+)$/m.exec(text)?.[1]?.trim();
    if (!release || !phase) continue;
    for (const required of phaseRequirements[phase] ?? []) {
      if (!approvedWorkflowExists(workflows.values(), repo.name, release, required)) issues.push(issue("WORKFLOW-STATE-1", "error", `repos/${repo.name}/specs/releases/ACTIVE.md`, `phase ${phase} requires APPROVED ${required} workflow evidence for ${release}`));
    }
    for (const [rcPath, rc] of rcs) {
      if (rc.context !== repo.name || rc.release !== release) continue;
      const reviews = isObject(rc.reviews) ? rc.reviews : {};
      const changedFiles = typeof rc.commitRange === "string" ? await gitChangedFiles(join(reposDir, repo.name), rc.commitRange) : [];
      for (const bucket of ["qa", "security", "code"] as const) {
        const paths = Array.isArray(reviews[bucket]) ? reviews[bucket].filter((item): item is string => typeof item === "string") : [];
        if (paths.length === 0 && ["SECURITY_REVIEW", "CODE_REVIEW", "CLOSURE", "ARCHIVED"].includes(phase)) issues.push(issue("RC-COMPLETE-1", "error", rcPath, `active release RC is missing ${bucket} review evidence`));
        for (const reviewPath of paths) {
          if (!workflowHasReviewedPaths(workflows, reviewPath)) issues.push(issue("RC-COMPLETE-1", "error", reviewPath, `${bucket} review must record verdict.reviewedPaths`));
          if (bucket === "qa" && !workflowHasAcceptanceCoverage(workflows, reviewPath)) issues.push(issue("RC-COMPLETE-1", "error", reviewPath, "QA review must record verdict.acceptanceCoverage"));
          const reviewed = reviewedPaths(workflows, reviewPath);
          if (bucket === "code") {
            const missing = missingCoverage(changedFiles.filter(isSourcePath), reviewed);
            if (missing.length > 0) issues.push(issue("RC-COVERAGE-1", "error", reviewPath, `code review missing changed source paths: ${missing.join(", ")}`));
          }
          if (bucket === "security") {
            const missing = missingCoverage(changedFiles.filter(isSensitivePath), reviewed);
            if (missing.length > 0) issues.push(issue("RC-COVERAGE-1", "error", reviewPath, `security review missing sensitive changed paths: ${missing.join(", ")}`));
          }
        }
      }
    }
    if (["CLOSURE", "ARCHIVED"].includes(phase)) {
      const closure = await readFile(join(reposDir, repo.name, "specs", "releases", release, "CLOSURE.md"), "utf8").catch(() => "");
      if (!/Memory updates performed|current-truth memory/i.test(closure)) issues.push(issue("CLOSURE-COMPLETE-1", "error", `repos/${repo.name}/specs/releases/${release}/CLOSURE.md`, "closure must record current-truth memory update evidence"));
    }
  }
}

function validateCrossReferences(root: string, workflows: Map<string, Record<string, unknown>>, handoffs: Map<string, Record<string, unknown>>, rcs: Map<string, Record<string, unknown>>, issues: DoctorIssue[]): void {
  const referencedHandoffs = new Set<string>();
  const referencedWorkflows = new Set<string>();
  for (const [path, manifest] of workflows) {
    const linked = Array.isArray(manifest.linkedHandoffs) ? manifest.linkedHandoffs : [];
    for (const handoffPath of linked) {
      if (typeof handoffPath !== "string") continue;
      referencedHandoffs.add(handoffPath);
      const handoff = handoffs.get(handoffPath);
      if (!handoff) {
        issues.push(issue("WORKFLOW-XREF-1", "error", path, `linked handoff does not exist: ${handoffPath}`));
        continue;
      }
      const metrics = isObject(handoff.metrics) ? handoff.metrics : {};
      if (metrics.workflow_run_id !== manifest.runId) issues.push(issue("WORKFLOW-XREF-1", "error", handoffPath, `handoff does not point back to workflow_run_id ${String(manifest.runId)}`));
    }
    const rc = isObject(manifest.releaseCandidate) ? manifest.releaseCandidate : undefined;
    if (typeof rc?.id === "string" && typeof manifest.context === "string" && typeof manifest.release === "string") {
      const rcPath = `${STATE_DIR_NAME}/release-candidates/${manifest.context}/${manifest.release}/${rc.id}.json`;
      if (!rcs.has(rcPath)) issues.push(issue("RC-XREF-1", "error", path, `manifest references missing release candidate: ${rcPath}`));
    }
  }

  for (const [path, rc] of rcs) {
    const reviews = isObject(rc.reviews) ? rc.reviews : {};
    for (const bucket of ["qa", "security", "code"] as const) {
      const paths = Array.isArray(reviews[bucket]) ? reviews[bucket] : [];
      for (const reviewPath of paths) {
        if (typeof reviewPath !== "string") continue;
        referencedWorkflows.add(reviewPath);
        if (!workflows.has(reviewPath)) issues.push(issue("RC-XREF-1", "error", path, `RC ${bucket} review manifest does not exist: ${reviewPath}`));
      }
    }
  }

  for (const [path, handoff] of handoffs) {
    const metrics = isObject(handoff.metrics) ? handoff.metrics : {};
    if (typeof metrics.workflow_run_id === "string" && !referencedHandoffs.has(path)) issues.push(issue("HANDOFF-XREF-1", "warning", path, "workflow handoff is not linked by any workflow manifest"));
    if (typeof metrics.workflow_manifest === "string" && !workflows.has(metrics.workflow_manifest)) issues.push(issue("HANDOFF-XREF-1", "error", path, `handoff references missing workflow manifest: ${metrics.workflow_manifest}`));
  }
  void root;
  void referencedWorkflows;
}

export async function runWorkspaceDoctor(root: string): Promise<DoctorReport> {
  const issues: DoctorIssue[] = [];
  const stateRoot = join(root, STATE_DIR_NAME);
  const statesDir = join(stateRoot, "states");
  const contextsPath = join(statesDir, "spec_contexts.json");

  if (!(await exists(stateRoot))) {
    issues.push(issue("WS-STATE-1", "warning", STATE_DIR_NAME, "Workspace runtime state directory does not exist yet"));
    return { root, issues, summary: summarizeIssues(issues) };
  }

  if (!(await exists(contextsPath))) {
    issues.push(issue("CTX-1", "warning", `${STATE_DIR_NAME}/states/spec_contexts.json`, "Context registry does not exist yet"));
  } else {
    try {
      JSON.parse(await readFile(contextsPath, "utf8"));
    } catch (error) {
      issues.push(issue("CTX-1", "error", `${STATE_DIR_NAME}/states/spec_contexts.json`, `Context registry is invalid JSON: ${(error as Error).message}`));
    }
  }

  const lockDir = join(statesDir, "ctx_locks");
  if (await exists(lockDir)) {
    for (const entry of await readdir(lockDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const relative = `${STATE_DIR_NAME}/states/ctx_locks/${entry.name}`;
      try {
        JSON.parse(await readFile(join(lockDir, entry.name), "utf8"));
      } catch (error) {
        issues.push(issue("LOCK-NEW", "error", relative, `Lease record is invalid JSON: ${(error as Error).message}`));
      }
    }
  }

  const handoffs = new Map<string, Record<string, unknown>>();
  await validateHandoffs(root, issues, handoffs);
  const workflows = await collectWorkflows(root, issues);
  const rcs = await collectRcs(root, issues);
  validateCrossReferences(root, workflows, handoffs, rcs, issues);
  await validateActivePhase(root, workflows, rcs, issues);

  return { root, issues, summary: summarizeIssues(issues) };
}
