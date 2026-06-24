import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { ContextService } from "../context/service.js";
import { listHandoffs } from "../handoff/index.js";
import { listReleaseCandidates } from "./releaseCandidate.js";

export interface EvidenceBundleResult {
  readonly path: string;
  readonly pruned: readonly string[];
}

async function exists(path: string): Promise<boolean> {
  try { await readFile(path, "utf8"); return true; } catch { return false; }
}

async function jsonFiles(dir: string): Promise<string[]> {
  try { return (await readdir(dir, { withFileTypes: true })).filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => join(dir, e.name)).sort(); } catch { return []; }
}

async function reportFiles(dir: string): Promise<string[]> {
  try { return (await readdir(dir, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => join(dir, e.name)).sort(); } catch { return []; }
}

export async function bundleReleaseEvidence(workspaceRoot: string, input: { readonly context: string; readonly release: string; readonly prune?: boolean }): Promise<EvidenceBundleResult> {
  const context = await new ContextService(workspaceRoot).show(input.context);
  const bundleDir = join(workspaceRoot, ".dadaia-pi", "evidence-bundles", context.name, input.release);
  await mkdir(bundleDir, { recursive: true });
  const bundlePath = join(bundleDir, "bundle.json");
  if (await exists(bundlePath)) throw new Error(`evidence bundle already exists: ${relative(workspaceRoot, bundlePath)}`);
  const workflowFiles = await jsonFiles(join(workspaceRoot, ".dadaia-pi", "workflows", context.name));
  const manifests = [] as unknown[];
  const matchedWorkflowFiles: string[] = [];
  for (const file of workflowFiles) {
    const parsed = JSON.parse(await readFile(file, "utf8")) as { release?: string };
    if (parsed.release === input.release) { manifests.push(parsed); matchedWorkflowFiles.push(file); }
  }
  const reports = (await reportFiles(join(workspaceRoot, ".dadaia-pi", "reports", context.name, "workflows"))).filter((file) => matchedWorkflowFiles.some((manifest) => file.includes(manifest.split("/").pop()?.replace(/\.json$/, ".md") ?? "")));
  const handoffs = await listHandoffs(workspaceRoot, context.name);
  const rcs = await listReleaseCandidates(workspaceRoot, context.name, input.release);
  const bundle = { schemaVersion: 1, context: context.name, release: input.release, createdAt: new Date().toISOString(), immutable: true, manifests, reports: reports.map((p) => relative(workspaceRoot, p)), handoffs, releaseCandidates: rcs };
  await writeFile(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  const pruned: string[] = [];
  if (input.prune) {
    const archive = join(bundleDir, "archive");
    await mkdir(archive, { recursive: true });
    for (const file of [...matchedWorkflowFiles, ...reports]) {
      const dest = join(archive, file.split("/").pop() ?? "evidence");
      await rename(file, dest).catch(() => undefined);
      pruned.push(relative(workspaceRoot, file));
    }
  }
  return { path: relative(workspaceRoot, bundlePath).replaceAll("\\", "/"), pruned };
}
