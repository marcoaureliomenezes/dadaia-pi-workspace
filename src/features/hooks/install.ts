import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type HookName = "pre-commit" | "pre-push";

const HOOK_COMMANDS: Record<HookName, string> = {
  "pre-commit": "dadaia-pi hooks pre-commit-check",
  "pre-push": "dadaia-pi hooks pre-push-check",
};

export function hookPath(repoRoot: string, hook: HookName): string {
  return join(repoRoot, ".git", "hooks", hook);
}

export function hookScript(command: string): string {
  return `#!/bin/sh\n# Installed by dadaia-pi-workspace.\nexec ${command}\n`;
}

export async function installHook(repoRoot: string, hook: HookName): Promise<string> {
  const path = hookPath(repoRoot, hook);
  await mkdir(join(repoRoot, ".git", "hooks"), { recursive: true });
  await writeFile(path, hookScript(HOOK_COMMANDS[hook]), "utf8");
  await chmod(path, 0o755);
  return path;
}

export async function uninstallHook(repoRoot: string, hook: HookName): Promise<void> {
  await rm(hookPath(repoRoot, hook), { force: true });
}

export async function installAllHooks(repoRoot: string): Promise<string[]> {
  return Promise.all([installHook(repoRoot, "pre-commit"), installHook(repoRoot, "pre-push")]);
}

export async function uninstallAllHooks(repoRoot: string): Promise<void> {
  await Promise.all([uninstallHook(repoRoot, "pre-commit"), uninstallHook(repoRoot, "pre-push")]);
}
