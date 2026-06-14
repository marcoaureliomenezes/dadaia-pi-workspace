import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { STATE_DIR_NAME } from "../../core/workspace.js";

export interface LeaseRecord {
  readonly context: string;
  readonly release: string;
  readonly sessionId: string;
  readonly mode: string;
  readonly pid?: number;
  readonly acquiredAt: string;
  readonly heartbeat: string;
  readonly ttlSeconds: number;
}

export type LeaseAcquireResult =
  | { readonly status: "ACQUIRED" | "RENEWED" | "RECLAIMED"; readonly record: LeaseRecord }
  | { readonly status: "HELD"; readonly record: LeaseRecord };

export interface ProcessProbe {
  isAlive(pid: number): boolean;
}

export class LeaseStore {
  constructor(private readonly workspaceRoot: string, private readonly probe?: ProcessProbe) {}

  lockPath(context: string): string {
    return join(this.workspaceRoot, STATE_DIR_NAME, "states", "ctx_locks", `${context}.json`);
  }

  bySessionPath(sessionId: string): string {
    return join(this.workspaceRoot, STATE_DIR_NAME, "states", "ctx_locks", "by-session", `${sessionId}.json`);
  }

  async read(context: string): Promise<LeaseRecord | undefined> {
    try {
      return JSON.parse(await readFile(this.lockPath(context), "utf8")) as LeaseRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  isStale(record: LeaseRecord, at = new Date()): boolean {
    const heartbeat = Date.parse(record.heartbeat);
    if (Number.isNaN(heartbeat)) return true;
    const ttlExpired = at.getTime() - heartbeat > record.ttlSeconds * 1000;
    if (!ttlExpired) return false;
    if (record.pid !== undefined && this.probe?.isAlive(record.pid)) return false;
    return true;
  }

  async acquire(input: {
    readonly context: string;
    readonly release: string;
    readonly sessionId: string;
    readonly mode: string;
    readonly pid?: number;
    readonly ttlSeconds?: number;
  }): Promise<LeaseAcquireResult> {
    const existing = await this.read(input.context);
    const timestamp = new Date().toISOString();
    if (existing && existing.sessionId !== input.sessionId && !this.isStale(existing)) {
      return { status: "HELD", record: existing };
    }

    const status = existing?.sessionId === input.sessionId ? "RENEWED" : existing ? "RECLAIMED" : "ACQUIRED";
    const record: LeaseRecord = {
      context: input.context,
      release: input.release,
      sessionId: input.sessionId,
      mode: input.mode,
      ...(input.pid ? { pid: input.pid } : {}),
      acquiredAt: existing?.sessionId === input.sessionId ? existing.acquiredAt : timestamp,
      heartbeat: timestamp,
      ttlSeconds: input.ttlSeconds ?? 120,
    };
    await this.write(record);
    return { status, record };
  }

  async renewBySession(sessionId: string): Promise<LeaseRecord[]> {
    const indexPath = this.bySessionPath(sessionId);
    let contexts: string[];
    try {
      contexts = JSON.parse(await readFile(indexPath, "utf8")) as string[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const renewed: LeaseRecord[] = [];
    for (const context of contexts) {
      const record = await this.read(context);
      if (!record || record.sessionId !== sessionId) continue;
      const next = { ...record, heartbeat: new Date().toISOString() };
      await this.write(next);
      renewed.push(next);
    }
    return renewed;
  }

  private async write(record: LeaseRecord): Promise<void> {
    const path = this.lockPath(record.context);
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    await rename(tmp, path);
    const bySessionPath = this.bySessionPath(record.sessionId);
    await mkdir(dirname(bySessionPath), { recursive: true });
    const contexts = new Set<string>();
    try {
      for (const value of JSON.parse(await readFile(bySessionPath, "utf8")) as string[]) contexts.add(value);
    } catch {
      // no existing index
    }
    contexts.add(record.context);
    await writeFile(bySessionPath, `${JSON.stringify([...contexts].sort(), null, 2)}\n`, "utf8");
  }

  async release(context: string, sessionId: string): Promise<boolean> {
    const record = await this.read(context);
    if (!record || record.sessionId !== sessionId) return false;
    await rm(this.lockPath(context), { force: true });
    return true;
  }
}
