import { mkdir, rm } from "node:fs/promises";

import { assertContextName, assertRepoSlug, type SpecContextRecord, type SpecContextRegistry } from "../../core/context.js";
import { git, gitOutput, pathExists } from "../../infrastructure/git/gitClient.js";
import { ContextStore } from "../../infrastructure/store/contextStore.js";
import { contextRegistryPath, repoPath, reposDir } from "./paths.js";

export interface CreateContextInput {
  readonly name: string;
  readonly repoSlug: string;
  readonly repoUrl?: string;
  readonly branch?: string;
}

export interface UpdateContextInput {
  readonly repoUrl?: string;
  readonly branch?: string;
}

function now(): string {
  return new Date().toISOString();
}

function sortRegistry(registry: SpecContextRegistry): SpecContextRegistry {
  return { ...registry, contexts: [...registry.contexts].sort((a, b) => a.name.localeCompare(b.name)) };
}

function replaceContext(registry: SpecContextRegistry, record: SpecContextRecord): SpecContextRegistry {
  return sortRegistry({
    schemaVersion: 1,
    contexts: registry.contexts.map((item) => (item.name === record.name ? record : item)),
  });
}

export class ContextService {
  private readonly store: ContextStore;

  constructor(private readonly workspaceRoot: string) {
    this.store = new ContextStore(contextRegistryPath(workspaceRoot));
  }

  async list(): Promise<readonly SpecContextRecord[]> {
    return (await this.store.load()).contexts;
  }

  async show(name: string): Promise<SpecContextRecord> {
    const found = (await this.store.load()).contexts.find((context) => context.name === name);
    if (!found) throw new Error(`Context not found: ${name}`);
    return found;
  }

  async create(input: CreateContextInput): Promise<SpecContextRecord> {
    assertContextName(input.name);
    assertRepoSlug(input.repoSlug);
    const registry = await this.store.load();
    if (registry.contexts.some((context) => context.name === input.name)) {
      throw new Error(`Context already exists: ${input.name}`);
    }
    const record: SpecContextRecord = {
      name: input.name,
      repoSlug: input.repoSlug,
      ...(input.repoUrl ? { repoUrl: input.repoUrl } : {}),
      branch: input.branch ?? "main",
      state: "DEAD",
      deadSince: now(),
    };
    await this.store.save(sortRegistry({ schemaVersion: 1, contexts: [...registry.contexts, record] }));
    return record;
  }

  async update(name: string, input: UpdateContextInput): Promise<SpecContextRecord> {
    const registry = await this.store.load();
    const current = registry.contexts.find((context) => context.name === name);
    if (!current) throw new Error(`Context not found: ${name}`);
    const updated: SpecContextRecord = {
      ...current,
      ...(input.repoUrl !== undefined ? { repoUrl: input.repoUrl } : {}),
      ...(input.branch !== undefined ? { branch: input.branch } : {}),
    };
    await this.store.save(replaceContext(registry, updated));
    return updated;
  }

  async alive(name: string): Promise<SpecContextRecord> {
    const registry = await this.store.load();
    const current = registry.contexts.find((context) => context.name === name);
    if (!current) throw new Error(`Context not found: ${name}`);
    const target = repoPath(this.workspaceRoot, current.repoSlug);
    await mkdir(reposDir(this.workspaceRoot), { recursive: true });

    let repoUrl = current.repoUrl;
    if (!(await pathExists(target))) {
      if (!repoUrl) throw new Error(`Context ${name} has no repoUrl; cannot clone`);
      const result = await git(["clone", "--branch", current.branch, repoUrl, target], this.workspaceRoot);
      if (result.code !== 0) throw new Error(result.stderr.trim() || `git clone failed for ${name}`);
    } else if (!repoUrl) {
      try {
        repoUrl = await gitOutput(["remote", "get-url", "origin"], target);
      } catch {
        repoUrl = undefined;
      }
    }

    const updated: SpecContextRecord = {
      name: current.name,
      repoSlug: current.repoSlug,
      ...(repoUrl ? { repoUrl } : {}),
      branch: current.branch,
      state: "ALIVE",
      aliveSince: now(),
    };
    await this.store.save(replaceContext(registry, updated));
    return updated;
  }

  async dead(name: string): Promise<SpecContextRecord> {
    const registry = await this.store.load();
    const current = registry.contexts.find((context) => context.name === name);
    if (!current) throw new Error(`Context not found: ${name}`);
    const target = repoPath(this.workspaceRoot, current.repoSlug);
    let repoUrl = current.repoUrl;
    if (await pathExists(target)) {
      if (!repoUrl) {
        try {
          repoUrl = await gitOutput(["remote", "get-url", "origin"], target);
        } catch {
          repoUrl = undefined;
        }
      }
      await rm(target, { recursive: true, force: true });
    }
    const updated: SpecContextRecord = {
      name: current.name,
      repoSlug: current.repoSlug,
      ...(repoUrl ? { repoUrl } : {}),
      branch: current.branch,
      state: "DEAD",
      deadSince: now(),
    };
    await this.store.save(replaceContext(registry, updated));
    return updated;
  }
}
