import { join } from "node:path";

import { STATE_DIR_NAME } from "../../core/workspace.js";

export function sessionsDir(workspaceRoot: string): string {
  return join(workspaceRoot, STATE_DIR_NAME, "sessions");
}

export function sessionRecordPath(workspaceRoot: string, sessionId: string): string {
  return join(sessionsDir(workspaceRoot), `${sessionId}.json`);
}

export function runtimeDir(workspaceRoot: string): string {
  return join(sessionsDir(workspaceRoot), "runtime");
}

export function contextPointerPath(workspaceRoot: string, contextName: string): string {
  return join(runtimeDir(workspaceRoot), `${contextName}.ptr`);
}

export function sessionPointerPath(workspaceRoot: string, sessionId: string): string {
  return join(runtimeDir(workspaceRoot), `${sessionId}.ptr`);
}

export function bindEpochPath(workspaceRoot: string, contextName: string): string {
  return join(workspaceRoot, STATE_DIR_NAME, "states", "bind_epoch", contextName);
}
