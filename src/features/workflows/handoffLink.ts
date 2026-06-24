import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { validateHandoffRecord } from "../../core/handoff.js";
import type { WorkflowRunManifest } from "./types.js";

const HANDOFF_WORKFLOWS: Readonly<Record<string, string>> = {
  "spec-review": "spec-reviewer",
  "qa-review": "qa-reviewer",
  "security-review": "security-reviewer",
  "code-review": "code-reviewer",
  "release-closure": "closure-steward",
};

function stamp(date: string): string {
  return date.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export function workflowEmitsHandoff(workflowId: string): boolean {
  return HANDOFF_WORKFLOWS[workflowId] !== undefined;
}

export async function emitWorkflowHandoff(workspaceRoot: string, manifest: WorkflowRunManifest, manifestAbsPath: string): Promise<string | undefined> {
  const agent = HANDOFF_WORKFLOWS[manifest.workflowId];
  if (!agent) return undefined;
  const producedAt = new Date().toISOString();
  const dir = join(workspaceRoot, ".dadaia-pi", "handoff", manifest.context);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${stamp(producedAt)}-${agent}-${manifest.runId.slice(0, 8)}.handoff.json`);
  const manifestRel = relative(workspaceRoot, manifestAbsPath).replaceAll("\\", "/");
  const record = {
    schemaVersion: 1,
    context: manifest.context,
    sessionId: "workflow-runner",
    agent,
    producedAt,
    scope: `${manifest.workflowId} workflow ${manifest.runId}`,
    ...(manifest.release ? { release: manifest.release } : {}),
    artifact: { type: "handoff" },
    metrics: {
      workflow_run_id: manifest.runId,
      workflow_id: manifest.workflowId,
      workflow_manifest: manifestRel,
      ...(manifest.releaseCandidate ? { rc_id: manifest.releaseCandidate.id } : {}),
    },
    findings: [],
    verdict: manifest.verdict.value,
    next: { workflow: manifest.workflowId },
  };
  const errors = validateHandoffRecord(record);
  if (errors.length > 0) throw new Error(`generated workflow handoff is invalid: ${errors.join("; ")}`);
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return relative(workspaceRoot, path).replaceAll("\\", "/");
}
