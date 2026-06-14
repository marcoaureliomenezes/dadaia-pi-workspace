export type IssueSeverity = "error" | "warning";

export interface DoctorIssue {
  readonly code: string;
  readonly severity: IssueSeverity;
  readonly path: string;
  readonly message: string;
}

export interface DoctorSummary {
  readonly errors: number;
  readonly warnings: number;
}

export interface DoctorReport {
  readonly root: string;
  readonly issues: readonly DoctorIssue[];
  readonly summary: DoctorSummary;
}

export function summarizeIssues(issues: readonly DoctorIssue[]): DoctorSummary {
  return {
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
  };
}
