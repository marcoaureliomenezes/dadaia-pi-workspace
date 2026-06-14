import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

export interface MemoryAtomSummary {
  readonly slug: string;
  readonly path: string;
}

export interface CatalogValidationResult {
  readonly atomSlugs: readonly string[];
  readonly catalogSlugs: readonly string[];
  readonly missingFromCatalog: readonly string[];
  readonly staleInCatalog: readonly string[];
}

function frontmatterBlock(text: string): string | undefined {
  if (!text.startsWith("---\n")) return undefined;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return undefined;
  return text.slice(4, end);
}

export function parseFrontmatterValue(block: string, key: string): string | undefined {
  const line = block.split(/\r?\n/).find((candidate) => candidate.startsWith(`${key}:`));
  if (!line) return undefined;
  const raw = line.slice(key.length + 1).trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

export async function listProductAtoms(specsDir: string): Promise<MemoryAtomSummary[]> {
  const productDir = join(specsDir, "memory", "product");
  const entries = await readdir(productDir, { withFileTypes: true });
  const atoms: MemoryAtomSummary[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "index.md") continue;
    const path = join(productDir, entry.name);
    const text = await readFile(path, "utf8");
    const block = frontmatterBlock(text);
    const slug = block ? parseFrontmatterValue(block, "slug") : undefined;
    atoms.push({ slug: slug && slug.length > 0 ? slug : basename(entry.name, ".md"), path });
  }
  return atoms.sort((a, b) => a.slug.localeCompare(b.slug));
}

function collectCatalogSlugs(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : value && typeof value === "object" && "features" in value && Array.isArray(value.features)
      ? value.features
      : [];
  const slugs: string[] = [];
  for (const item of items) {
    if (item && typeof item === "object" && "slug" in item && typeof item.slug === "string") {
      slugs.push(item.slug);
    }
  }
  return slugs.sort((a, b) => a.localeCompare(b));
}

export async function validateCatalog(specsDir: string): Promise<CatalogValidationResult> {
  const atoms = await listProductAtoms(specsDir);
  const atomSlugs = atoms.map((atom) => atom.slug);
  const catalogPath = join(specsDir, "memory", "product", "catalog.json");
  const catalogText = await readFile(catalogPath, "utf8");
  const catalogSlugs = collectCatalogSlugs(JSON.parse(catalogText));
  return {
    atomSlugs,
    catalogSlugs,
    missingFromCatalog: atomSlugs.filter((slug) => !catalogSlugs.includes(slug)),
    staleInCatalog: catalogSlugs.filter((slug) => !atomSlugs.includes(slug)),
  };
}
