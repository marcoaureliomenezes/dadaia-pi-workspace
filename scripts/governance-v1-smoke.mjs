#!/usr/bin/env node
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const repo = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repo, "dist", "src", "cli", "main.js");
const root = await mkdtemp(join(tmpdir(), "dadaia-governance-v1-smoke-"));
const demo = join(root, "repos", "demo");
const release = "smoke-governance-v1";

function run(args, cwd = root) {
  process.stdout.write(`$ dadaia-pi ${args.join(" ")}\n`);
  execFileSync(process.execPath, [cli, ...args], { cwd, stdio: "inherit", env: { ...process.env, DADAIA_PI_SESSION_ID: "smoke-session" } });
}

function git(args, cwd = demo) {
  execFileSync("git", args, { cwd, stdio: "inherit" });
}

await mkdir(join(demo, "specs", "releases", release), { recursive: true });
await mkdir(join(demo, "specs", "memory", "product"), { recursive: true });
await mkdir(join(demo, "src"), { recursive: true });
await writeFile(join(demo, "specs", "constitution.md"), "# Constitution\n", "utf8");
await writeFile(join(demo, "specs", "memory", "tech-stack.md"), "# Tech\n", "utf8");
await writeFile(join(demo, "specs", "memory", "product", "catalog.json"), "[]\n", "utf8");
await writeFile(join(demo, "specs", "releases", "ACTIVE.md"), `---\nrelease: ${release}\nphase: IMPLEMENTATION\n---\n`, "utf8");
await writeFile(join(demo, "specs", "releases", release, "SPEC.md"), "# SPEC\n\n**Status:** Aprovado\n", "utf8");
await writeFile(join(demo, "specs", "releases", release, "PLAN.md"), "# PLAN\n\n**Status:** Aprovado\n", "utf8");
await writeFile(join(demo, "specs", "releases", release, "TASKS.md"), "# TASKS\n\n**Status:** Aprovado\n\n- [-] T-001 Smoke\n  - Write set: `src/**`, `specs/releases/smoke-governance-v1/**`\n", "utf8");
await writeFile(join(demo, "src", "index.ts"), "export const smoke = true;\n", "utf8");

git(["init", "--initial-branch", "main"]);
git(["config", "user.email", "smoke@example.com"]);
git(["config", "user.name", "Smoke"]);
git(["add", "."]);
git(["commit", "-m", "smoke base"]);
await writeFile(join(demo, "src", "index.ts"), "export const smoke = 'changed';\n", "utf8");
git(["add", "."]);
git(["commit", "-m", "smoke change"]);

run(["context", "create", "demo", "--repo", "demo"]);
run(["context", "alive", "demo"]);
run(["context", "bind", "demo", "--session-id", "smoke-session", "--mode", "implementation", "--release", release]);
run(["workflow", "run", "spec-review", "--context", "demo", "--release", release, "--dry-run", "--verdict", "APPROVED"]);
run(["workflow", "run", "implementation-task", "--context", "demo", "--release", release, "--dry-run", "--verdict", "APPROVED"]);
run(["workflow", "advance", "--context", "demo", "--release", release, "--to", "QA_REVIEW"]);
run(["workflow", "rc", "create", "--context", "demo", "--release", release, "--rc-id", "rc-1", "--from", "HEAD~1", "--to", "HEAD"]);
run(["workflow", "run", "qa-review", "--context", "demo", "--release", release, "--rc-id", "rc-1", "--dry-run", "--verdict", "APPROVED"]);
run(["workflow", "advance", "--context", "demo", "--release", release, "--to", "SECURITY_REVIEW"]);
run(["workflow", "run", "security-review", "--context", "demo", "--release", release, "--rc-id", "rc-1", "--dry-run", "--verdict", "APPROVED"]);
run(["workflow", "advance", "--context", "demo", "--release", release, "--to", "CODE_REVIEW"]);
run(["workflow", "run", "code-review", "--context", "demo", "--release", release, "--rc-id", "rc-1", "--dry-run", "--verdict", "APPROVED"]);
await writeFile(join(demo, "specs", "releases", release, "TASKS.md"), "# TASKS\n\n**Status:** Aprovado\n\n- [x] T-001 Smoke\n  - Write set: `src/**`, `specs/releases/smoke-governance-v1/**`\n", "utf8");
run(["workflow", "readiness", "--context", "demo", "--release", release]);
run(["workflow", "evidence", "bundle", "--context", "demo", "--release", release]);
await writeFile(join(demo, "specs", "releases", release, "CLOSURE.md"), "# Closure\n\nMemory updates performed.\n", "utf8");
run(["workflow", "advance", "--context", "demo", "--release", release, "--to", "CLOSURE"]);
run(["workflow", "run", "release-closure", "--context", "demo", "--release", release, "--dry-run", "--verdict", "APPROVED"]);
run(["workflow", "advance", "--context", "demo", "--release", release, "--to", "ARCHIVED"]);
run(["doctor", "--json"]);
process.stdout.write(`governance v1 smoke ok: ${root}\n`);
