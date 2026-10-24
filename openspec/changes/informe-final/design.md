# Design: informe-final

## Technical Approach

Additive docs (`docs/adr/`, `docs/informe/`) plus an isolated `backend-ia/benchmarks/` package that calls production `app.ml.pipeline` through adapters. Nothing in `backend-ia/app/`, `backend/` or `frontend/` changes. Specs: `openspec/changes/informe-final/specs/*`.

## Architecture Decisions

| # | Topic | Choice | Rejected | Rationale |
|---|---|---|---|---|
| D1 | ADR numbering | Fixed: C01–C17 = ADR-0001..0017, CX01 = ADR-0018, C18+ from 0019; index carries a C-ID column | Assign numbers when written | Each chain stays one ADR (D2), so numbers never shift |
| D2 | Chains (C10, C11, C13, C14, C18, C19, C22, C34, C35) | One ADR; the history is folded into Motivo/Consecuencias (the approved format has no Historial section). Split into old (`Reemplazada por`) + new only if Matías confirms the old state was deliberate | Always split | Old states lack rationale (C10's `develop` was a trial, not a decision) |
| D3 | Unanswered C01–C17 | ADR file with `Estado: Pendiente`: Motivo reads "Pendiente de entrevista". No files for C18–C36 | Index-only list | Spec R2/R5 |
| D4 | Report headings | One file per group; H1 = group root with template number; front matter `nivel` drives the Phase B heading shift | Absolute levels | Readable on GitHub for 11-04 |
| D5 | Figures/tables | Section-scoped `Figura 2.3.2.2-1`, `Tabla 1.3.3-2`, registered in `docs/informe/README.md` (seeds indexes 5/6) | Global sequence | Files are written out of order |
| D6 | DINOv2 | timm `vit_small_patch14_dinov2.lvd142m`, `num_classes=0`, `img_size=224` (384-d) | torch.hub (runs remote code); ViT-B/L (CPU) | timm 1.0.30 installed; 22M params |
| D7 | Reuse | Lazy adapters over `detect_and_crop`, `generate_embedding`, `contains_animal`, `clip_model` | Copy model setup | Measures what production runs |
| D8 | Dependencies | `benchmarks/requirements-benchmark.txt`: `-r ../requirements.txt` + pinned timm, matplotlib, psutil | Production requirements | Production stays untouched |
| D9 | Results | Version `summary.json`, aggregate CSVs, per-image moderation scores, PNGs, `environment.json`; ignore `results/**/raw/` (per-pair scores) | All or nothing | Evidence vs ~50k regenerable rows |
| D10 | RAM isolation | `run_all.py` runs each variant via `sys.executable -m`, fixed allowlisted argv, `shell=False` | One process | Pipeline loads YOLO+CLIP on import |
| D11 | Branches | Resolved (2026-10-22): short-lived task branches are allowed, as approved in the C10 interview (author merges after approval; `WORKFLOW.md` updated in slice 05). Slices 01–02 land as sequential commits on `matias/features` by user decision; a slice can be promoted to `matias/informe-final/NN-slug` if a PR split is needed | `matias/features` only | Matches the approved C10 wording |

## ADR Template (`docs/adr/0000-plantilla.md`, Spanish)

Approved format (2026-10-22), applied to every ADR including C01–C12:

- **Header:** Estado (`Aceptada` / `Pendiente` / `Reemplazada por [ADR-XXXX]`) and Responsables (repo authors, per `ROLES.md`).
- **Sections:** Decisión (1–2 lines), Motivo (2–4 bullets), Alternativas (1 line, optional), Consecuencias (1–3 bullets), Referencias (one line with links to PR, issue, commit or benchmark result).
- **Body rules:** no dates, file names or code unless they are the decision itself. The approved interview wording is condensed, never extended.
- **AI ADRs (C12–C15):** Referencias links a result file or PNG under `backend-ia/benchmarks/results/` plus `backend-ia/benchmarks/README.md` for the command. A gap reads "No disponible" and the ADR is not `Aceptada`.
- **Supersession:** the new ADR links to the old one. In the old ADR, only the Estado line changes.
- **Index (`README.md`):** a quick path, then a table `ADR | Título | Estado | Responsables | C-ID | Reemplaza/Reemplazada por`, and a "Pendientes" list (C12, C15 until the benchmark closes).

## Report (`docs/informe/`)

- **Front matter:** `seccion`, `titulo`, `nivel`, `fase`, `estado`, `actualizado`.
- **Phase A files:**
  - `1-2-4-modelo-de-datos.md`
  - `1-3-1-programacion-y-documentacion.md`
  - `1-3-3-pruebas.md`
  - `2-2-1-equipo-de-trabajo.md`
  - `2-2-2-comunicacion-y-decisiones.md`
  - `2-2-3-gestion-de-configuracion.md`
  - `2-3-2-2-factibilidad-tecnica.md`
  - `4-referencias.md`
- **Phase B subsections:** heading plus "Pendiente (Fase B)". No Phase B files are created.
- **Links:** relative, for example `../adr/…`, `../equipo/ROLES.md`, `../../backend-ia/benchmarks/results/…png`.
- **Captions:** each one ends with `Fuente:` and the reproduce command.

## Benchmark (`backend-ia/benchmarks/`)

| File | Responsibility |
|---|---|
| `metrics.py` | Numpy only: `roc_curve`, `auc` (raises on a single class), `eer`, `tar_at_far`, `threshold_sweep`, `precision_recall_at`, `confusion_matrix`, `top_k_accuracy`, `bootstrap_ci` (groups, seed 42, n=1000), `latency_stats` (median/p95/mean), `balanced_accuracy`, `per_class_recall`, `false_accept_rate` (per `no_animal` subclass) |
| `dataset.py` | Manifest-driven, sorted. Excludes `no_animal/screenshot`. Fails before running if files are missing. |
| `embedders.py` | `ClipFull`, `YoloClip` (production; `None` when nothing is detected), `Dinov2Full` |
| `moderators.py` | `YoloModerator`: decision = `contains_animal`, score = max animal confidence at `conf=0.001`. `ClipZeroShot`: fixed prompts, positive softmax mass ≥ 0.5. |
| `profiling.py` | 5 warm-up runs, `perf_counter` per image, psutil RSS after load and at peak; each adapter reports `model_size_mb()` |
| `provenance.py` | Date, commit, dirty flag, Python/torch, CPU/threads, models, seed, manifest sha256 |
| `run_matching.py`, `run_moderation.py`, `plots.py`, `run_all.py` | Write to a temp dir, then rename (no partial results). Agg charts with the limitation footnote. Command: `python -m benchmarks.run_all` |

**Matching**
- **Pairs and scores:** all pairs i<j; genuine = same folder. Cosine similarity equals `1 - (a <=> b)`.
- **Quality:** AUC with an identity-bootstrap 95% CI; TAR@FAR=1%; EER; P/R/F1 and confusion matrix at 0.75 and at the best-F1 threshold; top-1/5 leave-one-out; "top-5 ∧ ≥0.75" mirrors `LIMIT 5`.
- **Cost:** latency per image on CPU (median, p95), peak RSS, model size in MB.
- **YOLO failures:** report `detection_rate`. Recall is reported twice: over detected images, and end-to-end, where a failure counts as a miss because production returns 422.

**Moderation**
- Per-class recall (rabbit and turtle included), false-accept rate on `no_animal` per subclass (plush, drawing), balanced accuracy, confusion matrix, ROC from scores, bootstrap 95% CI, latency p95.
- Prompts are fixed in advance and not tuned, because the POC's prompts were not recorded.

**Findings and decision rule (pre-registered, approved 2026-10-22)**
- **Replacement rule:** an alternative replaces the current pipeline only if (1) it beats it in AUC or TAR@FAR=1% (matching) or in balanced accuracy and false-accept rate (moderation) with 95% CIs that do not overlap, (2) its p95 stays below 5000 ms (PDD v1.0), and (3) a CX01 record (new ADR with before/after metrics) exists. Otherwise the result is "keep", with the comparison as evidence.
- **Threshold trigger:** F1@t* − F1@0.75 ≥ 0.02 with a CI that excludes 0.
- **Output:** a "Hallazgos" subsection in `2-3-2-2` and in the cited ADR, plus `openspec/changes/informe-final/issue-drafts.md`. Issues are created only after the user approves. `backend-ia/app/` is never modified.

## Data Flow

    manifest+datasets → dataset.py → adapters (→ app.ml.pipeline) → metrics.py
         → results/<task>/<variant>/*.json|csv → plots.py → PNG → informe + ADR links

## Quality Metrics and Consistency

- **Coverage:** taken from the latest green `main` CI run (`gh run view --log`). Cite the URL and SHA.
- **Snyk:** code-scanning alerts by severity, before and after #207. Until #207 is merged, the value is "No disponible".
- **E2E:** the `e2e-ui` job result and test counts. Section 1.3.3.5 reads "No disponible (#40)".
- **Docs drift:** a claim ledger in `openspec/changes/informe-final/drift-ledger.md` with columns `claim | source of truth | verdict | fix`.
  - Unverifiable claims are removed.
  - The Snyk workflow uses Node 20; CI uses Node 24.
  - One PR per doc if the change runs over budget.
- **docs-review:** only `SKILL.md` changes.
  - It adds `docs/informe/` and `docs/adr/`.
  - It flags report sections whose cited ADR is superseded, or whose `app/ml/`, threshold or `benchmarks/` sources changed since `lastCommit`.
  - The hook is unchanged; date logic is enough.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | metrics, dataset, provenance | Synthetic arrays with hand-computed values; `tmp_path`; Strict TDD |
| Unit | runners | Fake adapters; failure accounting; atomic output |
| Guard | 0.75 equals `SIMILARITY_THRESHOLD`; the label set equals `_ANIMAL_LABELS` | `conftest.py` mocks make the imports safe |

Tests live in `backend-ia/tests/benchmarks/` and run in CI. `--cov=app` is unaffected. Real-model runs are executions, not tests.

## Threat Matrix

| Boundary | Applicability | Response / RED test |
|---|---|---|
| Documentation-like paths | N/A: no classification | — |
| Git repository selection | Applicable: `provenance.py` runs `git rev-parse HEAD` and `git status --porcelain` | `cwd` is fixed to the repo root derived from `__file__`; no `-C` and no user input; a failure records "No disponible". RED tests: fixed `cwd`; missing git. |
| Commit / Push / PR | N/A: no automation | — |

## Chained PRs (stacked to main, freeze 2026-11-03)

The slice map (14 slices plus the issue gate, with dependencies, budgets and target dates) lives in `tasks.md`; it supersedes the earlier 12-slice plan. Budgets: code slices 400 authored lines, documentation-only slices 800. Wave-0 interviews are done (C01–C11, C13, C14, C16, C17, CX01); C12 and C15 close with the benchmark.

**ADR candidates of this change** (the team supplies the rationale):
- Benchmark isolated from `app/`.
- DINOv2 via timm.
- Short-lived stacked branches.

## Migration / Rollout

No migration required. Revert per PR.

## Open Questions

- [x] D11 resolved: short-lived branches are allowed (C10 interview); `WORKFLOW.md` is updated in slice 05.
- [x] ADR section naming resolved: the approved format drops "Evidencia y métricas"; the spec was amended (slice 01).
- [ ] Phase B: does the template auto-number its TituloN headings?
