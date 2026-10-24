# Delta for final-report

Source: `docs/informe/` (Markdown). Template: `docs/Template Presentacion Final (1).docx`. Phase A freeze: 2026-11-03.

## ADDED Requirements

### Requirement: Layout mirrors the template

`docs/informe/` MUST contain one Markdown file per section group, named with the template numbering (for example `2-3-2-2-factibilidad-tecnica.md`), plus `anexos/`. Headings MUST keep the template's numbers and titles. `docs/informe/README.md` MUST list every section with its phase (A or B) and its evidence source (repository, interview, or not available).

#### Scenario: Section lookup
- GIVEN a template section number
- WHEN the README table is read
- THEN it gives the file, the phase and the evidence source for that section

#### Scenario: Heading fidelity
- GIVEN a Phase A file
- WHEN its headings are compared with the template outline
- THEN numbers and titles match

### Requirement: Phase A content

By 2026-11-03 these sections MUST be written: 1.2.4, 1.3.1, 1.3.3 (except 1.3.3.5), 2.2.1, 2.2.2.4, 2.2.3, 2.3.2.2 (.1, .2, .4–.6, .11–.14, .16–.19), and the partial section 4. Phase B sections MUST NOT block Phase A and MUST NOT contain invented content.

#### Scenario: Phase B section
- GIVEN section 2.3.4 (Riesgos) is Phase B
- WHEN the README is read
- THEN it is marked Phase B and its file is absent or holds only a marker

### Requirement: Claim traceability

Every factual claim and number MUST cite a repository artifact: code path, CI run or workflow, PR or issue, `manifest.csv`, an ADR, or a benchmark result file. A claim from an interview MUST be marked as such.

#### Scenario: Cited number
- GIVEN a coverage percentage in section 1.3.3
- WHEN a reviewer follows its citation
- THEN it resolves to a CI run output or a command that reproduces it

#### Scenario: Uncitable claim
- GIVEN a claim with no artifact and no interview source
- WHEN the section is reviewed
- THEN the claim is removed or replaced with `No disponible`

### Requirement: Unavailable data

Data that does not exist yet MUST appear as `No disponible`, with the reason or tracking issue. This applies at least to Snyk before/after (until #207 is merged) and load tests 1.3.3.5 (issue #40). Estimates MUST NOT be written as measurements.

#### Scenario: Snyk pending
- GIVEN PR #207 is not merged
- WHEN the Snyk comparison is written
- THEN it reads `No disponible` and cites #207

### Requirement: Technology-to-evidence chain

Each technology listed in 2.3.2.2.1 MUST link to its ADR. An AI technology MUST also link to a benchmark chart or metric and the command that reproduces it. Wherever benchmark results are cited, the dataset limitation (face crops, empty `screenshot` class) MUST be stated.

#### Scenario: Chain complete
- GIVEN OpenCLIP is listed in 2.3.2.2.1
- WHEN a reader follows its link
- THEN they reach the ADR, then a results chart, then the reproduction command

#### Scenario: ADR pending
- GIVEN the ADR for a listed technology is `Pendiente`
- WHEN the section is written
- THEN the technology is listed with the link and the word `Pendiente`

### Requirement: Source-derived sections

Section 2.2.1 MUST derive from `docs/equipo/ROLES.md`; 2.2.2.4 from the ADR index; 2.2.3 from `docs/WORKFLOW.md`, ADR C10 and the CI workflows; 1.2.4 from `schema.prisma` and the migrations; 4 from libraries and from datasets with their licenses in `manifest.csv`.

#### Scenario: Data model
- GIVEN `schema.prisma` has a model not in section 1.2.4
- WHEN the section is reviewed
- THEN the section is out of date and MUST be corrected

### Requirement: Language

Report text MUST be neutral, professional Spanish. Code identifiers, commands and paths remain as written in the repository.

#### Scenario: Register check
- GIVEN any `docs/informe/` file
- WHEN it is read
- THEN prose is Spanish, with no regional slang

### Requirement: Annex 11 and docx deferral

Annex 11 MUST be rewritten for Prisma in Phase B. A `.docx` file is NOT required for 2026-11-04.

#### Scenario: Phase A acceptance
- GIVEN the Phase A freeze
- WHEN acceptance is checked
- THEN it passes without any `.docx` file
