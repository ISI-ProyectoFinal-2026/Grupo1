# Delta for docs-periodic-review

Applies to `.claude/skills/docs-review/SKILL.md`. The change that implements it is the only one allowed to modify `.claude/` for this purpose.

## ADDED Requirements

### Requirement: Review covers the report and the ADRs

The skill's procedure MUST name `docs/informe/` and `docs/adr/` as review targets, alongside `docs/ARQUITECTURA.md`. When code or CI changes since `lastCommit` affect a fact cited in the report (versions, CI jobs, coverage, benchmark results), the review MUST list the affected report sections.

#### Scenario: Dependency change
- GIVEN a package version changed since `lastCommit`
- WHEN the review runs
- THEN it flags each `docs/informe/` section and ADR that cites that version

### Requirement: ADR rules carry over

The review MUST NOT edit an accepted ADR; a changed decision becomes a new ADR and the old Estado becomes `Reemplazada por ADR-XXXX`. For an unrecorded decision it MUST ask for the reason one question at a time, showing the evidence, and MUST NOT invent it.

#### Scenario: No answer
- GIVEN the user gives no reason for a detected decision
- WHEN the review ends
- THEN the decision is listed as pending in the summary and no ADR is created

### Requirement: Index and state updated

After a review, `docs/adr/README.md` MUST match the ADR files, and `docs/.docs-review.json` MUST record today's date and the HEAD SHA. The review MUST NOT commit without user authorization.

#### Scenario: Review completes
- GIVEN the review finished
- WHEN the state file is read
- THEN `lastReview` is today and `lastCommit` is HEAD
