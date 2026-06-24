import { runWorkspaceDoctor } from "../doctor/workspaceDoctor.js";
import { workflowGovernanceStatus } from "./governance.js";
import { inspectReleaseCandidate, listReleaseCandidates } from "./releaseCandidate.js";

export interface WorkflowReadinessReport {
  readonly context: string;
  readonly release: string;
  readonly phase: string;
  readonly missingGates: readonly string[];
  readonly rcCoverage: readonly unknown[];
  readonly doctorIssues: readonly unknown[];
  readonly prePushReady: boolean;
  readonly closureReady: boolean;
  readonly score: number;
}

export async function workflowReadiness(workspaceRoot: string, context: string, release: string): Promise<WorkflowReadinessReport> {
  const status = await workflowGovernanceStatus(workspaceRoot, context, release);
  const doctor = await runWorkspaceDoctor(workspaceRoot);
  const rcs = await listReleaseCandidates(workspaceRoot, context, release);
  const rcCoverage = [];
  for (const rc of rcs) rcCoverage.push(await inspectReleaseCandidate(workspaceRoot, context, release, rc.id).catch(() => ({ id: rc.id, error: "inspect failed" })));
  const missingGates = status.gates.filter((gate) => !gate.ok).map((gate) => gate.name);
  const blockingIssues = doctor.issues.filter((issue) => issue.severity === "error");
  const prePushReady = rcs.some((rc) => rc.reviews.security.length > 0) && blockingIssues.length === 0;
  const closureReady = missingGates.length === 0 && ["CLOSURE", "ARCHIVED"].includes(status.phase) && blockingIssues.length === 0;
  const score = Math.max(0, 100 - missingGates.length * 15 - blockingIssues.length * 20 - (prePushReady ? 0 : 10));
  return { context, release, phase: status.phase, missingGates, rcCoverage, doctorIssues: doctor.issues, prePushReady, closureReady, score };
}
