# Delta for ai-model-benchmark

Lives in `backend-ia/benchmarks/`. Inputs: `datasets/manifest.csv` and the downloaded images (not versioned). `backend-ia/app/` is not modified.

## ADDED Requirements

### Requirement: Reproducible, manifest-driven runs

Runs MUST use seed 42 and MUST read their image lists only from `manifest.csv`. One documented command MUST regenerate all results. Each result file MUST record run metadata: date, git commit, Python and torch versions, device, model identifiers and weight tags, seed and manifest checksum.

#### Scenario: Same inputs, same results
- GIVEN the same manifest, seed and environment
- WHEN the command runs twice
- THEN the metric values and the sampled image lists are identical

#### Scenario: Dataset missing
- GIVEN images listed in the manifest are not on disk
- WHEN a runner starts
- THEN it fails with a message that names the missing path and the download script, and writes no partial results

### Requirement: Unit-tested metric library (Strict TDD)

The library MUST provide:
- ROC/AUC, EER and TAR@FAR=1%.
- Precision/recall at a threshold, and a threshold sweep with its best-F1 threshold.
- Top-k accuracy and a confusion matrix.
- A bootstrap 95% confidence interval that resamples by identity group (seed 42, n=1000).
- Balanced accuracy, per-class recall and the false-accept rate per `no_animal` subclass.
- Latency (median, p95), peak RAM and model size.

Each function MUST have unit tests on synthetic data, written before the implementation, in `backend-ia/tests/`, and they MUST run in the `backend-ia` CI job without real models.

#### Scenario: Known values
- GIVEN synthetic scores with a hand-computed AUC and confusion matrix
- WHEN the metric functions run
- THEN they return the expected values exactly

#### Scenario: Degenerate input
- GIVEN labels that contain only one class
- WHEN AUC is requested
- THEN the function raises a documented error and does not return a number

### Requirement: Runners tested with fake models

Matching and moderation runners MUST accept injectable model adapters, and tests MUST drive them with fake adapters. Real-model runs are executions, not CI tests.

#### Scenario: Fake adapter
- GIVEN a fake adapter with fixed embeddings
- WHEN the matching runner runs
- THEN the output has the expected pairs, scores and metric values

### Requirement: Matching comparison

The matching runner MUST compare three methods: OpenCLIP ViT-B-32 `laion2b_s34b_b79k` alone, YOLO crop + OpenCLIP, and DINOv2. It MUST report, per method:
- ROC/AUC with a 95% bootstrap CI, EER and TAR@FAR=1%.
- Precision, recall and F1 at 0.75 and at the best-F1 threshold, with the confusion matrix at both.
- Top-1 and top-5 accuracy, and "top-5 and similarity >= 0.75" (mirrors production `LIMIT 5`).
- Latency (median, p95), peak RAM and model size.

For YOLO+OpenCLIP it MUST report YOLO's detection rate on the face crops and state how undetected images were handled. Recall is reported twice: over detected images, and end-to-end, where a failed detection counts as a miss.

#### Scenario: Threshold check
- GIVEN a completed matching run
- WHEN the results are read
- THEN they show precision and recall at 0.75 and the sweep's best threshold per method

#### Scenario: DINOv2 weights unavailable
- GIVEN the DINOv2 weights cannot be downloaded
- WHEN the runner finishes
- THEN DINOv2 is reported as `no evaluado` with the reason, and the other methods still produce results

### Requirement: Moderation comparison

The moderation runner MUST compare YOLOv8n using the same 10 COCO animal labels as `backend-ia/app/ml/pipeline.py` against CLIP zero-shot. It MUST report per-class recall for the classes under `animal/`, the false-accept rate on `no_animal/` per subclass (plush, drawing), balanced accuracy with a 95% bootstrap CI, a confusion matrix, ROC from scores, latency (median, p95), peak RAM and model size. The empty `screenshot` class MUST be excluded from the run and the outputs MUST say so.

#### Scenario: Rabbit and turtle
- GIVEN `animal/rabbit` and `animal/turtle` images
- WHEN the runner finishes
- THEN per-class results for both classes are reported for both methods

#### Scenario: Empty class
- GIVEN `no_animal/screenshot` has no images
- WHEN results are written
- THEN the class is absent from the metrics and a note states that it was excluded and why

### Requirement: Declared dataset limitation

Every result file, chart and summary MUST state: (a) DogFaceNet images are already face crops, so the benchmark measures face-level re-identification and not production crops (YOLO bounding box, background included); (b) the `screenshot` class is empty.

#### Scenario: Limitation present
- GIVEN any generated result, chart or summary
- WHEN it is read
- THEN the limitation text appears in it (metadata or caption)

### Requirement: Results and charts

Results MUST be written to `backend-ia/benchmarks/results/` as machine-readable files (JSON or CSV) plus PNG charts (ROC curves, threshold sweep, confusion matrices). Generated files MUST be counted separately from authored lines in PR budgets.

#### Scenario: Charts regenerate
- GIVEN the results folder is deleted
- WHEN the documented command runs
- THEN every chart and result file the report references is recreated

### Requirement: Pre-registered decision rule

An alternative (DINOv2 or OpenCLIP alone for matching; CLIP zero-shot for moderation) replaces the current pipeline only if all three hold:
1. It beats the current pipeline in AUC or TAR@FAR=1% (matching), or in balanced accuracy and false-accept rate (moderation), with 95% CIs that do not overlap.
2. Its p95 latency stays below 5000 ms (PDD v1.0 non-functional requirement).
3. A formal CX01 record exists (new ADR with the before and after metrics).

Otherwise the current pipeline is kept, with the comparison as evidence. A threshold finding fires when F1 at the best threshold minus F1 at 0.75 is at least 0.02 and the CI of that difference excludes 0.

#### Scenario: Overlapping intervals
- GIVEN an alternative with a higher point estimate but overlapping CIs
- WHEN the findings are computed
- THEN the result is "keep" and no replacement finding is written

#### Scenario: Too slow
- GIVEN an alternative with non-overlapping CIs and p95 of 5.2 s
- WHEN the findings are computed
- THEN the result is "keep"

### Requirement: Contradictions become findings, not changes

If results contradict a current choice (CLIP beats YOLO for moderation, DINOv2 beats OpenCLIP, or the best threshold is not 0.75) under the decision rule above, the outcome MUST be a written finding in the results and a GitHub issue. The benchmark change MUST NOT alter `backend-ia/app/`, model weights or the threshold.

#### Scenario: Threshold differs
- GIVEN the sweep's best threshold is 0.82
- WHEN the run completes
- THEN a finding and a GitHub issue are recorded, and the 0.75 setting in the code is unchanged
