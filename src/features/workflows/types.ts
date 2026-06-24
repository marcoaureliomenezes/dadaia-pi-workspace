export type WorkflowActivity = "ADDITIVE" | "MUTATING";

export type WorkflowPhase =
  | "BACKLOG_DEFINITION"
  | "RESEARCH"
  | "RELEASE_DEFINITION"
  | "SPEC_REVIEW"
  | "IMPLEMENTATION"
  | "QA_REVIEW"
  | "SECURITY_REVIEW"
  | "CODE_REVIEW"
  | "CLOSURE";

export interface WorkflowCheck {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
}

export interface WorkflowEvidenceChannel {
  readonly kind: "manifest" | "report" | "handoff" | "audit" | "release" | "memory" | "backlog";
  readonly pathPattern: string;
  readonly purpose: string;
}

export interface WorkflowOrchestrationStep {
  readonly id: string;
  readonly title: string;
  readonly kind: "deterministic" | "sdk" | "review" | "gate" | "commit";
  readonly prompt?: string;
  readonly model?: string;
  readonly maxIterations?: number;
  readonly requiresApproval?: boolean;
  readonly description: string;
}

export interface WorkflowOrchestration {
  readonly engine: "python";
  readonly module: string;
  readonly maxIterations: number;
  readonly steps: readonly WorkflowOrchestrationStep[];
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly title: string;
  readonly phase: WorkflowPhase;
  readonly activity: WorkflowActivity;
  readonly purpose: string;
  readonly deterministicPreflight: readonly WorkflowCheck[];
  readonly sdkStep: {
    readonly name: string;
    readonly promptRole: string;
    readonly boundedScope: string;
    readonly allowedTools: readonly string[];
    readonly expectedOutput: string;
  };
  readonly orchestration?: WorkflowOrchestration;
  readonly deterministicPostflight: readonly WorkflowCheck[];
  readonly evidence: readonly WorkflowEvidenceChannel[];
}

export type WorkflowVerdict = "APPROVED" | "NEEDS_CHANGES" | "REJECTED";
export type WorkflowRisk = "low" | "medium" | "high" | "unknown";

export interface WorkflowVerdictRecord {
  readonly value: WorkflowVerdict;
  readonly source: "cli" | "sdk-summary" | "dry-run-default";
  readonly findings: readonly string[];
  readonly blockingFindings: number;
  readonly risk: WorkflowRisk;
  readonly reviewedPaths: readonly string[];
  readonly acceptanceCoverage: readonly string[];
}

export interface WorkflowRunInput {
  readonly workflowId: string;
  readonly context: string;
  readonly release?: string;
  readonly promptFile?: string;
  readonly model?: string;
  readonly approveProjectResources?: boolean;
  readonly dryRun?: boolean;
  readonly sessionId?: string;
  readonly verdict?: WorkflowVerdict;
  readonly rcId?: string;
}

export interface WorkflowStepExecution {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly prompt?: string;
  readonly model?: string;
  readonly mode: "sdk" | "fallback" | "dry-run" | "deterministic";
  readonly accepted: boolean;
  readonly summary: string;
}

export interface WorkflowRunManifest {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly workflowId: string;
  readonly title: string;
  readonly phase: WorkflowPhase;
  readonly activity: WorkflowActivity;
  readonly context: string;
  readonly repoSlug: string;
  readonly release?: string;
  readonly promptFile?: string;
  readonly model?: string;
  readonly dryRun: boolean;
  readonly sdk: {
    readonly mode: "sdk" | "fallback" | "python";
    readonly accepted: boolean;
    readonly summary: string;
  };
  readonly orchestration?: {
    readonly engine: "python";
    readonly module: string;
    readonly steps: readonly WorkflowOrchestrationStep[];
    readonly executions?: readonly WorkflowStepExecution[];
  };
  readonly verdict: WorkflowVerdictRecord;
  readonly linkedHandoffs: readonly string[];
  readonly releaseCandidate?: {
    readonly id: string;
  };
  readonly checks: {
    readonly preflight: readonly WorkflowCheck[];
    readonly postflight: readonly WorkflowCheck[];
  };
  readonly artifacts: {
    readonly manifest: string;
    readonly report: string;
  };
  readonly createdAt: string;
}

export interface WorkflowRunResult {
  readonly manifest: WorkflowRunManifest;
  readonly reportText: string;
}
