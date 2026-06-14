import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  assertSessionId,
  modeRequiresRelease,
  parseSessionMode,
  type SessionBindingRecord,
  type SessionMode,
} from "../../core/session.js";
import { STATE_DIR_NAME } from "../../core/workspace.js";
import { ContextService } from "./service.js";
import { bindEpochPath, contextPointerPath, sessionPointerPath, sessionRecordPath } from "./sessionPaths.js";

export interface BindInput {
  readonly sessionId: string;
  readonly context: string;
  readonly mode?: string;
  readonly release?: string;
  readonly pid?: number;
  readonly ttlSeconds?: number;
}

export interface MemoryBootstrap {
  readonly context: string;
  readonly content: string;
}

function now(): string {
  return new Date().toISOString();
}

async function writeAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, path);
}

async function writeText(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

export class SessionBindingService {
  constructor(private readonly workspaceRoot: string) {}

  async bind(input: BindInput): Promise<SessionBindingRecord> {
    assertSessionId(input.sessionId);
    const context = await new ContextService(this.workspaceRoot).show(input.context);
    const mode = parseSessionMode(input.mode);
    if (modeRequiresRelease(mode) && !input.release) {
      throw new Error(`Mode ${mode} requires --release <id>`);
    }
    const timestamp = now();
    const record: SessionBindingRecord = {
      sessionId: input.sessionId,
      context: context.name,
      mode,
      ...(input.release ? { release: input.release } : {}),
      ...(input.pid ? { pid: input.pid } : {}),
      boundAt: timestamp,
      lastSeenAt: timestamp,
      ttlSeconds: input.ttlSeconds ?? 86_400,
    };
    await writeAtomic(sessionRecordPath(this.workspaceRoot, input.sessionId), `${JSON.stringify(record, null, 2)}\n`);
    await writeText(contextPointerPath(this.workspaceRoot, context.name), `${input.sessionId}\n`);
    await writeText(sessionPointerPath(this.workspaceRoot, input.sessionId), `${context.name}\n`);
    await writeText(bindEpochPath(this.workspaceRoot, context.name), timestamp);
    return record;
  }

  async read(sessionId: string): Promise<SessionBindingRecord | undefined> {
    assertSessionId(sessionId);
    try {
      return JSON.parse(await readFile(sessionRecordPath(this.workspaceRoot, sessionId), "utf8")) as SessionBindingRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async status(sessionId: string): Promise<SessionBindingRecord> {
    const record = await this.read(sessionId);
    if (!record) throw new Error(`Session is not bound: ${sessionId}`);
    return record;
  }

  async release(sessionId: string): Promise<void> {
    const record = await this.read(sessionId);
    if (!record) return;
    await rm(sessionRecordPath(this.workspaceRoot, sessionId), { force: true });
    await rm(sessionPointerPath(this.workspaceRoot, sessionId), { force: true });
    const ptrPath = contextPointerPath(this.workspaceRoot, record.context);
    try {
      const current = (await readFile(ptrPath, "utf8")).trim();
      if (current === sessionId) await rm(ptrPath, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async memoryBootstrap(sessionId: string): Promise<MemoryBootstrap> {
    const binding = await this.status(sessionId);
    const context = await new ContextService(this.workspaceRoot).show(binding.context);
    const specsDir = join(this.workspaceRoot, "repos", context.repoSlug, "specs");
    const fallbackSpecsDir = join(this.workspaceRoot, "specs");
    const base = context.state === "ALIVE" ? specsDir : fallbackSpecsDir;
    const parts = await Promise.all([
      readMaybe(join(base, "constitution.md")),
      readMaybe(join(base, "memory", "tech-stack.md")),
      readMaybe(join(base, "memory", "product", "catalog.json")),
    ]);
    const content = [
      "=== dadaia-pi workspace memory bootstrap ===",
      `context: ${binding.context}`,
      `mode: ${binding.mode}`,
      binding.release ? `release: ${binding.release}` : undefined,
      "--- constitution.md ---",
      parts[0] ?? "(missing constitution.md)",
      "--- memory/tech-stack.md ---",
      parts[1] ?? "(missing memory/tech-stack.md)",
      "--- memory/product/catalog.json ---",
      parts[2] ?? "(missing memory/product/catalog.json)",
      "=== end dadaia-pi workspace memory bootstrap ===",
    ]
      .filter((line): line is string => line !== undefined)
      .join("\n");
    return { context: binding.context, content };
  }
}

async function readMaybe(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export function workspaceStateDir(workspaceRoot: string): string {
  return join(workspaceRoot, STATE_DIR_NAME);
}
