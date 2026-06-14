import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";

import { validateHandoffRecord } from "../../core/handoff.js";
import { STATE_DIR_NAME } from "../../core/workspace.js";

export interface HandoffValidationResult {
  readonly path: string;
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export interface HandoffListItem {
  readonly path: string;
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly context?: string;
  readonly agent?: string;
  readonly producedAt?: string;
  readonly verdict?: string;
  readonly release?: string;
  readonly commitSha?: string;
}

async function collectFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  try {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) result.push(...(await collectFiles(path)));
      else if (entry.isFile() && entry.name.endsWith(".handoff.json")) result.push(path);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return result.sort();
}

function rel(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/");
}

export async function validateHandoffFile(path: string): Promise<HandoffValidationResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    return { path, ok: false, errors: [`invalid JSON: ${(error as Error).message}`] };
  }
  const errors = validateHandoffRecord(parsed);
  return { path, ok: errors.length === 0, errors };
}

export async function listHandoffs(root: string, context?: string): Promise<readonly HandoffListItem[]> {
  const base = context ? join(root, STATE_DIR_NAME, "handoff", context) : join(root, STATE_DIR_NAME, "handoff");
  const files = await collectFiles(base);
  const items: HandoffListItem[] = [];
  for (const file of files) {
    const validation = await validateHandoffFile(file);
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    } catch {
      // validation already captured the parse error.
    }
    const metrics = typeof parsed.metrics === "object" && parsed.metrics !== null ? (parsed.metrics as Record<string, unknown>) : {};
    items.push({
      path: rel(root, file),
      ok: validation.ok,
      errors: validation.errors,
      ...(typeof parsed.context === "string" ? { context: parsed.context } : {}),
      ...(typeof parsed.agent === "string" ? { agent: parsed.agent } : {}),
      ...(typeof parsed.producedAt === "string" ? { producedAt: parsed.producedAt } : {}),
      ...(typeof parsed.verdict === "string" ? { verdict: parsed.verdict } : {}),
      ...(typeof parsed.release === "string" ? { release: parsed.release } : {}),
      ...(typeof metrics.commit_sha === "string" ? { commitSha: metrics.commit_sha } : {}),
    });
  }
  return items;
}

export async function emitSecurityApproval(
  root: string,
  input: { readonly context: string; readonly commitSha: string; readonly sessionId?: string; readonly scope?: string; readonly release?: string },
): Promise<string> {
  if (!/^[a-f0-9]{40}$/i.test(input.commitSha)) throw new Error("approve-security requires a 40-character commit sha");
  if (!/^[a-z][a-z0-9-]*$/.test(input.context)) throw new Error("approve-security requires a valid --context <name>");
  const producedAt = new Date().toISOString();
  const stamp = producedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const dir = join(root, STATE_DIR_NAME, "handoff", input.context);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${stamp}-security-reviewer-${input.commitSha.slice(0, 8)}.handoff.json`);
  const record = {
    schemaVersion: 1,
    context: input.context,
    sessionId: input.sessionId ?? "unknown",
    agent: "security-reviewer",
    producedAt,
    scope: input.scope ?? `security approval for commit ${input.commitSha}`,
    ...(input.release ? { release: input.release } : {}),
    artifact: { type: "handoff" },
    metrics: { commit_sha: input.commitSha },
    findings: [],
    verdict: "APPROVED",
    next: { agent: "operator", action: "push" },
  };
  const errors = validateHandoffRecord(record);
  if (errors.length > 0) throw new Error(`generated handoff is invalid: ${errors.join("; ")}`);
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return path;
}

export function formatHandoffItem(item: HandoffListItem): string {
  if (!item.ok) return `${item.path}\tINVALID\t${item.errors.join("; ")}`;
  return [item.path, item.context ?? "", item.agent ?? "", item.verdict ?? "", item.release ?? "", item.commitSha ?? "", item.producedAt ?? ""].join("\t");
}

export function handoffBasename(path: string): string {
  return basename(path);
}
