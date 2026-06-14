import { join } from "node:path";

import { STATE_DIR_NAME } from "../../core/workspace.js";

export function contextRegistryPath(workspaceRoot: string): string {
  return join(workspaceRoot, STATE_DIR_NAME, "states", "spec_contexts.json");
}

export function reposDir(workspaceRoot: string): string {
  return join(workspaceRoot, "repos");
}

export function repoPath(workspaceRoot: string, repoSlug: string): string {
  return join(reposDir(workspaceRoot), repoSlug);
}
