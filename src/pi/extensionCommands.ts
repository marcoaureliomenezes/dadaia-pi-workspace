import { SessionBindingService } from "../features/context/sessionBinding.js";
import { buildWorkspaceStatus } from "../features/status/index.js";

export interface ParsedBindArgs {
  readonly context: string;
  readonly mode?: string;
  readonly release?: string;
}

function splitArgs(input: string): string[] {
  return [...input.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3] ?? "");
}

export function parseBindArgs(input: string): ParsedBindArgs {
  const args = splitArgs(input);
  const context = args[0];
  if (!context || context.startsWith("--")) throw new Error("dadaia-bind requires <context>");
  const result: { context: string; mode?: string; release?: string } = { context };
  for (let index = 1; index < args.length; index += 1) {
    const item = args[index];
    if (item === "--mode") {
      const value = args[++index];
      if (!value) throw new Error("--mode requires a value");
      result.mode = value;
      continue;
    }
    if (item === "--release") {
      const value = args[++index];
      if (!value) throw new Error("--release requires a value");
      result.release = value;
      continue;
    }
    throw new Error(`Unknown dadaia-bind option: ${item}`);
  }
  return result;
}

export async function bindCurrentSession(cwd: string, sessionId: string, args: string, pid?: number): Promise<string> {
  const parsed = parseBindArgs(args);
  const record = await new SessionBindingService(cwd).bind({
    sessionId,
    context: parsed.context,
    ...(parsed.mode ? { mode: parsed.mode } : {}),
    ...(parsed.release ? { release: parsed.release } : {}),
    ...(pid ? { pid } : {}),
  });
  return `dadaia-pi bound ${record.sessionId} to ${record.context} (${record.mode}${record.release ? `, ${record.release}` : ""})`;
}

export async function releaseCurrentSession(cwd: string, sessionId: string): Promise<string> {
  const existing = await new SessionBindingService(cwd).read(sessionId);
  if (!existing) return `dadaia-pi session is not bound: ${sessionId}`;
  await new SessionBindingService(cwd).release(sessionId);
  return `dadaia-pi released ${sessionId} from ${existing.context}`;
}

export async function statusCurrentSession(cwd: string, sessionId: string): Promise<string> {
  const report = await buildWorkspaceStatus(cwd, { sessionId });
  const binding = report.binding;
  if (!binding) return `dadaia-pi session is not bound: ${sessionId}; contexts=${report.contexts.length}; doctor=${report.doctor.errors}/${report.doctor.warnings}`;
  const selected = report.contexts.find((context) => context.name === binding.context);
  const release = selected?.release;
  const taskText = release?.tasks ? ` tasks=${release.tasks.open}/${release.tasks.inProgress}/${release.tasks.done}` : "";
  return `dadaia-pi bound to ${binding.context} (${binding.mode}${binding.release ? `, ${binding.release}` : ""}); doctor=${report.doctor.errors}/${report.doctor.warnings}; release=${release?.release ?? "none"} phase=${release?.phase ?? "unknown"}${taskText}`;
}
