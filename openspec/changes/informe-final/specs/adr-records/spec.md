# Delta for adr-records

ADRs live in `docs/adr/`, are written in Spanish, and follow `docs/adr/0000-plantilla.md`.

## ADDED Requirements

### Requirement: Template and index

`docs/adr/0000-plantilla.md` MUST define these fields, in this order: Estado, Responsables, Decisión, Motivo, Alternativas, Consecuencias, Referencias. Estado is `Aceptada`, `Pendiente` or `Reemplazada por ADR-XXXX`. `docs/adr/README.md` MUST list every ADR with number, title, Estado, Responsables, C-ID and supersession links, and MUST be updated in the same change that adds or changes an ADR.

#### Scenario: Index matches the folder
- GIVEN ADR files exist in `docs/adr/`
- WHEN the index is read
- THEN every `NNNN-*.md` file (except the template) has exactly one row, with the file's Estado and Responsables

#### Scenario: Index row missing
- GIVEN a new ADR file with no row in the index
- WHEN the change is reviewed
- THEN the change is incomplete and MUST NOT be merged

### Requirement: Short ADR format

An ADR MUST stay short: Decisión in 1-2 lines, Motivo in 2-4 bullets, Alternativas in 1 line (optional), Consecuencias in 1-3 bullets, Referencias in 1 line. The body MUST NOT contain dates, file names or code, unless they are the decision itself. There is no Fecha, Contexto or "Evidencia y métricas" section.

#### Scenario: Condensed approved text
- GIVEN an approved interview wording longer than the format allows
- WHEN the ADR is written
- THEN it is condensed to the format with the same meaning and no reason that is absent from the interview

#### Scenario: Chain of decisions
- GIVEN a decision that changed over time (for example C10 or C11)
- WHEN the ADR is written
- THEN it is a single ADR and the history is folded into Motivo and Consecuencias

### Requirement: Numbering and scope

ADR numbers are fixed: C01-C17 are ADR-0001 to ADR-0017, and CX01 (technology evolution criterion) is ADR-0018. C18-C36 follow from ADR-0019, only after, in order. By 2026-11-03 each of C01-C17 MUST be either `Aceptada` or listed in the index as `Pendiente`.

#### Scenario: Phase A coverage
- GIVEN the Phase A freeze date
- WHEN the index is read
- THEN C01-C17 and CX01 each appear as `Aceptada` or `Pendiente`, with no gaps in numbering

#### Scenario: Optional decisions
- GIVEN C18-C36 have no interview yet
- WHEN Phase A closes
- THEN they MAY be absent, and no placeholder ADR is created for them

### Requirement: Immutability and supersession

An ADR with Estado `Aceptada` MUST NOT be edited, except that its Estado changes to `Reemplazada por ADR-XXXX` when a new ADR supersedes it. A changed decision MUST be a new ADR that links to the old one.

#### Scenario: Decision changes
- GIVEN accepted ADR-0005
- WHEN the team changes that decision
- THEN a new ADR is created that references ADR-0005, and ADR-0005 changes only its Estado line

#### Scenario: Edit attempt on an accepted ADR
- GIVEN accepted ADR-0005
- WHEN a diff changes its Decisión, Motivo or Consecuencias
- THEN the change MUST be rejected in review

### Requirement: Responsables credit the decision author

Responsables MUST name the teammate(s) who made the decision, taken from repository evidence (PR author, commit author, POC owner), even when Matías provided the interview answers. Where a decision changed hands (for example C13, GV then AD), all authors in the chain MUST be listed.

#### Scenario: Interviewee is not the author
- GIVEN C08 (Cloudflare R2) was implemented in PR #54 by Agustín Díaz
- WHEN Matías answers the C08 interview
- THEN Responsables for the C08 ADR names Agustín Díaz, not only Matías

### Requirement: Rationale only from the interview

Motivo MUST come from the user's interview answers or from a documented POC. Reasons MUST NOT be inferred or invented. When the original reason was not documented, Motivo MUST say so and MAY record a later technical validation that the user approved. A divergence between a POC and the code (for example C14, C15, C17) MUST state both sides and the reason given in the interview.

#### Scenario: Answered interview
- GIVEN the user answered the C15 question
- WHEN the ADR is written
- THEN the reason is attributed to the interview and the POC-versus-code divergence is stated

#### Scenario: Unanswered or unknown
- GIVEN the user did not answer, or said the reason is unknown
- WHEN the ADR is written
- THEN Motivo reads `Pendiente de entrevista`, Estado is not `Aceptada`, and the index lists it as `Pendiente`

#### Scenario: Unevidenced technology
- GIVEN DINOv2 has no trace in code, docs, issues or PRs
- WHEN ADR C12 is written
- THEN DINOv2 appears only as the user stated it, or as a benchmark candidate, never as a past decision

### Requirement: Referencias

Each ADR MUST end with a one-line Referencias. An AI ADR (C12-C15) MUST link at least one result file or PNG in `backend-ia/benchmarks/results/` and `backend-ia/benchmarks/README.md` for the reproduction command. Any other ADR MUST link to repository evidence (PR, issue, commit or file path). Issues created for debts or findings are cited by number.

#### Scenario: AI ADR
- GIVEN the ADR for C14 (matching parameters)
- WHEN it is read
- THEN Referencias links a results file or chart from `backend-ia/benchmarks/results/` and `backend-ia/benchmarks/README.md`

#### Scenario: Benchmark not yet run
- GIVEN results do not exist yet
- WHEN an AI ADR is drafted
- THEN Referencias says `No disponible` and the ADR is not marked `Aceptada` until the link exists
