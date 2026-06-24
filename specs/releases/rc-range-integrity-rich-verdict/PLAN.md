---
release: rc-range-integrity-rich-verdict
status: approved
---

# PLAN - rc-range-integrity-rich-verdict

**Status:** Aprovado

1. Extend workflow verdict type, runner extraction/defaulting, report rendering, and gate checks.
2. Implement RC range membership helpers backed by git.
3. Update pre-push to select an approved security-review manifest for each pushed SHA's matching RC.
4. Extend workspace doctor with workflow/handoff/RC cross-reference checks and phase/evidence checks.
5. Add tests and update docs/memory.
6. Validate and close release.
