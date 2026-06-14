import { join } from "node:path";

import { modeRequiresRelease } from "../../core/session.js";
import { ContextService } from "../context/service.js";
import { SessionBindingService } from "../context/sessionBinding.js";
import { classifyMany, type ClassifiedPath } from "./classifier.js";
import { LeaseStore, type LeaseAcquireResult, type ProcessProbe } from "./lease.js";

export type GateDecision =
  | { readonly allow: true; readonly reason: string; readonly classifications: readonly ClassifiedPath[]; readonly lease?: LeaseAcquireResult }
  | { readonly allow: false; readonly reason: string; readonly classifications: readonly ClassifiedPath[] };

export interface GateInput {
  readonly sessionId: string;
  readonly targetPaths: readonly string[];
  readonly release?: string;
  readonly pid?: number;
}

function mostRestrictive(classifications: readonly ClassifiedPath[]): ClassifiedPath | undefined {
  const order = ["PROTECTED", "FROZEN", "MEMORY", "MUTATING", "ADDITIVE", "UNGATED"];
  return [...classifications].sort((a, b) => order.indexOf(a.pathClass) - order.indexOf(b.pathClass))[0];
}

function needsLease(classifications: readonly ClassifiedPath[]): boolean {
  return classifications.some((item) => item.pathClass === "MUTATING" || item.pathClass === "MEMORY");
}

export class GatePolicy {
  constructor(private readonly workspaceRoot: string, private readonly probe?: ProcessProbe) {}

  async evaluate(input: GateInput): Promise<GateDecision> {
    const classifications = classifyMany(this.workspaceRoot, input.targetPaths);
    const top = mostRestrictive(classifications);
    if (!top) return { allow: true, reason: "no target paths", classifications };
    if (top.pathClass === "PROTECTED") return { allow: false, reason: `protected path: ${top.relativePath}`, classifications };
    if (top.pathClass === "FROZEN") return { allow: false, reason: `frozen path: ${top.relativePath}`, classifications };
    if (top.pathClass === "ADDITIVE" || top.pathClass === "UNGATED") return { allow: true, reason: "additive or ungated path", classifications };

    const binding = await new SessionBindingService(this.workspaceRoot).read(input.sessionId);
    const mode = binding?.mode ?? "BOUND_IMPLEMENTATION";
    if (mode === "READ") return { allow: false, reason: "READ mode is non-acquiring for mutating writes", classifications };

    const contextName = top.context ?? binding?.context;
    if (!contextName) return { allow: false, reason: "cannot resolve context for mutating path", classifications };
    const context = await new ContextService(this.workspaceRoot).show(contextName);
    const release = input.release ?? binding?.release;
    if (modeRequiresRelease(mode) && !release) return { allow: false, reason: `${mode} requires release`, classifications };
    if (needsLease(classifications)) {
      const leaseInput: {
        context: string;
        release: string;
        sessionId: string;
        mode: string;
        pid?: number;
      } = {
        context: context.name,
        release: release ?? "unbound",
        sessionId: input.sessionId,
        mode,
      };
      if (input.pid !== undefined) leaseInput.pid = input.pid;
      const lease = await new LeaseStore(this.workspaceRoot, this.probe).acquire(leaseInput);
      if (lease.status === "HELD") {
        return { allow: false, reason: `context ${context.name} held by ${lease.record.sessionId}`, classifications };
      }
      return { allow: true, reason: `${lease.status.toLowerCase()} lease for ${context.name}`, classifications, lease };
    }
    return { allow: true, reason: "allowed", classifications };
  }
}

export function targetPathFromToolInput(cwd: string, toolName: string, input: unknown): string[] {
  if (!input || typeof input !== "object") return [];
  const value = input as Record<string, unknown>;
  if ((toolName === "write" || toolName === "edit" || toolName === "read") && typeof value.path === "string") {
    return [join(cwd, value.path)];
  }
  return [];
}
