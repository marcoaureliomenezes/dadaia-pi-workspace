import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { run } from "../src/cli/main.js";
import { listMemoryCatalog, showMemoryAtom } from "../src/features/memory/index.js";

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dadaia-pi-memory-"));
  const dir = join(root, "specs", "memory", "product");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "catalog.json"), JSON.stringify({ features: [{ slug: "alpha", title: "Alpha", tldr: "First", path: "specs/memory/product/alpha.md", tags: ["a"] }] }), "utf8");
  await writeFile(join(dir, "alpha.md"), "---\nslug: alpha\ntitle: Alpha\n---\n\n# Alpha\n", "utf8");
  return root;
}

describe("memory CLI", () => {
  it("lists and shows memory atoms", async () => {
    const root = await fixture();
    const list = await listMemoryCatalog(root);
    assert.equal(list[0]?.slug, "alpha");
    assert.match((await showMemoryAtom(root, "alpha")).content, /# Alpha/);
    assert.equal(await run(["memory", "list", "--json"], root), 0);
    assert.equal(await run(["memory", "show", "alpha"], root), 0);
  });
});
