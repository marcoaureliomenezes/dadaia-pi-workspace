import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ContextService } from "../context/service.js";

export interface MemoryCatalogEntry {
  readonly slug: string;
  readonly title?: string;
  readonly tldr?: string;
  readonly path: string;
  readonly tags?: readonly string[];
}

export interface MemoryAtomDetail extends MemoryCatalogEntry {
  readonly content: string;
}

function asEntry(value: unknown): MemoryCatalogEntry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.slug !== "string" || typeof item.path !== "string") return undefined;
  return {
    slug: item.slug,
    path: item.path,
    ...(typeof item.title === "string" ? { title: item.title } : {}),
    ...(typeof item.tldr === "string" ? { tldr: item.tldr } : {}),
    ...(Array.isArray(item.tags) && item.tags.every((tag) => typeof tag === "string") ? { tags: item.tags as string[] } : {}),
  };
}

export async function specsDirForContext(root: string, contextName?: string): Promise<string> {
  if (!contextName) return join(root, "specs");
  const context = await new ContextService(root).show(contextName);
  return join(root, "repos", context.repoSlug, "specs");
}

export async function listMemoryCatalog(root: string, contextName?: string): Promise<readonly MemoryCatalogEntry[]> {
  const specsDir = await specsDirForContext(root, contextName);
  const catalogPath = join(specsDir, "memory", "product", "catalog.json");
  const value = JSON.parse(await readFile(catalogPath, "utf8")) as { features?: unknown[] };
  return (value.features ?? []).map(asEntry).filter((entry): entry is MemoryCatalogEntry => entry !== undefined);
}

export async function showMemoryAtom(root: string, slug: string, contextName?: string): Promise<MemoryAtomDetail> {
  const specsDir = await specsDirForContext(root, contextName);
  const entries = await listMemoryCatalog(root, contextName);
  const entry = entries.find((item) => item.slug === slug);
  if (!entry) throw new Error(`Memory atom not found: ${slug}`);
  const path = entry.path.startsWith("specs/") ? join(specsDir, entry.path.slice("specs/".length)) : join(specsDir, entry.path);
  return { ...entry, content: await readFile(path, "utf8") };
}
