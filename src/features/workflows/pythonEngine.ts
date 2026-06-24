import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import type { WorkflowDefinition, WorkflowRunInput, WorkflowOrchestrationStep, WorkflowStepExecution } from "./types.js";
import type { WorkflowSdkResult } from "./sdkAdapter.js";

export interface PythonWorkflowResult extends WorkflowSdkResult {
  readonly steps: readonly WorkflowOrchestrationStep[];
  readonly executions: readonly WorkflowStepExecution[];
}

function packageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../../..");
}

export async function runPythonWorkflow(definition: WorkflowDefinition, workspaceRoot: string, input: WorkflowRunInput, prompt: string): Promise<PythonWorkflowResult> {
  if (!definition.orchestration) throw new Error(`workflow ${definition.id} has no python orchestration`);
  const modulePath = join(packageRoot(), "workflows", definition.orchestration.module);
  const payload = JSON.stringify({
    workflow: { id: definition.id, title: definition.title, orchestration: definition.orchestration },
    workspaceRoot,
    input,
    prompt,
  });
  const output = await new Promise<string>((resolvePromise, reject) => {
    const child = spawn(process.env.DADAIA_PI_PYTHON ?? "python3", [modulePath], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(stdout);
      else reject(new Error(`python workflow ${definition.orchestration?.module} failed with ${code}: ${stderr || stdout}`));
    });
    child.stdin.end(payload);
  });
  const parsed = JSON.parse(output) as { accepted?: boolean; summary?: string; steps?: WorkflowOrchestrationStep[]; executions?: WorkflowStepExecution[] };
  return {
    mode: "python",
    accepted: parsed.accepted !== false,
    summary: parsed.summary ?? output,
    steps: parsed.steps ?? definition.orchestration.steps,
    executions: parsed.executions ?? [],
  };
}
