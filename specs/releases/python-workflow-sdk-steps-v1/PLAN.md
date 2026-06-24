# PLAN - python-workflow-sdk-steps-v1

**Status:** Aprovado

## Approach

1. Extend Python workflow common module with step execution loop.
2. Add Node bridge callable from Python that imports Pi SDK and runs one prompt/model step.
3. Return deterministic fallback step results when SDK is unavailable or dry-run is true.
4. Extend TypeScript runner/manifest types to include step executions.
5. Update report rendering and tests.
