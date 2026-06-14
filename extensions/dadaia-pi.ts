// Pi package extension for dadaia-pi-workspace.
// T-005 adds first-pass READ tool restriction plus tool_call/user_bash blocking.

import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { bindCurrentSession, releaseCurrentSession, statusCurrentSession } from "../dist/src/pi/extensionCommands.js";

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
  on(
    event: "before_agent_start",
    handler: (_event: unknown, ctx: EventContext) => Promise<{ message?: { customType: string; content: string; display: boolean } } | undefined>,
  ): void;
  on(event: "session_start", handler: (_event: unknown, ctx: EventContext) => Promise<void> | void): void;
  on(event: "tool_call", handler: (event: ToolEvent, ctx: EventContext) => Promise<{ block: true; reason: string } | undefined>): void;
  on(event: "user_bash", handler: (event: UserBashEvent, ctx: EventContext) => Promise<{ result: { output: string; exitCode: number; cancelled: false; truncated: false } } | undefined>): void;
};

type Binding = {
  sessionId: string;
  context: string;
  mode: string;
  release?: string;
};

const READ_MODE_TOOLS = ["read", "grep", "find", "ls", "bash"] as const;

function panelComponent(lines: readonly string[]): SimpleComponent {
  return {
    render(width: number): string[] {
      return ["dadaia-pi workspace", "─".repeat(Math.min(width, 24)), ...lines].map((line) => line.slice(0, width));
    },
    invalidate() {},
  };
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function sessionRecordPath(cwd: string, sessionId: string): string {
  return join(cwd, ".dadaia-pi", "sessions", `${sessionId}.json`);
}

function normalize(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isMutatingPath(cwd: string, target: string): boolean {
  const rel = normalize(relative(cwd, target));
  const stripped = rel.startsWith("repos/") ? rel.split("/").slice(2).join("/") : rel;
  if (stripped.startsWith(".dadaia-pi/sessions/") || stripped.startsWith(".dadaia-pi/states/")) return true;
  if (stripped.startsWith("specs/backlog/") || stripped.startsWith("specs/bugs/") || stripped.startsWith("specs/audits/")) return false;
  if (stripped.startsWith(".dadaia-pi/reports/") || stripped.startsWith(".dadaia-pi/handoff/") || stripped.startsWith(".dadaia-pi/tmp/")) return false;
  if (stripped.startsWith("specs/")) return true;
  return rel.startsWith("repos/");
}

function toolTargets(cwd: string, event: ToolEvent): string[] {
  if ((event.toolName === "write" || event.toolName === "edit") && typeof event.input.path === "string") {
    return [join(cwd, event.input.path)];
  }
  return [];
}

function bashTargets(cwd: string, command: string): string[] {
  const paths: string[] = [];
  for (const match of command.matchAll(/(?:^|\s)(?:>|>>|2>|&>)\s*([^\s;&|]+)/g)) {
    if (match[1]) paths.push(join(cwd, match[1].replace(/^['\"]|['\"]$/g, "")));
  }
  return paths;
}

async function buildBootstrap(cwd: string, binding: Binding): Promise<string> {
  const constitution = await readText(join(cwd, "specs", "constitution.md"));
  const techStack = await readText(join(cwd, "specs", "memory", "tech-stack.md"));
  const catalog = await readText(join(cwd, "specs", "memory", "product", "catalog.json"));
  return [
    "=== dadaia-pi workspace memory bootstrap ===",
    `context: ${binding.context}`,
    `mode: ${binding.mode}`,
    binding.release ? `release: ${binding.release}` : undefined,
    "--- constitution.md ---",
    constitution ?? "(missing constitution.md)",
    "--- memory/tech-stack.md ---",
    techStack ?? "(missing memory/tech-stack.md)",
    "--- memory/product/catalog.json ---",
    catalog ?? "(missing memory/product/catalog.json)",
    "=== end dadaia-pi workspace memory bootstrap ===",
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

export default function dadaiaPiExtension(pi: ExtensionApi): void {
  async function bindingFor(ctx: EventContext): Promise<Binding | undefined> {
    return readJson<Binding>(sessionRecordPath(ctx.cwd, ctx.sessionManager.getSessionId()));
  }

  pi.registerCommand("dadaia-bind", {
    description: "Bind the current Pi session to a dadaia-pi-workspace context",
    async handler(args, ctx) {
      try {
        ctx.ui.notify(await bindCurrentSession(ctx.cwd, ctx.sessionManager.getSessionId(), args, process.pid), "info");
      } catch (error) {
        ctx.ui.notify((error as Error).message, "error");
      }
    },
  });

  pi.registerCommand("dadaia-release", {
    description: "Release the current Pi session's dadaia-pi-workspace binding",
    async handler(_args, ctx) {
      try {
        ctx.ui.notify(await releaseCurrentSession(ctx.cwd, ctx.sessionManager.getSessionId()), "info");
      } catch (error) {
        ctx.ui.notify((error as Error).message, "error");
      }
    },
  });

  pi.registerCommand("dadaia-status", {
    description: "Show dadaia-pi-workspace package status for the current Pi session",
    async handler(_args, ctx) {
      try {
        ctx.ui.notify(await statusCurrentSession(ctx.cwd, ctx.sessionManager.getSessionId()), "info");
      } catch (error) {
        ctx.ui.notify((error as Error).message, "error");
      }
    },
  });

  pi.registerCommand("dadaia-panel", {
    description: "Show a read-only dadaia-pi workspace status panel",
    async handler(_args, ctx) {
      try {
        const status = await statusCurrentSession(ctx.cwd, ctx.sessionManager.getSessionId());
        if (ctx.ui.custom) ctx.ui.custom(panelComponent(status.split("; ").map((line) => line.trim())), { overlay: true });
        else ctx.ui.notify(status, "info");
      } catch (error) {
        ctx.ui.notify((error as Error).message, "error");
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    const binding = await bindingFor(ctx);
    if (binding?.mode === "READ") pi.setActiveTools?.(READ_MODE_TOOLS);
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    const binding = await bindingFor(ctx);
    if (!binding) return undefined;
    if (binding.mode === "READ") pi.setActiveTools?.(READ_MODE_TOOLS);
    return {
      message: {
        customType: "dadaia-pi-memory-bootstrap",
        content: await buildBootstrap(ctx.cwd, binding),
        display: false,
      },
    };
  });

  pi.on("tool_call", async (event, ctx) => {
    const binding = await bindingFor(ctx);
    if (binding?.mode !== "READ") return undefined;
    const blocked = toolTargets(ctx.cwd, event).find((target) => isMutatingPath(ctx.cwd, target));
    return blocked ? { block: true, reason: `dadaia-pi READ mode blocks mutating tool path: ${blocked}` } : undefined;
  });

  pi.on("user_bash", async (event, ctx) => {
    const binding = await bindingFor(ctx);
    if (binding?.mode !== "READ") return undefined;
    const blocked = bashTargets(event.cwd, event.command).find((target) => isMutatingPath(ctx.cwd, target));
    if (!blocked) return undefined;
    return {
      result: {
        output: `dadaia-pi READ mode blocked mutating shell command target: ${blocked}\n`,
        exitCode: 1,
        cancelled: false,
        truncated: false,
      },
    };
  });
}
