import type { WorkflowDefinition } from "./types.js";

const commonManifest = {
  kind: "manifest" as const,
  pathPattern: ".dadaia-pi/workflows/<context>/<timestamp>-<workflow>.json",
  purpose: "Machine-readable workflow run record with context, release, model, checks, SDK mode, and artifacts.",
};

const commonReport = {
  kind: "report" as const,
  pathPattern: ".dadaia-pi/reports/<context>/workflows/<timestamp>-<workflow>.md",
  purpose: "Human-readable workflow result and operator handoff.",
};

const releaseDefinitionSteps = [
  { id: "load-sources", title: "Load backlog and bugs", kind: "deterministic" as const, description: "Read backlog items, bugs, constitution, memory, and active release constraints." },
  { id: "scope-release", title: "Define release scope", kind: "sdk" as const, prompt: "release-scope", model: "planning", maxIterations: 1, description: "Use a bounded Pi SDK prompt to select coherent backlog/bug scope and non-goals." },
  { id: "draft-spec", title: "Draft SPEC", kind: "sdk" as const, prompt: "release-spec-writer", model: "product", maxIterations: 1, description: "Generate SPEC from approved scope." },
  { id: "draft-plan", title: "Draft PLAN", kind: "sdk" as const, prompt: "release-plan-writer", model: "architect", maxIterations: 1, description: "Generate architecture-aware implementation plan." },
  { id: "draft-tasks", title: "Draft grouped TASKS", kind: "sdk" as const, prompt: "release-task-writer", model: "implementation-planner", maxIterations: 1, description: "Generate task groups with explicit write sets and validation expectations." },
  { id: "spec-review-loop", title: "Review release artifacts", kind: "review" as const, prompt: "spec-plan-task-review", model: "reviewer", maxIterations: 2, requiresApproval: true, description: "Independently review SPEC/PLAN/TASKS and loop at most twice before blocking." },
  { id: "write-release", title: "Write approved release artifacts", kind: "gate" as const, requiresApproval: true, description: "Persist artifacts only when review verdict is approved with no blocking findings." },
];

const releaseImplementationSteps = [
  { id: "load-release", title: "Load approved release", kind: "deterministic" as const, description: "Read SPEC, PLAN, TASKS, memory, active task groups, and write sets." },
  { id: "group-loop", title: "Iterate task groups", kind: "deterministic" as const, maxIterations: 12, description: "For each task group, execute the TDD loop with bounded retries." },
  { id: "write-tests", title: "Create tests first", kind: "sdk" as const, prompt: "tdd-test-writer", model: "qa", maxIterations: 1, description: "Create valuable unit and scoped E2E tests from SPEC/PLAN/TASKS before production code." },
  { id: "review-tests", title: "Review tests for fidelity", kind: "review" as const, prompt: "test-fidelity-review", model: "qa-reviewer", maxIterations: 2, requiresApproval: true, description: "Block weak, shallow, or spec-mismatched tests." },
  { id: "expect-red", title: "Run tests red", kind: "gate" as const, description: "Run focused tests and record expected failures before implementation." },
  { id: "implement-code", title: "Implement code", kind: "sdk" as const, prompt: "tdd-code-implementer", model: "coder", maxIterations: 2, description: "Implement only paths covered by the group write set." },
  { id: "validate-green", title: "Run validation green", kind: "gate" as const, requiresApproval: true, description: "Run unit/E2E checks and require green validation." },
  { id: "implementation-review", title: "Review implementation", kind: "review" as const, prompt: "implementation-review", model: "code-reviewer", maxIterations: 2, requiresApproval: true, description: "Review scope, maintainability, acceptance coverage, and risks." },
  { id: "commit-group", title: "Commit task group", kind: "commit" as const, requiresApproval: true, description: "Commit exactly the reviewed task group after tests pass." },
  { id: "push-gate", title: "Architecture and security push gate", kind: "gate" as const, requiresApproval: true, description: "Require deep architecture and security review before public push." },
];

export const WORKFLOW_DEFINITIONS: readonly WorkflowDefinition[] = [
  {
    id: "backlog-definition",
    title: "Backlog definition with conflict grilling",
    phase: "BACKLOG_DEFINITION",
    activity: "ADDITIVE",
    purpose: "Convert operator demand plus existing backlog/bugs into one clear, non-conflicting backlog item before release work starts.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "load-backlog-and-bugs", description: "Existing backlog and bugs are loaded before proposing new work.", required: true },
      { name: "require-demand", description: "Operator demand must be supplied by prompt file or CLI prompt.", required: true },
    ],
    sdkStep: { name: "python-backlog-definition-orchestrator", promptRole: "Ask bounded grill-me questions, classify conflicts, and write one backlog proposal.", boundedScope: "Constitution, memory, existing backlog/bugs, and demand only.", allowedTools: ["read", "grep", "find", "ls"], expectedOutput: "Structured backlog proposal with conflicts, open questions, and approval verdict." },
    orchestration: {
      engine: "python",
      module: "backlog_definition.py",
      maxIterations: 3,
      steps: [
        { id: "load-demand", title: "Load demand", kind: "deterministic", description: "Read operator demand and existing backlog/bugs." },
        { id: "conflict-review", title: "Conflict and duplicate review", kind: "sdk", prompt: "backlog-conflict-review", model: "analyst", maxIterations: 1, description: "Find duplicate, stale, ambiguous, or conflicting backlog truth." },
        { id: "grill-me", title: "Grill-me clarification", kind: "review", prompt: "backlog-grill-me", model: "analyst", maxIterations: 2, requiresApproval: true, description: "Ask bounded clarification questions before accepting backlog." },
        { id: "write-backlog", title: "Write backlog item", kind: "gate", requiresApproval: true, description: "Emit one canonical backlog delta only after ambiguity is resolved." },
      ],
    },
    deterministicPostflight: [
      { name: "conflict-gate", description: "Block unresolved conflicts and ambiguity.", required: true },
      { name: "write-additive-evidence", description: "Emit workflow manifest/report evidence.", required: true },
    ],
    evidence: [commonManifest, commonReport, { kind: "backlog", pathPattern: "specs/backlog/<slug>.md", purpose: "Canonical backlog item." }],
  },
  {
    id: "release-definition",
    title: "Procedural release definition and spec review",
    phase: "RELEASE_DEFINITION",
    activity: "MUTATING",
    purpose: "Use backlog and bugs to define release scope, generate SPEC/PLAN/TASKS, and review them with a bounded approval loop.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "load-backlog-and-bugs", description: "Backlog and bug records are loaded as release inputs.", required: true },
      { name: "require-release", description: "Release id is required.", required: true },
    ],
    sdkStep: { name: "python-release-definition-orchestrator", promptRole: "Define release scope, write SPEC/PLAN/TASKS, review them, and stop on blocking findings.", boundedScope: "Constitution, memory, backlog, bugs, release artifacts, and bounded review loop.", allowedTools: ["read", "grep", "find", "ls", "write"], expectedOutput: "Approved or blocked release artifact bundle with review findings." },
    orchestration: { engine: "python", module: "release_definition.py", maxIterations: 2, steps: releaseDefinitionSteps },
    deterministicPostflight: [
      { name: "spec-review-gate", description: "SPEC/PLAN/TASKS must pass independent review.", required: true },
      { name: "write-release-evidence", description: "Emit release workflow evidence and artifact paths.", required: true },
    ],
    evidence: [commonManifest, commonReport, { kind: "release", pathPattern: "specs/releases/<release>/{SPEC,PLAN,TASKS}.md", purpose: "Approved release definition." }],
  },
  {
    id: "release-implementation",
    title: "TDD release implementation by task group",
    phase: "IMPLEMENTATION",
    activity: "MUTATING",
    purpose: "Implement a release only through tests-first task-group loops, review gates, validation, and commit gates.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "require-approved-release", description: "SPEC/PLAN/TASKS must be approved.", required: true },
      { name: "require-task-groups", description: "TASKS must define bounded groups with write sets.", required: true },
      { name: "acquire-lease", description: "Mutating lease must be held by the workflow session.", required: true },
    ],
    sdkStep: { name: "python-release-implementation-orchestrator", promptRole: "Run TDD: tests first, test review, red validation, code, green validation, implementation review, commit per group.", boundedScope: "Approved release artifacts, task group write sets, tests, changed paths, and validation output.", allowedTools: ["read", "grep", "find", "ls", "bash", "edit", "write"], expectedOutput: "Per-group TDD evidence, validation, review verdicts, and commit readiness." },
    orchestration: { engine: "python", module: "release_implementation.py", maxIterations: 12, steps: releaseImplementationSteps },
    deterministicPostflight: [
      { name: "tdd-evidence-gate", description: "Each group must have tests-first evidence and reviewed implementation.", required: true },
      { name: "commit-gate", description: "Each completed group must be committed before advancing.", required: true },
      { name: "push-gate-ready", description: "Architecture and security review are required before push.", required: true },
    ],
    evidence: [commonManifest, commonReport],
  },
  {
    id: "architecture-review",
    title: "Architecture review gate",
    phase: "CODE_REVIEW",
    activity: "ADDITIVE",
    purpose: "Review release candidate architecture boundaries, memory alignment, dependency rules, and maintainability before push/PR.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "collect-rc-diff", description: "Release candidate diff and changed paths are identified.", required: true },
    ],
    sdkStep: { name: "python-architecture-review", promptRole: "Review architecture consistency and current-truth memory alignment.", boundedScope: "Candidate diff, architecture memory, PLAN, and changed source paths.", allowedTools: ["read", "grep", "find", "ls", "bash"], expectedOutput: "Architecture verdict with reviewed paths and blocking findings." },
    orchestration: { engine: "python", module: "architecture_review.py", maxIterations: 1, steps: [{ id: "architecture-gate", title: "Architecture gate", kind: "review", prompt: "architecture-review", model: "architect", requiresApproval: true, description: "Approve only when boundaries, dependencies, and memory remain coherent." }] },
    deterministicPostflight: [{ name: "architecture-verdict-gate", description: "Blocks push when architecture findings are blocking.", required: true }],
    evidence: [commonManifest, commonReport, { kind: "handoff", pathPattern: ".dadaia-pi/handoff/<context>/<timestamp>-architecture-reviewer.json", purpose: "Architecture review gate evidence." }],
  },
  {
    id: "push-gate",
    title: "Public repository push gate",
    phase: "SECURITY_REVIEW",
    activity: "ADDITIVE",
    purpose: "Require deep security, architecture, QA, and commit-range evidence before public push.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "collect-rc-range", description: "All pushed commits are mapped to reviewed RC ranges.", required: true },
    ],
    sdkStep: { name: "python-push-gate", promptRole: "Verify public-push readiness and security/architecture review coverage.", boundedScope: "RC range, security findings, architecture findings, QA coverage, package resources, hooks, and secrets-sensitive paths.", allowedTools: ["read", "grep", "find", "ls", "bash"], expectedOutput: "Push readiness verdict with zero blocking findings." },
    orchestration: { engine: "python", module: "push_gate.py", maxIterations: 1, steps: [{ id: "security-public-repo", title: "Deep security review", kind: "review", prompt: "public-repo-security", model: "security", requiresApproval: true, description: "Reject secrets, trust hazards, unsafe hooks, and unreviewed sensitive changes." }, { id: "coverage-gate", title: "Review coverage gate", kind: "gate", requiresApproval: true, description: "Require QA, architecture, security, and code review coverage for every pushed commit." }] },
    deterministicPostflight: [{ name: "push-ready", description: "Approved only when all review evidence covers the pushed range.", required: true }],
    evidence: [commonManifest, commonReport],
  },
  {
    id: "backlog-intake",
    title: "Backlog intake and conflict resolution",
    phase: "BACKLOG_DEFINITION",
    activity: "ADDITIVE",
    purpose: "Turn an operator demand into one non-conflicting backlog item after grill-me clarification and existing-backlog review.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "load-backlog", description: "Existing specs/backlog entries are loaded before drafting.", required: true },
      { name: "require-demand", description: "A prompt file or operator prompt must provide the demand.", required: true },
    ],
    sdkStep: {
      name: "bounded-backlog-analyst",
      promptRole: "Ask grill-me questions, classify duplicates/conflicts, and propose a single backlog delta.",
      boundedScope: "Read constitution, memory summaries, existing backlog, and the demand only.",
      allowedTools: ["read", "grep", "find", "ls"],
      expectedOutput: "JSON-ready backlog proposal with conflicts, questions, and recommended canonical backlog item.",
    },
    deterministicPostflight: [
      { name: "conflict-gate", description: "Block when unresolved conflicts or ambiguity remain.", required: true },
      { name: "write-additive-evidence", description: "Emit manifest/report under the context evidence channels.", required: true },
    ],
    evidence: [commonManifest, commonReport, { kind: "backlog", pathPattern: "specs/backlog/<slug>.md", purpose: "Canonical backlog item after approval." }],
  },
  {
    id: "research",
    title: "Scoped source and product research",
    phase: "RESEARCH",
    activity: "ADDITIVE",
    purpose: "Produce read-only research evidence for a question, optionally comparing a source context.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "read-only-scope", description: "Research runs use read-only tools and additive report channels.", required: true },
    ],
    sdkStep: {
      name: "bounded-researcher",
      promptRole: "Inspect scoped files and synthesize findings, risks, and citations.",
      boundedScope: "Read-only context, selected memory atoms, release/backlog references, and optional source context.",
      allowedTools: ["read", "grep", "find", "ls", "bash"],
      expectedOutput: "Research report with citations, assumptions, risks, and open questions.",
    },
    deterministicPostflight: [
      { name: "citation-check", description: "Report must name inspected files or commands.", required: true },
      { name: "write-additive-evidence", description: "Emit manifest/report.", required: true },
    ],
    evidence: [commonManifest, commonReport],
  },
  {
    id: "release-define",
    title: "Release definition from clean backlog",
    phase: "RELEASE_DEFINITION",
    activity: "MUTATING",
    purpose: "Create or refine SPEC, PLAN, and TASKS from selected backlog while preventing duplicated stale backlog truth.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "require-release", description: "Release id is required.", required: true },
      { name: "load-selected-backlog", description: "Selected backlog items are loaded and checked for conflict.", required: true },
    ],
    sdkStep: {
      name: "bounded-product-steward",
      promptRole: "Draft SPEC/PLAN/TASKS and backlog consumption notes.",
      boundedScope: "Constitution, memory, selected backlog/bugs, and release template.",
      allowedTools: ["read", "grep", "find", "ls"],
      expectedOutput: "Release artifact proposal with bounded task write sets and backlog cleanup plan.",
    },
    deterministicPostflight: [
      { name: "artifact-gate", description: "SPEC/PLAN/TASKS must have required sections and bounded write sets before approval.", required: true },
      { name: "backlog-consumption-gate", description: "Approved release must mark consumed backlog stale/archived/resolved.", required: true },
    ],
    evidence: [commonManifest, commonReport, { kind: "release", pathPattern: "specs/releases/<release>/{SPEC,PLAN,TASKS}.md", purpose: "Approved release definition." }],
  },
  {
    id: "spec-review",
    title: "Independent SPEC/PLAN/TASKS review",
    phase: "SPEC_REVIEW",
    activity: "ADDITIVE",
    purpose: "Review release artifacts before implementation and block ambiguous scope, weak acceptance, or unsafe write sets.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "require-release", description: "Release id is required.", required: true },
      { name: "load-release-artifacts", description: "SPEC, PLAN, and TASKS must exist.", required: true },
    ],
    sdkStep: {
      name: "bounded-spec-reviewer",
      promptRole: "Critique release readiness and produce APPROVED, NEEDS_CHANGES, or REJECTED verdict.",
      boundedScope: "Release artifacts, constitution, relevant memory, and backlog consumption notes.",
      allowedTools: ["read", "grep", "find", "ls"],
      expectedOutput: "Structured review findings with severity, path, reason, recommendation, and verdict.",
    },
    deterministicPostflight: [
      { name: "verdict-gate", description: "Implementation remains blocked unless verdict is APPROVED.", required: true },
      { name: "write-review-evidence", description: "Emit additive review report and manifest.", required: true },
    ],
    evidence: [commonManifest, commonReport, { kind: "audit", pathPattern: "specs/audits/<timestamp>-<session>/", purpose: "Optional committed spec review evidence." }],
  },
  {
    id: "implementation-task",
    title: "Scoped implementation task",
    phase: "IMPLEMENTATION",
    activity: "MUTATING",
    purpose: "Implement exactly one reserved task with a live context lease and task write-set enforcement.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "require-release", description: "Release id is required.", required: true },
      { name: "require-reserved-task", description: "Exactly one task must be marked [-].", required: true },
      { name: "acquire-lease", description: "Mutating lease must be held by the workflow session.", required: true },
    ],
    sdkStep: {
      name: "bounded-implementer",
      promptRole: "Make the smallest code/test changes satisfying the reserved task only.",
      boundedScope: "Reserved task, its write set, relevant code, tests, and acceptance criteria.",
      allowedTools: ["read", "grep", "find", "ls", "bash", "edit", "write"],
      expectedOutput: "Implementation summary with changed paths, validation commands, and risks.",
    },
    deterministicPostflight: [
      { name: "write-set-diff-gate", description: "All changed paths must be inside the reserved task write set.", required: true },
      { name: "validation-gate", description: "Task validation commands are recorded.", required: true },
    ],
    evidence: [commonManifest, commonReport],
  },
  {
    id: "qa-review",
    title: "Release-candidate QA review",
    phase: "QA_REVIEW",
    activity: "ADDITIVE",
    purpose: "Review a commit group or release candidate against tests and acceptance criteria before candidate promotion.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "require-release", description: "Release id is required.", required: true },
      { name: "collect-rc-diff", description: "Candidate commits and changed paths are identified.", required: true },
    ],
    sdkStep: {
      name: "bounded-qa-reviewer",
      promptRole: "Compare implementation evidence with acceptance criteria and test gates.",
      boundedScope: "Release artifacts, task reports, test output, and candidate diff.",
      allowedTools: ["read", "grep", "find", "ls", "bash"],
      expectedOutput: "QA verdict with missing tests, regressions, acceptance gaps, and approval status.",
    },
    deterministicPostflight: [
      { name: "qa-verdict-gate", description: "Candidate cannot advance unless QA verdict is APPROVED.", required: true },
      { name: "handoff-schema", description: "QA approval is written as schema-compatible evidence when requested.", required: true },
    ],
    evidence: [commonManifest, commonReport, { kind: "handoff", pathPattern: ".dadaia-pi/handoff/<context>/<timestamp>-qa-reviewer.json", purpose: "Machine QA verdict for a candidate." }],
  },
  {
    id: "security-review",
    title: "Security review before push",
    phase: "SECURITY_REVIEW",
    activity: "ADDITIVE",
    purpose: "Gate push readiness by reviewing trust, package resources, hooks, secrets exposure, and security-sensitive diffs.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "collect-security-scope", description: "Commit SHA, package resources, hooks, and sensitive paths are identified.", required: true },
    ],
    sdkStep: {
      name: "bounded-security-reviewer",
      promptRole: "Assess security posture and produce an approval or blocking findings.",
      boundedScope: "Candidate diff, package resources, hooks, trust language, and secret-sensitive paths.",
      allowedTools: ["read", "grep", "find", "ls", "bash"],
      expectedOutput: "Security verdict with commit SHA, findings, and push gate decision.",
    },
    deterministicPostflight: [
      { name: "security-verdict-gate", description: "Push remains blocked unless security verdict is APPROVED for the SHA.", required: true },
      { name: "pre-push-compatible-evidence", description: "Approved SHA can be consumed by pre-push checks.", required: true },
    ],
    evidence: [commonManifest, commonReport, { kind: "handoff", pathPattern: ".dadaia-pi/handoff/<context>/<timestamp>-security-reviewer.json", purpose: "Pre-push security approval evidence." }],
  },
  {
    id: "code-review",
    title: "Code review before PR",
    phase: "CODE_REVIEW",
    activity: "ADDITIVE",
    purpose: "Gate PR readiness with maintainability, API, style, and scope review after security review.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "collect-pr-diff", description: "PR base/head and changed paths are identified.", required: true },
    ],
    sdkStep: {
      name: "bounded-code-reviewer",
      promptRole: "Review code quality, maintainability, API compatibility, and task scope.",
      boundedScope: "PR diff, release artifacts, implementation reports, QA/security evidence.",
      allowedTools: ["read", "grep", "find", "ls", "bash"],
      expectedOutput: "Code review verdict with blocking and non-blocking findings.",
    },
    deterministicPostflight: [
      { name: "code-verdict-gate", description: "PR remains blocked unless code review verdict is APPROVED.", required: true },
      { name: "write-review-evidence", description: "Emit additive report and optional handoff.", required: true },
    ],
    evidence: [commonManifest, commonReport, { kind: "handoff", pathPattern: ".dadaia-pi/handoff/<context>/<timestamp>-code-reviewer.json", purpose: "PR code review gate evidence." }],
  },
  {
    id: "release-closure",
    title: "Release closure and memory update",
    phase: "CLOSURE",
    activity: "MUTATING",
    purpose: "Close a release after tasks and reviews, update current-truth memory, and advance ACTIVE/archive state without duplicating history.",
    deterministicPreflight: [
      { name: "resolve-context", description: "Context must exist and be ALIVE.", required: true },
      { name: "require-release", description: "Release id is required.", required: true },
      { name: "all-tasks-complete", description: "Tasks must be [x] or explicitly deferred.", required: true },
      { name: "required-reviews-present", description: "QA/security/code evidence must satisfy the release matrix.", required: true },
    ],
    sdkStep: {
      name: "bounded-closure-steward",
      promptRole: "Draft closure summary and current-truth memory patch proposal.",
      boundedScope: "Release artifacts, reports, handoffs, audits, validation logs, and existing memory.",
      allowedTools: ["read", "grep", "find", "ls"],
      expectedOutput: "Closure and memory patch proposal with stale backlog/bug cleanup notes.",
    },
    deterministicPostflight: [
      { name: "memory-current-truth-gate", description: "Memory updates must describe current truth, not changelog history.", required: true },
      { name: "archive-release", description: "ACTIVE.md advances only after closure evidence is complete.", required: true },
    ],
    evidence: [commonManifest, commonReport, { kind: "release", pathPattern: "specs/releases/<release>/CLOSURE.md", purpose: "Closure record." }, { kind: "memory", pathPattern: "specs/memory/**", purpose: "Updated current product truth." }],
  },
];

export function listWorkflowDefinitions(): readonly WorkflowDefinition[] {
  return WORKFLOW_DEFINITIONS;
}

export function getWorkflowDefinition(id: string): WorkflowDefinition {
  const definition = WORKFLOW_DEFINITIONS.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown workflow: ${id}`);
  return definition;
}
