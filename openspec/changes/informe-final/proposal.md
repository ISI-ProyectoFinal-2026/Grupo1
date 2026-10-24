# Proposal: Final report (informe final) with ADRs and AI benchmark evidence

Status: final (question round answered 2026-10-21).

## Intent

On 2026-11-04 the professor will review the architecture and the technology choices. The evidence for that review is the repository documentation plus the MVP demo. Today the official template is empty. The 36 decision candidates (C01–C36) have no recorded rationale. No metric backs the AI models: the POC notebook is missing, the 0.75 threshold is provisional, and moderation uses a different approach than the POC chose. Several docs no longer match the code. Success means the professor can follow every technology choice from the choice, to its ADR, to a metric or chart, to the evidence link.

## Scope

### In Scope (Phase A, due 2026-11-04)
- The ADR system in `docs/adr/`: `0000-plantilla.md`, `README.md` index, and ADRs C01–C17. C18–C36 are added in order if time allows.
- The benchmark in `backend-ia/benchmarks/`, run on the current data, with charts written to `results/`:
  - Metric functions written with Strict TDD.
  - A matching runner comparing CLIP, YOLO+CLIP and DINOv2.
  - A moderation runner comparing YOLO with 10 COCO labels against CLIP zero-shot.
- Measured quality metrics: coverage per package, Snyk before/after, e2e.
- The Phase A chapters of `docs/informe/` (see the map below).
- How the app works, end to end: scope (1.2.1), functional model with per-module user stories, step-by-step flows and sequence/state diagrams (1.2.2), and screens, palette and fonts (1.2.3). Added 2026-10-24.
- `docs-review` extended to cover `docs/informe/` and `docs/adr/`.
- Every drifted doc updated to match the code: `docs/ARQUITECTURA.md`, `README.md`, `docs/githubactions/README.md`, and any other doc found stale.

### Out of Scope / Non-goals
- **No code or model changes before the review.** If the benchmark contradicts current choices, the result is reported as a finding, with a GitHub issue. This covers three cases: CLIP beats YOLO for moderation, DINOv2 beats OpenCLIP, or the optimal threshold is not 0.75.
- Phase B sections, including `.docx` generation.
- Issues #208–#212.
- Load testing, unless issue #40 is executed first.
- Full-body pet photos. The user may add them later; the benchmark will then be re-run.

## Section map

Evidence sources: R = repo artifact, I = interview with Matías (PM), N = not available yet.

| Template section | Phase | Evidence |
|---|---|---|
| 1.1 Competitors, 1.1.3 | B | I / N |
| 1.1.4 Preliminary objectives and scope | B | R (PDD) |
| 1.2.1 Final objectives and scope | A | R (PDD, code, issues) |
| 1.2.2 Use cases, requirements, user stories, flows, tasks | A | R (PDD, issues, code) |
| 1.2.3 Screens, palette, fonts | A | R (frontend) |
| 1.2.4 Data model | A | R (`schema.prisma`, migrations) |
| 1.3.1 Programming and documentation | A | R, ADRs |
| 1.3.2 Training; 1.3.4 Manuals; 1.3.5 Implementation | B | I |
| 1.3.3 Tests | A | R (CI, coverage, e2e, Snyk #207); 1.3.3.5 is N (#40) |
| 2.1 Activities, milestones | B | R (issues) + I |
| 2.2.1 Team | A | R (`ROLES.md`) |
| 2.2.2.1–.3 Communication, progress, feedback | B | I + `WORKFLOW.md` |
| 2.2.2.4 Decisions | A | ADRs |
| 2.2.3 Configuration management | A | R (`WORKFLOW.md`, C10, CI) |
| 2.3.1 Resources; 2.3.2.1 Operational feasibility | B | I |
| 2.3.2.2 Technical feasibility | A: .1, .2, .4–.6, .11–.14, .16–.19 | ADRs, benchmark, compose/CI |
| 2.3.2.2 Technical feasibility | B: .3, .7–.10, .15 | I (volume estimates) |
| 2.3.2.3–.5 Legal, environmental, social | B | I; dataset licenses (R) |
| 2.3.2.6, 2.3.3 Costs; 2.3.4 Risks; 2.3.5 Environmental impact | B | I / N |
| 3 Conclusion | B | — |
| 4 References | A (partial) | R (libraries, datasets) |
| 5–8 Indexes | B | docx slice |
| Annexes 1–11 | B | I / R. Annex 11 is rewritten for Prisma, since the code does not use Sequelize. |

## Capabilities

### New Capabilities
- `adr-records`: ADR template, index, supersession lifecycle, and the rule that rationale comes from interviews only.
- `final-report`: the `docs/informe/` layout, mapping to the template numbering, evidence traceability, and neutral Spanish.
- `ai-model-benchmark`: reproducible matching and moderation evaluation (seed 42), with metrics, charts and a declared dataset limitation.
- `report-docx-generation` (Phase B): building the Markdown into `.docx` with the template styles.
- `docs-periodic-review`: the review also covers `docs/informe/` and `docs/adr/`.
- `docs-code-consistency`: technical docs must match the code (versions, services, CI).

### Modified Capabilities
None (`openspec/specs/` is empty).

## Approach

- **Report layout.** `docs/informe/` has one file per section group, using numbered names (for example `2-3-2-2-factibilidad-tecnica.md`, plus `anexos/`). A `README.md` records each section's phase and evidence. Charts are referenced from `backend-ia/benchmarks/results/`.
- **ADRs.** Matías answers every interview, one ADR at a time, in wave order. That includes decisions teammates made; the ADR's Responsables field still names the original authors. The benchmark comes before the wave-1 ADRs (C12–C15) so those ADRs can cite its results.
- **Benchmark.**
  - Metric functions (ROC/AUC, P/R@threshold, threshold sweep, top-k, confusion matrix, latency/RAM) are unit-tested with synthetic data.
  - Runners are tested with fake models. Real-model runs are executions, not tests.
  - The empty `screenshot` class is left out of the run, and the report says so.
- **Dataset limitation**, declared in the report and the ADRs:
  - In production, YOLOv8n detects the animal and its bounding box is cropped as a rectangle. This is not segmentation, so the background inside the box enters the embedding.
  - DogFaceNet images are already cropped to the face.
  - The benchmark therefore measures face-level re-identification, plus YOLO's detection rate on face crops.
- **Chained PRs.** Auto-chain, stacked, with at most 400 authored lines per PR.
  - Phase A, in order:
    1. Commit the existing WIP: `.claude/` hook and skill, `ROLES.md`, `.docs-review.json`, `openspec/`, benchmark dataset tooling.
    2. ADR system.
    3. Metric library.
    4. Matching runner.
    5. Moderation runner.
    6. Charts and results.
    7. Wave-0 ADRs, two PRs.
    8. Wave-1 ADRs.
    9. Report sections 2.2.x.
    10. Report section 2.3.2.2.
    11. Report sections 1.2.4, 1.3.1 and 1.3.3.
    12. Drift updates; split into two PRs if over budget.
    13. Report sections 1.2.1, 1.2.2 and 1.2.3 (functional flows). Since 2026-10-24 these go before the remaining benchmark slices.
  - Freeze on 2026-11-03.
  - Phase B: docx generation, with pandoc `--reference-doc` after a spike and a python-docx fallback. Then the remaining sections.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `docs/adr/`, `docs/informe/` | New | ADRs and report source |
| `backend-ia/benchmarks/` | New | Metrics, runners, charts, `results/`. `app/` is untouched. |
| `backend-ia/tests/` | New | Benchmark unit tests, run in CI |
| `.claude/skills/docs-review/SKILL.md` | Modified | Covers the report and the ADRs |
| `docs/ARQUITECTURA.md`, `README.md`, `docs/githubactions/README.md`, other drifted docs | Modified | Aligned with the code |
| backend, frontend | None | Coverage is measured only |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| 14 days is tight; one interviewee answers for 36 decisions | High | C01–C17 first; record unknowns as pending, never invented |
| Face-crop data does not represent production crops | High | Limitation declared; benchmark reproducible and re-run later |
| DINOv2 needs a network download (via torch.hub) | Med | Use the smallest variant; if it cannot be run, report it as "not evaluated" |
| Findings contradict current choices | Med | Finding plus issue; no code change (non-goal) |
| Coverage needs Postgres, which is not running locally | Med | Use CI run output |
| Drift updates are large | Med | Split by doc; verify each claim against code or CI |
| `docs/.git` is a stale pointer (`git -C docs` fails) | Low | Cleanup task pending user OK |
| Snyk #207 and load test #40 are still open | Med | Mark the result "No disponible" until it exists |
| Local Python is 3.13, CI uses 3.11 | Low | Record the environment in the results metadata |
| Dataset licenses (CC BY 2.0 / 4.0) | Low | Attribution via `manifest.csv` and References |

## Rollback Plan

All changes are additive docs, an isolated benchmark folder, and doc text updates. No runtime, schema, or production code changes. Revert per PR. A wrong accepted ADR is superseded, not edited.

## Dependencies

- Matías available for the interviews.
- Network access for the DINOv2 weights.
- CI output for coverage.
- PR #207 merged.
- The `openspec/config.yaml` ownership fix (done).

## Success Criteria

- [ ] Every technology in 2.3.2.2.1 links to an ADR. Every AI ADR links to at least one chart or metric, with the command that reproduces it.
- [ ] ADRs C01–C17 are accepted with rationale from interviews, or explicitly listed as pending.
- [ ] One command regenerates the benchmark results. The metric tests pass in CI. The dataset limitation is stated wherever results are cited.
- [ ] The Phase A sections are written in `docs/informe/` by 2026-11-03.
- [ ] For each module, the report answers what the user does, where the data goes, which states it passes through and what happens on failure, with every step cited against the code.
- [ ] No technical doc contradicts the code (React 19, PG 16, Node 24 CI, no Redis, no Dependabot, compose with only Postgres, 4 CI jobs).
- [ ] Every number traces to a repo artifact or command output. Gaps are marked "No disponible".
- [ ] Each PR has at most 400 authored lines. Generated files (manifest, PNG) are counted separately.

## Decisions from the question round

| # | Decision |
|---|---|
| 1 | The `.docx` is not needed on 2026-11-04; generation moves to Phase B. |
| 2 | Contradicting benchmark results become a finding plus an issue; no code or model change before the review. |
| 3 | Matías answers all interviews. Phase A covers C01–C17; C18–C36 if time allows. |
| 4 | The benchmark runs on the current face-crop data, and the limitation is declared. |
| 5 | All stale docs are updated to match the code (Phase A). |
| 6 | The `screenshot` class is excluded and the report says so; Annex 11 is rewritten for Prisma (Phase B). |
| 7 | (2026-10-24) Sections 1.2.1-1.2.3 move to Phase A and take priority over the remaining benchmark slices, because reviewers ask how the app works end to end. Functional gaps found while tracing the flows became issues #219-#226. |
