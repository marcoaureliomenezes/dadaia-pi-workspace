import type { WorkflowDefinition, WorkflowRunInput } from "./types.js";

export interface WorkflowSdkResult {
  readonly mode: "sdk" | "fallback" | "python";
  readonly accepted: boolean;
  readonly summary: string;
}

export interface WorkflowSdkAdapter {
  runStep(definition: WorkflowDefinition, input: WorkflowRunInput, prompt: string): Promise<WorkflowSdkResult>;
}

type PiSession = { prompt: (text: string) => Promise<unknown>; dispose?: () => void; messages?: unknown[]; getMessages?: () => unknown[] | Promise<unknown[]> };

type PiCodingAgentModule = {
  createAgentSession?: (options?: Record<string, unknown>) => Promise<{ session: PiSession }>;
  AuthStorage?: { create: () => unknown };
  ModelRegistry?: { create: (authStorage: unknown) => unknown };
  SessionManager?: { inMemory: () => unknown };
};

async function importPiSdk(): Promise<PiCodingAgentModule | undefined> {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<PiCodingAgentModule>;
    return await dynamicImport("@earendil-works/pi-coding-agent");
  } catch {
    return undefined;
  }
}

function fallbackSummary(definition: WorkflowDefinition, input: WorkflowRunInput, prompt: string): string {
  return [
    `Dry-run/fallback SDK step for ${definition.id}.`,
    `Context: ${input.context}.`,
    input.release ? `Release: ${input.release}.` : "Release: none.",
    `Bounded role: ${definition.sdkStep.promptRole}`,
    `Allowed tools: ${definition.sdkStep.allowedTools.join(", ") || "none"}.`,
    prompt.trim().length > 0 ? `Prompt bytes: ${Buffer.byteLength(prompt, "utf8")}.` : "Prompt: none provided.",
  ].join("\n");
}

function extractMessageText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value !== "object" || value === null) return [];
  if (Array.isArray(value)) return value.flatMap(extractMessageText);
  const record = value as Record<string, unknown>;
  const direct = [record.text, record.content, record.message, record.output, record.summary].flatMap(extractMessageText);
  if (direct.length > 0) return direct;
  return [];
}

async function capturedOutput(session: PiSession, promptResult: unknown): Promise<string> {
  const messages = typeof session.getMessages === "function" ? await session.getMessages() : session.messages;
  const parts = [...extractMessageText(promptResult), ...extractMessageText(messages)].map((part) => part.trim()).filter(Boolean);
  return [...new Set(parts)].join("\n\n");
}

export class PiSdkWorkflowAdapter implements WorkflowSdkAdapter {
  async runStep(definition: WorkflowDefinition, input: WorkflowRunInput, prompt: string): Promise<WorkflowSdkResult> {
    if (input.dryRun) {
      return { mode: "fallback", accepted: true, summary: fallbackSummary(definition, input, prompt) };
    }

    const sdk = await importPiSdk();
    if (!sdk?.createAgentSession) {
      return {
        mode: "fallback",
        accepted: true,
        summary: `${fallbackSummary(definition, input, prompt)}\nPi SDK package was not available, so no model call was made.`,
      };
    }

    const options: Record<string, unknown> = { tools: [...definition.sdkStep.allowedTools] };
    if (input.model) options.model = input.model;
    if (sdk.AuthStorage && sdk.ModelRegistry && sdk.SessionManager) {
      const authStorage = sdk.AuthStorage.create();
      options.authStorage = authStorage;
      options.modelRegistry = sdk.ModelRegistry.create(authStorage);
      options.sessionManager = sdk.SessionManager.inMemory();
    }

    const { session } = await sdk.createAgentSession(options);
    try {
      const boundedPrompt = [
        `You are executing dadaia-pi-workspace workflow ${definition.id}.`,
        `Role: ${definition.sdkStep.promptRole}`,
        `Scope: ${definition.sdkStep.boundedScope}`,
        `Expected output: ${definition.sdkStep.expectedOutput}`,
        `Context: ${input.context}`,
        input.release ? `Release: ${input.release}` : undefined,
        "Operator prompt:",
        prompt || "(none)",
      ]
        .filter((line): line is string => line !== undefined)
        .join("\n\n");
      const promptResult = await session.prompt(boundedPrompt);
      const output = await capturedOutput(session, promptResult);
      return { mode: "sdk", accepted: true, summary: output || `Pi SDK completed bounded step ${definition.sdkStep.name}; no assistant output was exposed by the SDK.` };
    } finally {
      session.dispose?.();
    }
  }
}
