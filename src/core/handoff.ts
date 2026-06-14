export type HandoffArtifactType = "handoff" | "report" | "spec" | "plan" | "tasks" | "closure" | "memory" | "other";
export type HandoffVerdict = "APPROVED" | "REJECTED" | "NEEDS_CHANGES";

export interface HandoffRecord {
  readonly schemaVersion: 1;
  readonly context: string;
  readonly sessionId: string;
  readonly agent: string;
  readonly producedAt: string;
  readonly scope: string;
  readonly release?: string;
  readonly artifact: {
    readonly type: HandoffArtifactType;
    readonly path?: string;
    readonly sha256?: string;
  };
  readonly metrics: Record<string, unknown>;
  readonly findings: readonly unknown[];
  readonly verdict?: HandoffVerdict;
  readonly decisionsRequired?: readonly string[];
  readonly next?: Record<string, unknown>;
}

const ARTIFACT_TYPES = new Set<HandoffArtifactType>(["handoff", "report", "spec", "plan", "tasks", "closure", "memory", "other"]);
const VERDICTS = new Set<HandoffVerdict>(["APPROVED", "REJECTED", "NEEDS_CHANGES"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateHandoffRecord(value: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return ["handoff must be a JSON object"];

  if (value.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  for (const field of ["context", "sessionId", "agent", "producedAt", "scope"] as const) {
    if (!isNonEmptyString(value[field])) errors.push(`${field} must be a non-empty string`);
  }
  if (isNonEmptyString(value.producedAt) && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.producedAt)) {
    errors.push("producedAt must be an ISO UTC timestamp ending in Z");
  }

  if (!isObject(value.artifact)) {
    errors.push("artifact must be an object");
  } else {
    if (!ARTIFACT_TYPES.has(value.artifact.type as HandoffArtifactType)) errors.push("artifact.type is invalid");
    if (value.artifact.path !== undefined && !isNonEmptyString(value.artifact.path)) errors.push("artifact.path must be a non-empty string when present");
    if (value.artifact.sha256 !== undefined && (typeof value.artifact.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.artifact.sha256))) {
      errors.push("artifact.sha256 must be a lowercase 64-character hex string when present");
    }
    if (value.artifact.path !== undefined && value.artifact.sha256 === undefined) errors.push("artifact.sha256 is required when artifact.path is present");
  }

  if (!isObject(value.metrics)) errors.push("metrics must be an object");
  if (!Array.isArray(value.findings)) errors.push("findings must be an array");
  if (value.release !== undefined && !isNonEmptyString(value.release)) errors.push("release must be a non-empty string when present");
  if (value.verdict !== undefined && !VERDICTS.has(value.verdict as HandoffVerdict)) errors.push("verdict is invalid");
  if (value.decisionsRequired !== undefined && (!Array.isArray(value.decisionsRequired) || !value.decisionsRequired.every(isNonEmptyString))) {
    errors.push("decisionsRequired must be an array of non-empty strings when present");
  }
  if (value.next !== undefined && !isObject(value.next)) errors.push("next must be an object when present");

  return errors;
}
