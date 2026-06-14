import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_MEMORY_ATOMS = new Map<string, string>([
  [
    "architecture.md",
    frontmatter("architecture", "Architecture", "core", "Initial architecture placeholder") +
      "\n## Propósito\n\nDescribe the current system architecture.\n",
  ],
  [
    "tech-stack.md",
    frontmatter("tech-stack", "Tech Stack", "core", "Initial tech stack placeholder") +
      "\n## Propósito\n\nDescribe approved languages, runtimes, dependencies, and commands.\n",
  ],
  [
    "quality-assurance.md",
    frontmatter("quality-assurance", "Quality Assurance", "core", "Initial QA placeholder") +
      "\n## Propósito\n\nDescribe required validation evidence.\n",
  ],
]);

function frontmatter(slug: string, title: string, category: string, tldr: string): string {
  return [
    "---",
    `slug: ${slug}`,
    `title: ${title}`,
    `category: ${category}`,
    `tldr: ${JSON.stringify(tldr)}`,
    `summary: ${JSON.stringify(tldr)}`,
    "tags: []",
    "agent_tier: self-pull",
    "token_estimate: 100",
    `last_updated: ${JSON.stringify(new Date().toISOString().slice(0, 10))}`,
    "release_origin: scaffold",
    "---",
  ].join("\n");
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  try {
    await writeFile(path, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

export async function scaffoldSpecs(specsDir: string): Promise<void> {
  await mkdir(specsDir, { recursive: true });
  for (const dir of ["memory/product", "backlog", "bugs", "releases", "audits"]) {
    await mkdir(join(specsDir, dir), { recursive: true });
  }

  await writeIfMissing(
    join(specsDir, "constitution.md"),
    "---\nspecs_pattern_version: 1\n---\n\n# Constitution\n\nThis file defines permanent product law.\n",
  );
  await writeIfMissing(
    join(specsDir, "AGENTS.md"),
    "# specs/AGENTS.md\n\nFollow the active release gate before production edits.\n",
  );
  await writeIfMissing(
    join(specsDir, "releases", "ACTIVE.md"),
    "---\nrelease: bootstrap\nphase: DEFINITION\n---\n",
  );
  await writeIfMissing(join(specsDir, "backlog", "README.md"), "# Backlog\n");
  await writeIfMissing(join(specsDir, "bugs", "README.md"), "# Bugs\n");
  await writeIfMissing(join(specsDir, "audits", "README.md"), "# Audits\n");
  await writeIfMissing(join(specsDir, "releases", "README.md"), "# Releases\n");
  await writeIfMissing(join(specsDir, "memory", "AGENTS.md"), "# specs/memory/AGENTS.md\n\nMemory is current product truth.\n");

  for (const [file, content] of DEFAULT_MEMORY_ATOMS) {
    await writeIfMissing(join(specsDir, "memory", file), content);
  }

  const productIndex = frontmatter("index", "Product Catalog", "product", "Product catalog placeholder") +
    "\n## Visão atômica\n\nAdd product atoms under `specs/memory/product/`.\n";
  await writeIfMissing(join(specsDir, "memory", "product", "index.md"), productIndex);
  await writeIfMissing(join(specsDir, "memory", "product", "catalog.json"), "[]\n");
}
