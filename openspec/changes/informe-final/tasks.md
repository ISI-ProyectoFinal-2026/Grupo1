# Tasks: informe-final (Phase A, freeze 2026-11-03, review 2026-11-04)

> Size note: the SDD 530-word cap is not met on purpose. 14 PR slices with TDD steps, gates and verification need more room. Each task is still 1 line.
> Conventions: `PY` = `backend-ia\.venv\Scripts\python.exe`, run from `backend-ia/`. Doc checks use `rg`/`fd`. `[HUMAN]` = needs the user. One writer at a time: "parallel" means independent in the graph, not simultaneous writers.

## Review budget rule (approved by the user, 2026-10-22)

| Slice type | Max authored lines | What counts |
|---|---|---|
| `code` | 400 | benchmark Python, tests, scripts |
| `docs` | 800 | ADRs, `docs/informe/`, docs-consistency updates, WORKFLOW.md, openspec planning docs, issue/notebook housekeeping |

- Authored = additions plus deletions. Generated files (manifest, PNG, results, `.docx` template, notebook JSON) are counted separately.
- A slice that contains any code follows the 400 limit. Docs-only slices follow 800.
- If a slice goes over its limit during apply, split it along its sub-bullets. No size exceptions are planned.
- `openspec/config.yaml` `rules.tasks` and `review_budget_docs_lines` record this rule.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~6,800 authored: ~2,700 code in 8 PRs (avg ~340) and ~4,100 docs in 6 PRs (avg ~680). Generated files are extra |
| 400-line budget risk | Medium. Code slices 04, 06, 07, 08, 10 are at 360-390 of 400. Docs slices 01 and 02 are at ~740-750 of 800. |
| Chained PRs recommended | Yes |
| Suggested split | 14 PR slices (01-14) plus the no-PR issue gate (00) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

- Every PR merges to main in order, and the author merges after approval. Rebase each child on main after its parent merges.
- The openspec planning docs (~1,630 lines with this file) do not fit in one 800-line PR. They are spread over slices 01, 02 and 12.
- Critical path: 03, 04, 06, 07, 08/09, 10, 11, 14. Slice 14 (real run, AI ADRs, report 2.3.2.2) is last and the largest risk.

## Slice map

| # | Branch (`matias/informe-final/`) | Type | Title | Est. lines | Depends on | Target |
|---|---|---|---|---|---|---|
| 00 | no PR | gate | Issue gate | 0 | none | 10-22 |
| 01 | `01-baseline-specs-scaffold` | docs | Tooling, specs, ADR and report scaffold | ~740 | none | 10-22 |
| 02 | `02-planning-interviews` | docs | Proposal, design, explore, interviews, issue drafts | ~750 | 00, 01 | 10-23 |
| 03 | `03-dataset-tooling-loader` | code | Dataset download tooling + manifest loader | ~355 | none | 10-23 |
| 04 | `04-metrics-core-profiling` | code | Metrics core + profiling | ~360 | 03 | 10-24 |
| 05 | `05-adr-wave0-data-tests` | docs | ADRs C01-C11, C16, C17, CX01 + WORKFLOW + report 1.2.4, 1.3.1, 1.3.3 | ~645 | 00, 01, 02 | 10-25 |
| 06 | `06-metrics-stats-provenance` | code | Metrics stats + provenance | ~370 | 04 | 10-25 |
| 07 | `07-model-adapters` | code | Embedders + moderators + label guard | ~380 | 03, 06 | 10-26 |
| 08 | `08-run-matching` | code | Matching runner + threshold guard | ~380 | 04, 06, 07 | 10-27 |
| 09 | `09-run-moderation` | code | Moderation runner | ~290 | 04, 06, 07 | 10-27 |
| 10 | `10-plots-findings` | code | Plots + findings/decision rule | ~390 | 08, 09 | 10-28 |
| 11 | `11-run-all` | code | run_all orchestrator | ~180 | 10 | 10-28 |
| 12 | `12-informe-2-2-outline-tasks` | docs | Report 2.2.x + outline + tasks.md | ~710 | 02, 05 | 10-29 |
| 13 | `13-drift-references-evidence` | docs | Drift fixes + report section 4 + POC notebooks | ~600 | 01, 03, 05 | 10-30 |
| 14 | `14-results-ai-adrs-informe-2-3-2-2` | docs | Benchmark results + AI ADRs C12-C15 + report 2.3.2.2 + freeze check | ~640 + generated | 05, 11, 13 | 11-02 |
| 15G | no PR | gate | Functional-gap issue gate | 0 | none | 10-24 |
| 16 | `16-informe-1-2-2-flows` | docs | Report 1.2.2.2 user stories + end-to-end flows per module, 1.2.2.3 tasks | ~800 | 15G | 10-26 |
| 15 | `15-informe-1-2-1-1-2-2-1` | docs | Report 1.2.1 scope + 1.2.2.1 use cases and requirements | ~600 | 15G | 10-27 |
| 17 | `17-informe-1-2-3-screens` | docs | Report 1.2.3 palette, fonts, screens | ~400 + generated | 16 | 10-28 |

**Reorder (2026-10-24, approved by the user):** reviewers ask how the app works end to end, so 15G → 16 → 15 → 17 go first. Slices 10 and 11 are interleaved while a docs slice waits for review. 12 and 13 follow, then 14, keeping the 14.6 fallback if the benchmark is not closed by 10-29.

Independent branches: (03, 04, 06, 07, 08, 09, 10, 11) / (01, 02, 05, 12) / (13). Work them in number order. 05, 12 and 13 can be interleaved with the code chain whenever a code PR waits for review.

## Slice 00: Issue gate `[HUMAN]` (no PR) - DONE 2026-10-22 (#213-#218)

- [x] 00.1 `[HUMAN]` Present the 6 drafts in `openspec/changes/informe-final/issue-drafts.md`. The user approves or edits each one.
- [x] 00.2 Create the approved issues with `gh issue create`, using the suggested labels.
- [x] 00.3 Write the issue numbers back into `issue-drafts.md`. ADRs cite them before they become Aceptada, because an accepted ADR cannot be edited later.
- Verify: `gh issue list --search "in:title Prisma OR event loop OR Nominatim"` shows the new issues.

## Slice 01 (docs, ~740 planned, 890 actual): Tooling, specs, scaffold - DONE 2026-10-22
Verify: `git ls-files .claude docs/equipo docs/adr docs/informe openspec/specs openspec/config.yaml`; `fd . docs/adr docs/informe -e md`. Harness: `node .claude/hooks/docs-review-check.mjs` exits 0, plus a readback of the SKILL procedure for the "Dependency change" scenario. Rollback: revert the PR (new files plus one SKILL hunk).

- [x] 01.1 Commit `.claude/{CLAUDE.md,PROYECTO_REGLAS.md,settings.json,hooks/,skills/docs-review/}`. Do NOT add `.claude/settings.local.json`.
- [x] 01.2 Commit `docs/equipo/ROLES.md`, `docs/.docs-review.json`, and the template `docs/Template Presentacion Final (1).docx` (binary, counted separately).
- [x] 01.3 Commit `openspec/config.yaml` with the differentiated budget (done in this change) and `openspec/changes/informe-final/specs/*`.
- [x] 01.4 Amend the specs first (the approved facts):
  - `specs/adr-records/spec.md`: Estado, Responsables, Decisión, Motivo, Alternativas, Consecuencias, Referencias. Drop Fecha, Contexto and the "Evidencia y métricas" section. An AI ADR's Referencias line must link a result file or PNG plus `benchmarks/README.md` for the command.
  - `specs/ai-model-benchmark/spec.md`: add TAR@FAR=1%, EER, bootstrap CI, model size, per-subclass false-accept rate, balanced accuracy, and the approved decision rule.
- [x] 01.5 `docs/adr/0000-plantilla.md` (Spanish): Estado, Responsables, Decisión (1-2 lines), Motivo (2-4 bullets), Alternativas (1 line, optional), Consecuencias (1-3 bullets), Referencias (1 line). No dates in the body.
- [x] 01.6 `docs/adr/README.md`: quick path plus a table `ADR | Título | Estado | Responsables | C-ID | Reemplaza/Reemplazada por`. A "Pendientes" list holds C12 and C15 until slice 14.
- [x] 01.7 `docs/informe/README.md`: section table (phase A/B, evidence R/I/N), front-matter convention (`seccion, titulo, nivel, fase, estado, actualizado`), figure/table registry seeded (D5).
- [x] 01.8 `.claude/skills/docs-review/SKILL.md`: add `docs/informe/` and `docs/adr/` as targets; ADR rules; flag report sections whose ADR is superseded, or whose `app/ml/`, threshold or `benchmarks/` sources changed since `lastCommit`. The hook is unchanged.

## Slice 02 (docs, ~750 planned, 884 actual): Planning artifacts and interviews - DONE 2026-10-22
Verify: `fd . openspec/changes/informe-final -e md`. Harness: N/A (planning docs). Rollback: delete those files.

- [x] 02.1 Update `design.md`: numbering C01-C17 = ADR-0001..0017 and CX01 = ADR-0018 (the chain-split rationale of D1 is gone, since D2 keeps one ADR per chain); D11 resolved; the template section replaced by the approved format; the benchmark decision rule and extra metrics.
- [x] 02.2 Mark in `interviews.md` that Phase A interviews are done (C12, C15 pending benchmark). Record the issue numbers from 00.3 in `issue-drafts.md`.
- [x] 02.3 Commit `proposal.md`, `design.md`, `explore.md`, `interviews.md`, `issue-drafts.md`.

## Slice 03 (code, ~355 planned, 594 actual): Dataset tooling and loader (Strict TDD) - DONE 2026-10-22
Verify: `PY -m pytest tests/benchmarks/test_dataset.py -q`; `rg -c "." backend-ia/benchmarks/datasets/manifest.csv` returns 760. Harness: `PY -m benchmarks.dataset` prints counts per class from the real manifest (759 + 20 manual, `screenshot` excluded). Rollback: delete `backend-ia/benchmarks/` and `tests/benchmarks/`.

- [x] 03.1 Commit `backend-ia/benchmarks/{download_datasets.py,.gitignore}`, `datasets/.gitignore`, `.gitkeep` files, and `datasets/manifest.csv` (generated). `.cache/` and the images stay ignored.
- [x] 03.2 RED `backend-ia/tests/benchmarks/test_dataset.py` (`tmp_path`): sorted, manifest-driven, excludes `no_animal/screenshot`, and fails BEFORE running when a file is missing (dataset-missing scenario).
- [x] 03.3 GREEN `backend-ia/benchmarks/{__init__.py,dataset.py}`. REFACTOR.

## Slice 04 (code, ~360 planned, 478 actual): Metrics core + profiling (Strict TDD) - DONE 2026-10-22
Verify: `PY -m pytest tests/benchmarks/test_metrics_core.py tests/benchmarks/test_profiling.py -q`. Harness: N/A (pure numpy plus a patched psutil). Rollback: delete `metrics.py`, `profiling.py` and their tests.

- [x] 04.1 RED `test_metrics_core.py` with hand-computed values:
  - separable scores give AUC 1.0, reversed 0.0, ties 0.5
  - `auc` raises `ValueError` on a single class (degenerate-input scenario)
  - EER on a symmetric case
  - `tar_at_far(0.01)` on 100 synthetic impostors
  - `threshold_sweep` best-F1 and the boundary semantics of `precision_recall_at(0.75)` taken from `matching_service.py`
  - `confusion_matrix` label order
- [x] 04.2 GREEN `metrics.py`: `roc_curve, auc, eer, tar_at_far, threshold_sweep, precision_recall_at, confusion_matrix`. REFACTOR: shared sort/cumsum helper.
- [x] 04.3 RED `test_profiling.py`: 5 warm-ups are not timed, one `perf_counter` sample per image, RSS after load and at peak (psutil patched).
- [x] 04.4 GREEN `profiling.py`. REFACTOR.

## Slice 05 (docs, ~645 planned, 627 actual): ADR wave 0 + data model, programming, tests chapters - DONE 2026-10-22
Verify: `fd "^(000[1-9]|001[0-1]|001[6-8])-.*\.md$" docs/adr` shows 14 files and `rg -c "^\| ADR-" docs/adr/README.md` gives the same count. Every ADR link in the chapters resolves (`Test-Path`). Harness: N/A. Rollback: delete the ADRs and chapters, revert the index rows and the WORKFLOW.md hunk.

- [x] 05.1 Write `docs/adr/0001-monorepo-y-dos-backends.md`, `0002-express-5-typescript-zod.md`, `0003-postgresql-postgis-pgvector.md`, `0004-prisma-5-orm.md`, `0005-fastapi-servicio-ia.md`. Source: the "Redacción aprobada" blocks of `interviews.md`, condensed to the approved format with the same meaning.
- [x] 05.2 Write `0006-stack-frontend.md`, `0007-estado-y-datos-frontend.md`, `0008-cloudflare-r2-urls-prefirmadas.md`, `0009-mapas-leaflet-osm-nominatim-postgis.md`, `0010-flujo-git-ramas-personales.md`, `0011-imagen-docker-postgres.md`. `0010` and `0011` fold their history into Motivo/Consecuencias.
- [x] 05.3 Write `0013-dimension-embedding-512.md` and `0014-parametros-matching.md` (user override: written now with Estado `Pendiente`, they become `Aceptada` in slice 14 once they link a `results/` file and `benchmarks/README.md`), plus `0016-moderacion-hibrida.md`, `0017-flyers-canvas.md`, `0018-criterio-evolucion-tecnologica.md`. Responsables come from the "Responsables" field. Referencias carry the issue numbers from 00.3.
- [x] 05.4 Fidelity check: no reason that is absent from `interviews.md`. Update the index rows in the same PR.
- [x] 05.5 Update `docs/WORKFLOW.md`: the author merges after approval; short-lived task branches are allowed.
- [x] 05.6 `docs/informe/1-2-4-modelo-de-datos.md` from `backend/prisma/schema.prisma` and its 14 migrations (Unsupported geometry/vector types included). Scenario "Data model": out-of-date means correct it.
- [x] 05.7 `docs/informe/1-3-1-programacion-y-documentacion.md` from the repo, WORKFLOW.md and the ADRs.
- [x] 05.8 `docs/informe/1-3-3-pruebas.md`:
  - coverage per package and `e2e-ui` counts from the latest green main CI run (`gh run list --workflow ci.yml --branch main --status success -L 1`, then `gh run view <id> --log`), each with the run URL and SHA
  - Snyk before/after: "No disponible" until #207 is merged
  - 1.3.3.5 reads "No disponible (#40)". Estimates are never written as measurements.

## Slice 06 (code, ~370 planned, 601 actual): Metrics stats + provenance (Strict TDD, threat: git boundary) - DONE 2026-10-22
Verify: `PY -m pytest tests/benchmarks/test_metrics_stats.py tests/benchmarks/test_provenance.py -q`. Harness: `PY -c "from benchmarks.provenance import collect; print(collect())"` shows commit, dirty flag, versions. Rollback: delete the added functions in `metrics.py`, `provenance.py`, `requirements-benchmark.txt`, their tests.

- [x] 06.1 RED `test_metrics_stats.py`:
  - `top_k_accuracy` leave-one-out on 4 identities
  - `bootstrap_ci` is deterministic for seed 42 and n=1000, resamples by identity group, and the CI is narrower with more data
  - `latency_stats` p95 on 1..100 equals 95.05 (document the interpolation)
  - `balanced_accuracy`, `per_class_recall`, `false_accept_rate` per subclass
- [x] 06.2 GREEN in `metrics.py`: `top_k_accuracy, bootstrap_ci, latency_stats, balanced_accuracy, per_class_recall, false_accept_rate`. REFACTOR: single RNG entry point.
- [x] 06.3 RED `test_provenance.py` (threat matrix, git boundary):
  - `git` runs with `cwd` fixed to the repo root derived from `__file__`, with no `-C` and no user input
  - missing git yields "No disponible"
  - dirty flag, manifest sha256, python/torch/CPU fields
- [x] 06.4 GREEN `provenance.py` and `requirements-benchmark.txt` (`-r requirements.txt`, the path is relative to the file itself, plus pinned timm, matplotlib, psutil). REFACTOR.
- [x] 06.5 (extra, user request) RED `test_register_manual.py`, GREEN `register_manual.py`: registers the 20 manually added moderation images (19 plush, 1 drawing) in `manifest.csv`; manifest now has 779 data rows, `benchmarks.dataset` prints plush 59 and drawing 41. Commit scope: dataset tooling.

## Slice 07 (code, ~380 planned, 584 actual): Model adapters (Strict TDD) - DONE 2026-10-22
Verify: `PY -m pytest tests/benchmarks/test_embedders.py tests/benchmarks/test_moderators.py tests/benchmarks/test_guards.py -q`. Harness: smoke on one manifest image: `Dinov2Full().embed(...)` has shape (384,) and `YoloModerator` answers for a dog and a plush. Rollback: delete `embedders.py`, `moderators.py`, their tests.

- [x] 07.1 RED `test_embedders.py` (fakes):
  - importing the module loads no model (lazy)
  - `YoloClip` returns `None` when nothing is detected
  - `Dinov2Full` raises a typed `ModelUnavailable` when weights cannot load (the runner then reports "not evaluated")
  - `model_size_mb()`
- [x] 07.2 GREEN `embedders.py`: `ClipFull`, `YoloClip`, `Dinov2Full` (timm `vit_small_patch14_dinov2.lvd142m`, `num_classes=0`, `img_size=224`). They delegate to `app.ml.pipeline` where they overlap.
- [x] 07.3 RED `test_moderators.py` (fakes): `YoloModerator` decision equals `contains_animal`, score = max animal confidence at `conf=0.001`; `ClipZeroShot` positive softmax mass >= 0.5; the CLIP prompts are fixed constants.
- [x] 07.4 RED `test_guards.py`: the benchmark label set equals `_ANIMAL_LABELS` (10 COCO labels). Use the existing `conftest.py` mocks.
- [x] 07.5 GREEN `moderators.py`. REFACTOR.

## Slice 08 (code, ~380 planned, 870 actual): Matching runner (Strict TDD) - DONE 2026-10-22
Verify: `PY -m pytest tests/benchmarks/test_run_matching.py tests/benchmarks/test_guards.py -q`. Harness: `PY -m benchmarks.run_matching --variant clip_full --limit 40` writes to a temp dir and renames it. Rollback: delete `run_matching.py` and its test.

- [x] 08.1 RED `test_guards.py`: 0.75 equals `SIMILARITY_THRESHOLD`.
- [x] 08.2 RED `test_run_matching.py` with fake adapters:
  - all pairs i<j, genuine = same folder, cosine equals `1 - (a <=> b)`
  - `None` embeddings are counted: `detection_rate`, and recall reported twice (detected / end-to-end)
  - AUC, CI, TAR@FAR, EER, P/R/F1 and confusion at 0.75 and at best-F1, top-1/5 plus "top-5 and >=0.75"
  - same seed gives the same output
  - an error mid-run leaves no partial directory
  - the limitation text is in every output
- [x] 08.3 GREEN `run_matching.py` writing `results/matching/<variant>/{summary.json,*.csv,environment.json}`. Per-pair scores go to `raw/` (ignored). REFACTOR.

## Slice 09 (code, ~290 planned, 489 actual): Moderation runner (Strict TDD) - DONE 2026-10-22
Verify: `PY -m pytest tests/benchmarks/test_run_moderation.py -q`. Harness: `PY -m benchmarks.run_moderation --variant yolo --limit 40`. Rollback: delete `run_moderation.py` and its test.

- [x] 09.1 RED `test_run_moderation.py` (fakes):
  - per-class recall includes rabbit and turtle
  - FAR on `no_animal` per subclass (plush, drawing)
  - balanced accuracy, confusion matrix, ROC from scores, bootstrap CI, latency p95
  - `screenshot` excluded, and the outputs say so
  - atomic output
- [x] 09.2 GREEN `run_moderation.py` writing `results/moderation/<variant>/` with per-image scores. REFACTOR.

## Slice 10 (code, ~390): Plots + findings (Strict TDD)
Verify: `PY -m pytest tests/benchmarks/test_plots.py tests/benchmarks/test_findings.py -q`. Harness: render one ROC from fixture results and read back the PNG. Rollback: delete `plots.py`, `findings.py`, their tests.

- [ ] 10.1 RED `test_plots.py`: Agg backend, non-empty PNG, limitation footnote on every figure, no GUI import.
- [ ] 10.2 GREEN `plots.py`: ROC overlay, threshold sweep, confusion matrices (matching and moderation).
- [ ] 10.3 RED `test_findings.py`:
  - an alternative replaces the current pipeline only if the CIs do not overlap AND p95 < 5000 ms AND a CX01 record exists
  - overlapping CIs, or p95 5.2 s, mean "keep"
  - F1@t* minus F1@0.75 >= 0.02 with a CI excluding 0 yields a threshold finding
  - output is written only under `results/`; `app/` is never touched
- [ ] 10.4 GREEN `findings.py` producing a "Hallazgos" block. REFACTOR both.

## Slice 11 (code, ~180): run_all (Strict TDD, threat: subprocess boundary)
Verify: `PY -m pytest tests/benchmarks/test_run_all.py -q`. Harness: `PY -m benchmarks.run_all --dry-run` lists the 5 allowlisted argv. Rollback: delete `run_all.py` and its test.

- [ ] 11.1 RED `test_run_all.py` (patched `subprocess.run`):
  - argv is built only from a fixed allowlist (clip_full, yolo_clip, dinov2; yolo, clip)
  - `sys.executable -m`, `shell=False`
  - an unknown variant raises `ValueError`
  - a `ModelUnavailable` variant is recorded "not evaluated" and the run continues
  - results go to a temp dir, then rename
- [ ] 11.2 GREEN `run_all.py` (D10). REFACTOR.

## Slice 12 (docs, ~710): Report 2.2.x + outline + tasks
Verify: `rg "^seccion:" docs/informe/2-2-*.md` shows 3 files; ADR links resolve. Harness: N/A. Rollback: delete the files.

- [ ] 12.1 `docs/informe/2-2-1-equipo-de-trabajo.md` from `docs/equipo/ROLES.md`.
- [ ] 12.2 `2-2-2-comunicacion-y-decisiones.md`: 2.2.2.4 from the ADR index. 2.2.2.1-.3 read "Pendiente (Fase B)".
- [ ] 12.3 `2-2-3-gestion-de-configuracion.md` from `docs/WORKFLOW.md`, ADR-0010 and `.github/workflows/*`. Cite every claim and write neutral Spanish.
- [ ] 12.4 Commit `openspec/changes/informe-final/{template-outline.md,tasks.md}` with the checkboxes updated to the real state.

## Slice 13 (docs, ~600): Drift, references, external evidence
Verify: ledger rows have no "pending" verdict; `rg -i "redis|dependabot|react 18" docs/ARQUITECTURA.md README.md docs/githubactions/README.md` returns nothing that contradicts the code. Harness: N/A. Rollback: revert the PR (doc text only). Over 800: split drift from references.

- [ ] 13.1 Create `openspec/changes/informe-final/drift-ledger.md` (`claim | source of truth | verdict | fix`) starting with `docs/ARQUITECTURA.md`.
- [ ] 13.2 Fix `docs/ARQUITECTURA.md`: React 19, PG 16, no Redis (feature described as not implemented, #177), compose with Postgres only. Remove or mark "No verificado" every claim that cannot be verified, including the `openai` 512-dim claim. Never edit an accepted ADR.
- [ ] 13.3 `README.md` and `docs/githubactions/README.md`: 4 jobs (backend, frontend, e2e-ui, backend-ia), Node 24 in CI. Note that the Snyk workflow uses Node 20.
- [ ] 13.4 Check `docs/QA_*.md`, `docs/REVISION_BD_CODIGO.md`, `docs/conexion_actual.md`. Fix each, or list it in the ledger with the reason it is left.
- [ ] 13.5 `docs/informe/4-referencias.md`: libraries from `package.json` and `requirements.txt`; datasets with licenses (CC BY 2.0 / 4.0) from `manifest.csv`; Huang et al. (2018) and Lord et al. (2007) from C14.
- [ ] 13.6 `[HUMAN]` Ask Agustín for `POC_Similitudes.ipynb` (E1) and Franco for the moderation Colab notebook (E2). Commit them to `docs/pocs/` here if they arrive (notebook JSON counted as generated). Otherwise they go in a later PR; accepted ADRs are not edited.
- [ ] 13.7 `[HUMAN]` Clean up the stale `docs/.git` pointer, only with the user's OK.

## Slice 14 (docs, ~640 + generated): Results, AI ADRs, report 2.3.2.2, freeze `[HUMAN]`
Verify: second run, `summary.json` equal except date and latency (same-inputs scenario); `rg -c "^\| ADR-" docs/adr/README.md` equals the number of NNNN files minus the template; every technology row in 2.3.2.2.1 has an ADR link and every AI row a `results/` link plus the command. Harness: `PY -m benchmarks.run_all` (needs network for DINOv2 weights; allow long CPU time) and `node .claude/hooks/docs-review-check.mjs`. Rollback: delete `results/*`, the 4 AI ADRs, the 2.3.2.2 file and revert the index rows. If over 800: split into 14a (results + AI ADRs) and 14b (2.3.2.2 + freeze).

- [ ] 14.1 Run `PY -m benchmarks.run_all`. Commit `results/` (summary.json, CSVs, per-image moderation scores, PNG, environment.json) as generated files. `results/**/raw/` stays ignored.
- [ ] 14.2 Write `backend-ia/benchmarks/README.md`: the command, how to read the charts, the dataset limitation (face crops, empty `screenshot`).
- [ ] 14.3 Re-run and diff `summary.json` to prove determinism.
- [ ] 14.4 `[HUMAN]` Review the results with the user against the approved rule. If findings fire (DINOv2 better, CLIP better for moderation, threshold not 0.75), append drafts to `issue-drafts.md` and ask for approval, as in slice 00. No change to `backend-ia/app/`. The user approves the closing wording for C12, C14 (threshold) and C15, recorded in `interviews.md` as a "Cierre".
- [ ] 14.5 Write `0012-pipeline-ia-matching.md`, `0013-dimension-embedding-512.md`, `0014-parametros-matching.md`, `0015-moderacion-imagenes.md`. Estado is `Aceptada`. Referencias link a `results/` file and `benchmarks/README.md`.
  - A contradicting result is cited as a finding plus an issue, not a code change.
  - C15 states plainly that no documentation backs "YOLO beats CLIP"; the benchmark is the evidence.
- [ ] 14.6 Fallback: if the benchmark is not closed by ~10-29, or cannot run, write C12 and C15 as `Pendiente` stubs and list them in the index. Report 2.3.2.2 then cites them as pending.
- [ ] 14.7 `docs/informe/2-3-2-2-factibilidad-tecnica.md`:
  - 2.3.2.2.1: technology table linked to ADR-0001..0018. AI rows link benchmark PNGs and the command. State the dataset limitation wherever results are cited.
  - .2 deployment (compose with Postgres only, no Redis, ADR-0011), .4-.6 from the code.
  - .11 method (ADR-0010, CI), .12 backups, .13 infrastructure, .14 security (token_version #204, helmet, rate limit; JWT debt via its issue).
  - .16 integrations (R2, Nominatim, OSM), .17 growth, .18 flexibility (CX01), .19 conclusion.
  - Phase B subsections (.3, .7-.10, .15) read "Pendiente (Fase B)".
- [ ] 14.8 Freeze check: the index matches the folder, relative links resolve, and all Phase A files exist. Walk the success criteria of `proposal.md`.
- [ ] 14.9 Update `docs/.docs-review.json` (date + HEAD SHA). `[HUMAN]` The user authorizes the commit.

## Slice 15G: Functional-gap issue gate `[HUMAN]` (no PR) - DONE 2026-10-24 (#219-#226, comment on #208)

## Slice 16 (docs, ~800): How the app works — 1.2.2.2 user stories and flows, 1.2.2.3 tasks
Verify: every `file:line` cited resolves with `rg`, the Mermaid diagrams render on GitHub, and each module answers what the user does, where the data goes, which states it passes through and what happens on failure. Split into `1-2-2-2-historias-y-flujos.md` if the file goes over budget.

- [x] 16.1 Overview: component diagram (frontend, Express API, PostgreSQL/PostGIS/pgvector, R2 presigned upload, backend-ia YOLO + OpenCLIP, Socket.io, SMTP, Nominatim).
- [x] 16.2 Per module (Auth, Reports, AI moderation and matching, Notifications, Chat, Flyers, Community moderation, Map, Businesses): user stories from `type: story` issues with their status in the code, the numbered end-to-end flow, business rules with values, known limitations linked to issues.
- [x] 16.3 Mermaid sequence diagrams: publish → moderate → match → notify → confirm; chat; login with 2FA.
- [x] 16.4 Mermaid state diagrams: `ReportStatus`, `MatchStatus`, `ReportFlagStatus`.
- [x] 16.5 1.2.2.3 Tasks: `type: task` issues grouped by milestone S0-S6.
- [x] 16.6 Log every mismatch with `docs/ARQUITECTURA.md` §4 for the slice 13 drift ledger.

## Slice 15 (docs, ~600): 1.2.1 scope + 1.2.2.1 use cases and requirements
Verify: each scope item has a verdict (Implementado, Parcial, Fuera de alcance) with a citation, and every NFR marked "Medido" has evidence.

- [x] 15.1 Extract and review the 6 use-case images in `docs/pdd/PDD v1.0.docx`. Reuse them only if they match the code.
- [x] 15.2 `1-2-1-objetivos-y-alcances.md`: PDD objectives and scope checked against the code, with the PDD drift stated (role `comercio`, gamification, paid plans, advertising, suspension, WhatsApp).
- [x] 15.3 1.2.2.1: Mermaid use-case diagram with the real actors, plus the FR/NFR list with requirement → issue → code → test traceability.

## Slice 17 (docs + generated, ~400): 1.2.3 screens
Verify: every screen in `frontend/src/router.tsx` appears with a capture and its flow F-n.

- [ ] 17.1 1.2.3.1 Palette from `frontend/src/index.css` and `frontend/tailwind.config.ts`, including the off-token colors.
- [ ] 17.2 1.2.3.2 Fonts and type scale.
- [ ] 17.3 `[HUMAN]` Decide how captures are taken (manual or a Playwright script reusing `frontend/e2e/`).
- [ ] 17.4 1.2.3.3 Screens per module, captures in `docs/informe/img/` (counted as generated).

## Phase B (out of scope for 2026-11-04; do not start)

- Spike pandoc `--reference-doc` against python-docx. `.docx` build command (`report-docx-generation` spec). Open question: does the template auto-number TituloN headings?
- Sections: 1.1, 1.2.1-.3, 1.3.2, 1.3.4, 1.3.5, 2.1, 2.2.2.1-.3, 2.3.1, 2.3.2.1, 2.3.2.2 (.3, .7-.10, .15), 2.3.2.3-.6, 2.3.3-.5, 3, indexes 5-8, annexes (Annex 11 rewritten for Prisma).
- ADRs C18-C36 if time allows. Findings issues if not already created.
