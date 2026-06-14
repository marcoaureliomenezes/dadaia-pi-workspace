import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { SpecContextRecord, SpecContextRegistry } from "../../core/context.js";

const EMPTY_REGISTRY: SpecContextRegistry = { schemaVersion: 1, contexts: [] };

function normalizeRegistry(value: unknown): SpecContextRegistry {
  if (!value || typeof value !== "object") return EMPTY_REGISTRY;
  if (!("contexts" in value) || !Array.isArray(value.contexts)) return EMPTY_REGISTRY;
  const contexts: SpecContextRecord[] = [];
  for (const item of value.contexts) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.name !== "string" || typeof raw.repoSlug !== "string") continue;
    contexts.push({
      name: raw.name,
      repoSlug: raw.repoSlug,
      ...(typeof raw.repoUrl === "string" && raw.repoUrl.length > 0 ? { repoUrl: raw.repoUrl } : {}),
      branch: typeof raw.branch === "string" && raw.branch.length > 0 ? raw.branch : "main",
      state: raw.state === "ALIVE" ? "ALIVE" : "DEAD",
      ...(typeof raw.aliveSince === "string" ? { aliveSince: raw.aliveSince } : {}),
      ...(typeof raw.deadSince === "string" ? { deadSince: raw.deadSince } : {}),
    });
  }
  return { schemaVersion: 1, contexts };
}

export class ContextStore {
  constructor(private readonly path: string) {}

  async load(): Promise<SpecContextRegistry> {
    try {
      const text = await readFile(this.path, "utf8");
      return normalizeRegistry(JSON.parse(text));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return EMPTY_REGISTRY;
      throw error;
    }
  }

  async save(registry: SpecContextRegistry): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
    await rename(tmp, this.path);
  }
}
