import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface HookCheckResult {
  readonly ok: boolean;
  readonly messages: readonly string[];
}

function pushedShas(stdin: string): string[] {
  const shas: string[] = [];
  for (const line of stdin.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    const localSha = parts[1];
    if (!localSha || /^0+$/.test(localSha)) continue;
    shas.push(localSha);
  }
  return [...new Set(shas)];
}

async function collectHandoffFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  try {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) result.push(...(await collectHandoffFiles(path)));
      else if (entry.isFile() && entry.name.endsWith(".json")) result.push(path);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return result;
}

async function approvedSecurityShas(workspaceRoot: string): Promise<Set<string>> {
  const shas = new Set<string>();
  for (const file of await collectHandoffFiles(join(workspaceRoot, ".dadaia-pi", "handoff"))) {
    try {
      const value = JSON.parse(await readFile(file, "utf8")) as {
        agent?: string;
        verdict?: string;
        metrics?: { commit_sha?: string };
      };
      if (value.agent === "security-reviewer" && value.verdict === "APPROVED" && value.metrics?.commit_sha) {
        shas.add(value.metrics.commit_sha);
      }
    } catch {
      // Ignore malformed handoffs here; reports validation owns schema detail.
    }
  }
  return shas;
}

export async function prePushCheck(workspaceRoot: string, stdin: string): Promise<HookCheckResult> {
  const shas = pushedShas(stdin);
  if (shas.length === 0) return { ok: true, messages: ["pre-push check ok: no commit shas require security verdict"] };
  const approved = await approvedSecurityShas(workspaceRoot);
  const missing = shas.filter((sha) => !approved.has(sha));
  if (missing.length > 0) {
    return {
      ok: false,
      messages: missing.map((sha) => `pre-push blocked: missing security-reviewer APPROVED handoff for commit ${sha}`),
    };
  }
  return { ok: true, messages: [`pre-push check ok: ${shas.length} commit(s) have security approval`] };
}
