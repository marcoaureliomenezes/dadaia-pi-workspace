# SPEC - python-workflow-sdk-steps-v1

**Status:** Aprovado

## Problem

Python workflow modules currently expose procedural workflow steps and model aliases, but they do not actually invoke Pi SDK per step. The workflow engine must execute each SDK/review step with its prompt/model descriptor and record step results.

## Scope

- Add a Python-to-Pi-SDK execution bridge for workflow steps.
- Execute SDK/review steps sequentially from Python workflow modules.
- Preserve deterministic fallback for offline/dry-run execution.
- Record per-step status, prompt, model alias, accepted flag, and summaries in workflow output/manifests.
- Show model aliases and step execution details in panel/report evidence.

## Acceptance Criteria

- `workflow run release-implementation` records per-step executions for SDK/review steps.
- Python workflow modules invoke a Pi SDK bridge for each SDK/review step unless dry-run/fallback is active.
- Model aliases from workflow definitions are passed to the bridge.
- Step summaries are visible in workflow report output.
- Tests cover per-step execution records.
