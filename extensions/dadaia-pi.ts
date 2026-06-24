// Thin Pi package adapter for dadaia-pi-workspace.
// Lifecycle policy lives in the Python runtime; this file only adapts Pi events
// and slash commands to the Python JSON bridge.

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type SimpleComponent = { render(width: number): string[]; invalidate(): void };

type CommandContext = {
  cwd: string;
  sessionManager: { getSessionId(): string };
  ui: {
    notify(message: string, type?: "info" | "warning" | "error"): void;
    custom?(component: SimpleComponent, options?: { overlay?: boolean }): unknown;
  };
};

type EventContext = CommandContext;
type ToolEvent = { toolName: string; input: Record<string, unknown> };
type UserBashEvent = { command: string; cwd: string };

type ExtensionApi = {
  registerCommand(name: string, options: { description: string; handler: (args: string, ctx: CommandContext) => unknown }): void;
  setActiveTools?(names: readonly string[]): void;
  on(event: "before_agent_start", handler: (_event: unknown, ctx: EventContext) => Promise<{ message?: { customType: string; content: string; display: boolean } } | undefined>): void;
  on(event: "session_start", handler: (_event: unknown, ctx: EventContext) => Promise<void> | void): void;
  on(event: "tool_call", handler: (event: ToolEvent, ctx: EventContext) => Promise<{ block: true; reason: string } | undefined>): void;
  on(event: "user_bash", handler: (event: UserBashEvent, ctx: EventContext) => Promise<{ result: { output: string; exitCode: number; cancelled: false; truncated: false } } | undefined>): void;
};

type BridgeResult = {
  ok?: boolean;
  message?: string;
  content?: string;
  binding?: { mode?: string } | null;
  allow?: boolean;
  reason?: string;
};

const READ_MODE_TOOLS = ["read", "grep", "find", "ls", "bash"] as const;

function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function splitCommandArgs(input: string): string[] {
  return [...input.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3] ?? "");
}

function cliPath(): string {
  return join(packageRoot(), "dist", "src", "cli", "main.js");
}

function launchPanelServer(cwd: string, args: string): string {
  const panelArgs = [cliPath(), "panel", ...splitCommandArgs(args)];
  const child = spawn(process.execPath, panelArgs, { cwd, detached: true, stdio: "ignore" });
  child.unref();
  return "dadaia-pi panel starting at http://127.0.0.1:4999/";
}

function bridge(operation: string, payload: Record<string, unknown>): Promise<BridgeResult> {
  const root = packageRoot();
  const python = process.env.DADAIA_PI_PYTHON ?? "python3";
  const env = {
    ...process.env,
    PYTHONPATH: [join(root, "src"), process.env.PYTHONPATH].filter(Boolean).join(":"),
  };
  return new Promise((resolve, reject) => {
    const child = spawn(python, ["-m", "dadaia_pi", "pi-bridge", operation], { cwd: String(payload.cwd ?? process.cwd()), env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `dadaia-pi python bridge failed with ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as BridgeResult);
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(`${JSON.stringify(payload)}\n`);
  });
}

function basePayload(ctx: EventContext): Record<string, unknown> {
  return { cwd: ctx.cwd, sessionId: ctx.sessionManager.getSessionId(), pid: process.pid };
}

export default function dadaiaPiExtension(pi: ExtensionApi): void {
  pi.registerCommand("dadaia-bind", {
    description: "Bind the current Pi session to a dadaia-pi-workspace context",
    async handler(args, ctx) {
      try {
        const result = await bridge("bind", { ...basePayload(ctx), args });
        ctx.ui.notify(result.message ?? "dadaia-pi bind complete", "info");
      } catch (error) {
        ctx.ui.notify((error as Error).message, "error");
      }
    },
  });

  pi.registerCommand("dadaia-release", {
    description: "Release the current Pi session's dadaia-pi-workspace binding",
    async handler(_args, ctx) {
      try {
        const result = await bridge("release", basePayload(ctx));
        ctx.ui.notify(result.message ?? "dadaia-pi binding released", "info");
      } catch (error) {
        ctx.ui.notify((error as Error).message, "error");
      }
    },
  });

  pi.registerCommand("dadaia-status", {
    description: "Show dadaia-pi-workspace package status for the current Pi session",
    async handler(_args, ctx) {
      try {
        const result = await bridge("status", basePayload(ctx));
        ctx.ui.notify(result.message ?? "dadaia-pi status unavailable", "info");
      } catch (error) {
        ctx.ui.notify((error as Error).message, "error");
      }
    },
  });

  pi.registerCommand("dadaia-workflow-status", {
    description: "Show workflow phase/gate status for the bound dadaia-pi context",
    async handler(_args, ctx) {
      try {
        const result = await bridge("workflow-status", basePayload(ctx));
        ctx.ui.notify(result.message ?? "no dadaia-pi binding", "info");
      } catch (error) {
        ctx.ui.notify((error as Error).message, "error");
      }
    },
  });

  pi.registerCommand("dadaia-panel", {
    description: "Start the local dadaia-pi browser panel server",
    handler(args, ctx) {
      try {
        ctx.ui.notify(launchPanelServer(ctx.cwd, args), "info");
      } catch (error) {
        ctx.ui.notify((error as Error).message, "error");
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    const result = await bridge("heartbeat", basePayload(ctx));
    if (result.binding?.mode === "READ") pi.setActiveTools?.(READ_MODE_TOOLS);
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    const result = await bridge("bootstrap", basePayload(ctx));
    if (result.binding?.mode === "READ") pi.setActiveTools?.(READ_MODE_TOOLS);
    if (!result.content) return undefined;
    return { message: { customType: "dadaia-pi-memory-bootstrap", content: result.content, display: false } };
  });

  pi.on("tool_call", async (event, ctx) => {
    const result = await bridge("tool-check", { ...basePayload(ctx), toolName: event.toolName, input: event.input });
    if (result.allow === false) return { block: true, reason: `dadaia-pi Python gate blocked tool call: ${result.reason ?? "blocked"}` };
    return undefined;
  });

  pi.on("user_bash", async (event, ctx) => {
    const result = await bridge("bash-check", { ...basePayload(ctx), command: event.command, bashCwd: event.cwd });
    if (result.allow === false) {
      return { result: { output: `dadaia-pi Python gate blocked shell command: ${result.reason ?? "blocked"}\n`, exitCode: 1, cancelled: false, truncated: false } };
    }
    return undefined;
  });
}
