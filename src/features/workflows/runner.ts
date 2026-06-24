import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { ContextService } from "../context/service.js";
import { getWorkflowDefinition } from "./catalog.js";
import { emitWorkflowHandoff } from "./handoffLink.js";
import { appendReleaseCandidateReview, inspectReleaseCandidate } from "./releaseCandidate.js";
import { PiSdkWorkflowAdapter, type WorkflowSdkAdapter } from "./sdkAdapter.js";
import { runPythonWorkflow } from "./pythonEngine.js";
import type { WorkflowRunInput, WorkflowRunManifest, WorkflowRunResult, WorkflowVerdict, WorkflowVerdictRecord } from "./types.js";

function timestamp(): string {
  return new Date().toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "workflow";
}

async function readOptionalPrompt(path: string | undefined): Promise<string> {
  if (!path) return "";
  return readFile(resolve(path), "utf8");
}

async function assertReleaseExists(workspaceRoot: string, repoSlug: string, release: string | undefined, workflowId: string): Promise<void> {
  if (!release) return;
  const releaseDir = join(workspaceRoot, "repos", repoSlug, "specs", "releases", release);
  for (const file of ["SPEC.md", "PLAN.md", "TASKS.md"]) {
    try {
      await readFile(join(releaseDir, file), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`workflow ${workflowId} requires release artifact: ${join(releaseDir, file)}`);
      throw error;
    }
  }
}

function parseStructuredVerdict(summary: string): Partial<WorkflowVerdictRecord> & { verdict?: WorkflowVerdict; parsedJson?: boolean } {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(summary)?.[1];
  const candidates = [fenced, summary.match(/\{[\s\S]*\}/)?.[0]].filter((value): value is string => value !== undefined);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const root = typeof parsed.verdict === "object" && parsed.verdict !== null ? (parsed.verdict as Record<string, unknown>) : parsed;
      const verdict = typeof root.verdict === "string" ? root.verdict : typeof root.value === "string" ? root.value : undefined;
      return {
        parsedJson: true,
        ...(verdict === "APPROVED" || verdict === "NEEDS_CHANGES" || verdict === "REJECTED" ? { verdict } : {}),
        ...(Array.isArray(root.findings) ? { findings: root.findings.map(String) } : {}),
        ...(typeof root.blockingFindings === "number" ? { blockingFindings: root.blockingFindings } : {}),
        ...(root.risk === "low" || root.risk === "medium" || root.risk === "high" || root.risk === "unknown" ? { risk: root.risk } : {}),
        ...(Array.isArray(root.reviewedPaths) ? { reviewedPaths: root.reviewedPaths.map(String) } : {}),
        ...(Array.isArray(root.acceptanceCoverage) ? { acceptanceCoverage: root.acceptanceCoverage.map(String) } : {}),
      };
    } catch {
      // Try the next candidate.
    }
  }
  return {};
}

function extractVerdict(summary: string, explicit: WorkflowVerdict | undefined, dryRun: boolean, workflowId = ""): WorkflowVerdictRecord {
  const structured = parseStructuredVerdict(summary);
  const strictJsonRequired = !dryRun && !explicit && ["spec-review", "qa-review", "security-review", "code-review", "release-closure"].includes(workflowId);
  const value = strictJsonRequired && !structured.parsedJson ? "NEEDS_CHANGES" : explicit ?? structured.verdict ?? ((): WorkflowVerdict => {
    const match = /\b(APPROVED|NEEDS_CHANGES|REJECTED)\b/.exec(summary);
    if (match?.[1] === "APPROVED" || match?.[1] === "NEEDS_CHANGES" || match?.[1] === "REJECTED") return match[1];
    return dryRun ? "APPROVED" : "NEEDS_CHANGES";
  })();
  const source = explicit ? "cli" : structured.verdict || /\b(APPROVED|NEEDS_CHANGES|REJECTED)\b/.test(summary) ? "sdk-summary" : "dry-run-default";
  const blockingMatch = /blockingFindings\s*[:=]\s*(\d+)/i.exec(summary);
  const riskMatch = /risk\s*[:=]\s*(low|medium|high|unknown)/i.exec(summary);
  return {
    value,
    source,
    findings: strictJsonRequired && !structured.parsedJson ? ["SDK review output did not include parseable JSON verdict"] : structured.findings ?? [],
    blockingFindings: strictJsonRequired && !structured.parsedJson ? 1 : structured.blockingFindings ?? (blockingMatch ? Number(blockingMatch[1]) : value === "APPROVED" ? 0 : 1),
    risk: structured.risk ?? (riskMatch?.[1] === "low" || riskMatch?.[1] === "medium" || riskMatch?.[1] === "high" || riskMatch?.[1] === "unknown" ? riskMatch[1] : value === "APPROVED" ? "low" : "unknown"),
    reviewedPaths: structured.reviewedPaths ?? [],
    acceptanceCoverage: structured.acceptanceCoverage ?? [],
  };
}

function renderReport(manifest: WorkflowRunManifest, prompt: string): string {
  return [
    `# Workflow report - ${manifest.workflowId}`,
    "",
    `- Run: ${manifest.runId}`,
    `- Context: ${manifest.context}`,
    `- Release: ${manifest.release ?? "none"}`,
    `- Phase: ${manifest.phase}`,
    `- Activity: ${manifest.activity}`,
    `- SDK mode: ${manifest.sdk.mode}`,
    `- Verdict: ${manifest.verdict.value} (${manifest.verdict.source})`,
    `- Dry run: ${manifest.dryRun ? "yes" : "no"}`,
    manifest.releaseCandidate ? `- Release candidate: ${manifest.releaseCandidate.id}` : undefined,
    `- Manifest: ${manifest.artifacts.manifest}`,
    "",
    "## Deterministic preflight",
    ...manifest.checks.preflight.map((check) => `- ${check.required ? "required" : "optional"}: ${check.name} — ${check.description}`),
    "",
    "## Bounded SDK step",
    "",
    manifest.sdk.summary,
    "",
    ...(manifest.orchestration?.executions?.length ? ["## Step executions", "", ...manifest.orchestration.executions.map((step) => `- ${step.id} (${step.kind}${step.model ? `, model=${step.model}` : ""}, mode=${step.mode}): ${step.accepted ? "accepted" : "blocked"}\n  ${step.summary.replaceAll("\n", "\n  ")}`)] : []),
    "",
    "## Deterministic postflight",
    ...manifest.checks.postflight.map((check) => `- ${check.required ? "required" : "optional"}: ${check.name} — ${check.description}`),
    "",
    "## Operator prompt snapshot",
    "",
    prompt.trim().length > 0 ? "```text" : "",
    prompt.trim().length > 0 ? prompt.trim() : "(none)",
    prompt.trim().length > 0 ? "```" : "",
    "",
  ].filter((line): line is string => line !== undefined).join("\n");
}

export async function runWorkflow(workspaceRoot: string, input: WorkflowRunInput, adapter: WorkflowSdkAdapter = new PiSdkWorkflowAdapter()): Promise<WorkflowRunResult> {
  const definition = getWorkflowDefinition(input.workflowId);
  const context = await new ContextService(workspaceRoot).show(input.context);
  if (context.state !== "ALIVE") throw new Error(`workflow ${definition.id} requires ALIVE context: ${context.name}`);
  if (!["release-definition", "release-define", "backlog-definition", "backlog-intake"].includes(definition.id)) {
    await assertReleaseExists(workspaceRoot, context.repoSlug, input.release, definition.id);
  }

  const prompt = await readOptionalPrompt(input.promptFile);
  const runId = `${timestamp()}-${slug(definition.id)}`;
  const workflowDir = join(workspaceRoot, ".dadaia-pi", "workflows", context.name);
  const reportDir = join(workspaceRoot, ".dadaia-pi", "reports", context.name, "workflows");
  await mkdir(workflowDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });

  const manifestPath = join(workflowDir, `${runId}.json`);
  const reportPath = join(reportDir, `${runId}.md`);
  const python = definition.orchestration?.engine === "python" ? await runPythonWorkflow(definition, workspaceRoot, input, prompt) : undefined;
  const sdk = python ? { mode: python.mode, accepted: python.accepted, summary: python.summary } : await adapter.runStep(definition, input, prompt);
  const extractedVerdict = extractVerdict(sdk.summary, input.verdict, input.dryRun === true, definition.id);
  const rcChangedFiles = input.rcId && input.release && ["qa-review", "security-review", "code-review"].includes(definition.id) ? (await inspectReleaseCandidate(workspaceRoot, context.name, input.release, input.rcId).catch(() => undefined))?.changedFiles ?? [] : [];
  const verdict: WorkflowVerdictRecord = {
    ...extractedVerdict,
    reviewedPaths: extractedVerdict.reviewedPaths.length > 0 ? extractedVerdict.reviewedPaths : rcChangedFiles,
    acceptanceCoverage: extractedVerdict.acceptanceCoverage.length > 0 ? extractedVerdict.acceptanceCoverage : definition.id === "qa-review" ? ["<release-acceptance>"] : extractedVerdict.acceptanceCoverage,
  };

  let manifest: WorkflowRunManifest = {
    schemaVersion: 1,
    runId,
    workflowId: definition.id,
    title: definition.title,
    phase: definition.phase,
    activity: definition.activity,
    context: context.name,
    repoSlug: context.repoSlug,
    ...(input.release ? { release: input.release } : {}),
    ...(input.promptFile ? { promptFile: input.promptFile } : {}),
    ...(input.model ? { model: input.model } : {}),
    dryRun: input.dryRun === true,
    sdk,
    ...(definition.orchestration ? { orchestration: { engine: definition.orchestration.engine, module: definition.orchestration.module, steps: python?.steps ?? definition.orchestration.steps, ...(python ? { executions: python.executions } : {}) } } : {}),
    verdict,
    linkedHandoffs: [],
    ...(input.rcId ? { releaseCandidate: { id: input.rcId } } : {}),
    checks: {
      preflight: definition.deterministicPreflight,
      postflight: definition.deterministicPostflight,
    },
    artifacts: {
      manifest: relative(workspaceRoot, manifestPath),
      report: relative(workspaceRoot, reportPath),
    },
    createdAt: new Date().toISOString(),
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const handoffPath = await emitWorkflowHandoff(workspaceRoot, manifest, manifestPath);
  if (handoffPath) {
    manifest = { ...manifest, linkedHandoffs: [handoffPath] };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  if (input.rcId) await appendReleaseCandidateReview(workspaceRoot, context.name, input.release ?? "unbound", input.rcId, definition.id, manifest.artifacts.manifest);
  const reportText = renderReport(manifest, prompt);
  await writeFile(reportPath, reportText, "utf8");
  return { manifest, reportText };
}
