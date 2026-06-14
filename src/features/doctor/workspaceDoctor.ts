import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { validateHandoffRecord } from "../../core/handoff.js";
import type { DoctorIssue, DoctorReport } from "../../core/issues.js";
import { summarizeIssues } from "../../core/issues.js";
import { STATE_DIR_NAME } from "../../core/workspace.js";

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

async function validateHandoffs(root: string, issues: DoctorIssue[]): Promise<void> {
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
      } catch (error) {
        issues.push(issue("HANDOFF-1", "error", relative, `Handoff is invalid JSON: ${(error as Error).message}`));
        continue;
      }
      for (const message of validateHandoffRecord(parsed)) {
        issues.push(issue("HANDOFF-1", "error", relative, message));
      }
    }
  }
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

  await validateHandoffs(root, issues);

  return { root, issues, summary: summarizeIssues(issues) };
}
