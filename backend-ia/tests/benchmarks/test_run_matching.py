"""Matching runner driven by fake embeddings: pairs, scores and metrics checked against hand-computed values."""

import json
from pathlib import Path

import numpy as np
import pytest

from benchmarks import output, run_matching
from benchmarks.dataset import Sample
from benchmarks.embedders import ModelUnavailable
from benchmarks.output import LIMITATION, read_csv
from benchmarks.run_matching import evaluate, run

RESAMPLES = 40

# Two dogs, two photos each. Cosine similarity of every pair, by hand:
#   a1.a2 = 0.8 (same dog)   a1.b1 = 0.0   a1.b2 = 0.6
#   a2.b1 = 0.6              a2.b2 = 0.96  b1.b2 = 0.8 (same dog)
# Vectors are deliberately not unit length: the runner has to normalise (cosine, not dot product).
OVERLAP = {
    "ids": ["A", "A", "B", "B"],
    "vectors": [(2.0, 0.0), (4.0, 3.0), (0.0, 5.0), (3.0, 4.0)],
    "scores": {(0, 1): 0.8, (0, 2): 0.0, (0, 3): 0.6, (1, 2): 0.6, (1, 3): 0.96, (2, 3): 0.8},
}
# Same shape, but the genuine pairs score 0.6 (below 0.75) and every impostor scores lower.
SEPARATED = {
    "ids": ["A", "A", "B", "B"],
    "vectors": [(1.0, 0.0), (0.6, 0.8), (-1.0, 0.0), (-0.6, 0.8)],
}


def run_evaluate(case, extra_ids=(), extra_vectors=(), **options):
    ids = list(case["ids"]) + list(extra_ids)
    vectors = [np.array(v) for v in case["vectors"]] + list(extra_vectors)
    return evaluate(ids, vectors, n_resamples=RESAMPLES, **options)


def test_every_pair_is_scored_with_the_cosine_similarity():
    evaluation = run_evaluate(OVERLAP)

    scores = {(i, j): score for i, j, _, score in evaluation.pairs}
    assert scores == pytest.approx(OVERLAP["scores"])
    assert [(i, j) for i, j, _, _ in evaluation.pairs] == sorted(scores)  # i < j, each pair once
    assert {(i, j): genuine for i, j, genuine, _ in evaluation.pairs} == {
        (0, 1): True, (0, 2): False, (0, 3): False, (1, 2): False, (1, 3): False, (2, 3): True,
    }
    assert evaluation.summary["pairs"] == {"total": 6, "genuine": 2, "impostor": 4}


def test_ranking_metrics_when_an_impostor_outscores_the_genuine_pairs():
    summary = run_evaluate(OVERLAP).summary

    assert summary["auc"]["estimate"] == pytest.approx(0.75)  # 3 of 4 impostors are below each genuine pair
    assert summary["eer"] == pytest.approx(0.25)
    assert summary["tar_at_far_1pct"]["estimate"] == 0.0  # the top score is an impostor
    assert summary["auc"]["low"] <= summary["auc"]["high"]


def test_precision_and_recall_at_the_production_threshold_and_at_the_best_one():
    summary = run_evaluate(OVERLAP).summary

    production = summary["at_production_threshold"]
    assert production["threshold"] == 0.75
    assert (production["tp"], production["fp"], production["fn"], production["tn"]) == (2, 1, 0, 3)
    assert production["precision"] == pytest.approx(2 / 3)
    assert production["recall_detected"] == 1.0
    assert production["f1"] == pytest.approx(0.8)
    best = summary["at_best_threshold"]
    assert best["threshold"] == pytest.approx(0.8)
    assert best["f1"] == pytest.approx(0.8)
    assert summary["f1_gain_at_best_threshold"]["estimate"] == pytest.approx(0.0)


def test_a_better_threshold_than_the_production_one_shows_as_an_f1_gain():
    summary = run_evaluate(SEPARATED).summary

    assert summary["auc"]["estimate"] == 1.0
    assert summary["tar_at_far_1pct"]["estimate"] == 1.0
    production = summary["at_production_threshold"]
    assert (production["tp"], production["fn"]) == (0, 2)  # 0.6 < 0.75: both genuine pairs are missed
    assert production["recall_detected"] == 0.0
    assert summary["at_best_threshold"]["threshold"] == pytest.approx(0.6)
    assert summary["at_best_threshold"]["f1"] == pytest.approx(1.0)
    assert summary["f1_gain_at_best_threshold"]["estimate"] == pytest.approx(1.0)


def test_top_k_is_reported_with_and_without_the_production_similarity_floor():
    overlap = run_evaluate(OVERLAP).summary["top_k"]
    separated = run_evaluate(SEPARATED).summary["top_k"]

    # a2 and b2 each have the other dog's photo as their nearest neighbour, so top-1 is 2/4.
    assert overlap["top1"]["detected"] == pytest.approx(0.5)
    assert overlap["top5"]["detected"] == pytest.approx(1.0)
    assert overlap["top5_at_production_threshold"]["detected"] == pytest.approx(1.0)
    assert separated["top1"]["detected"] == pytest.approx(1.0)
    assert separated["top5_at_production_threshold"]["detected"] == 0.0  # found, but below 0.75


def test_undetected_images_are_counted_and_reported_in_both_ways():
    # A third photo of dog A where YOLO found nothing: production would answer 422 for it.
    summary = run_evaluate(OVERLAP, extra_ids=["A"], extra_vectors=[None]).summary

    assert summary["images"] == {"total": 5, "embedded": 4, "undetected": 1, "detection_rate": 0.8}
    assert summary["pairs"]["genuine"] == 2  # only pairs between embedded images are scored
    production = summary["at_production_threshold"]
    assert production["recall_detected"] == 1.0  # 2 of the 2 scored genuine pairs
    assert production["recall_end_to_end"] == pytest.approx(0.5)  # 2 of the 4 real pairs (A has 3 photos)
    assert summary["top_k"]["top1"] == {"detected": pytest.approx(0.5), "end_to_end": pytest.approx(0.4)}
    assert summary["top_k"]["top5"] == {"detected": pytest.approx(1.0), "end_to_end": pytest.approx(0.8)}


def test_without_undetected_images_both_recalls_agree():
    production = run_evaluate(OVERLAP).summary["at_production_threshold"]

    assert production["recall_detected"] == production["recall_end_to_end"] == 1.0
    assert run_evaluate(OVERLAP).summary["images"]["detection_rate"] == 1.0


def clustered(seed):
    rng = np.random.default_rng(seed)
    centres = rng.normal(size=(8, 6))
    ids = [f"dog{i}" for i in range(8) for _ in range(3)]
    vectors = [centres[i] + 0.7 * rng.normal(size=6) for i in range(8) for _ in range(3)]
    return ids, vectors


def test_the_same_seed_gives_the_same_output_and_another_seed_a_different_interval():
    ids, vectors = clustered(0)

    first = evaluate(ids, vectors, n_resamples=60, seed=42)
    again = evaluate(ids, vectors, n_resamples=60, seed=42)
    other = evaluate(ids, vectors, n_resamples=60, seed=7)

    assert first.summary == again.summary
    assert first.pairs == again.pairs
    assert first.summary["auc"]["estimate"] == other.summary["auc"]["estimate"]
    assert first.summary["auc"]["low"] != other.summary["auc"]["low"]


def test_the_confidence_interval_resamples_identities_not_pairs():
    ids, vectors = clustered(1)

    auc_interval = evaluate(ids, vectors, n_resamples=60).summary["auc"]

    assert 0.5 < auc_interval["low"] < auc_interval["estimate"] < auc_interval["high"] <= 1.0


def test_no_genuine_pair_raises_instead_of_reporting_a_number():
    with pytest.raises(ValueError, match="both classes"):
        evaluate(["A", "B", "C"], [np.array([1.0, 0.0]), np.array([0.0, 1.0]), np.array([1.0, 1.0])])


# --- run: adapters, profiling and the result files ---------------------------------


class FakeEmbedder:
    name = "fake"
    model_ids = {"fake": "fake-model"}

    def __init__(self, vectors, fail_on=None, unavailable=None):
        self.vectors = vectors
        self.fail_on = fail_on
        self.unavailable = unavailable
        self.loads = 0

    def load(self):
        self.loads += 1
        if self.unavailable:
            raise ModelUnavailable(self.unavailable)

    def embed(self, path):
        if path == self.fail_on:
            raise RuntimeError("embedding exploded")
        return self.vectors[path]

    def model_size_mb(self):
        return 12.5


def fake_run_inputs(undetected=()):
    """Samples and the vectors their fake embedder answers; `undetected` photos get None."""
    labels = OVERLAP["ids"] + list(undetected)
    paths = [Path(f"matching/{label}/{n}.jpg") for n, label in enumerate(labels)]
    samples = [Sample(path, "matching", label) for path, label in zip(paths, labels)]
    vectors = {path: np.array(vector) for path, vector in zip(paths, OVERLAP["vectors"])}
    vectors.update({path: None for path in paths[len(OVERLAP["vectors"]):]})
    return samples, vectors


@pytest.fixture(autouse=True)
def fixed_provenance(monkeypatch):
    monkeypatch.setattr(output, "collect", lambda models, seed: {"commit": "abc123", "models": models, "seed": seed})


def test_run_writes_the_summary_curves_pairs_and_environment(tmp_path):
    samples, vectors = fake_run_inputs()
    embedder = FakeEmbedder(vectors)

    summary = run(embedder, samples, tmp_path / "fake", n_resamples=RESAMPLES)

    written = json.loads((tmp_path / "fake" / "summary.json").read_text(encoding="utf-8"))
    assert written == json.loads(json.dumps(summary))
    assert {path.name for path in (tmp_path / "fake").iterdir()} == {
        "summary.json", "roc.csv", "threshold_sweep.csv", "environment.json", "raw",
    }
    assert (written["variant"], written["status"], written["models"]) == ("fake", "evaluado", {"fake": "fake-model"})
    assert written["auc"]["estimate"] == pytest.approx(0.75)
    assert written["model_size_mb"] == 12.5
    assert set(written["performance"]) == {"latency_ms", "rss_after_load_mb", "peak_rss_mb"}
    assert set(written["performance"]["latency_ms"]) == {"median", "p95", "mean"}
    assert len(read_csv(tmp_path / "fake" / "raw" / "pairs.csv")) == 6
    assert embedder.loads == 1


def test_every_output_states_the_dataset_limitation(tmp_path):
    samples, vectors = fake_run_inputs()

    run(FakeEmbedder(vectors), samples, tmp_path / "fake", n_resamples=RESAMPLES)

    for name in ("summary.json", "environment.json"):
        saved = json.loads((tmp_path / "fake" / name).read_text(encoding="utf-8"))
        assert saved["limitation"] == LIMITATION
    for name in ("roc.csv", "threshold_sweep.csv", "raw/pairs.csv"):
        assert (tmp_path / "fake" / name).read_text(encoding="utf-8").startswith(f"# {LIMITATION}\n")


def test_curves_are_thinned_but_keep_both_ends(tmp_path, monkeypatch):
    monkeypatch.setattr(run_matching, "MAX_CURVE_POINTS", 4)
    samples, vectors = fake_run_inputs()

    run(FakeEmbedder(vectors), samples, tmp_path / "fake", n_resamples=RESAMPLES)

    roc = read_csv(tmp_path / "fake" / "roc.csv")
    assert len(roc) == 4
    assert (roc[0]["fpr"], roc[0]["tpr"], roc[0]["threshold"]) == ("0.0", "0.0", "inf")
    assert (roc[-1]["fpr"], roc[-1]["tpr"]) == ("1.0", "1.0")
    assert len(read_csv(tmp_path / "fake" / "threshold_sweep.csv")) == 4


def test_undetected_images_show_up_in_the_summary(tmp_path):
    samples, vectors = fake_run_inputs(undetected=["A"])

    summary = run(FakeEmbedder(vectors), samples, tmp_path / "fake", n_resamples=RESAMPLES)

    assert summary["images"]["detection_rate"] == 0.8
    assert summary["at_production_threshold"]["recall_end_to_end"] == pytest.approx(0.5)


def test_the_same_inputs_give_the_same_files_apart_from_timings(tmp_path):
    samples, vectors = fake_run_inputs()

    run(FakeEmbedder(vectors), samples, tmp_path / "first", n_resamples=RESAMPLES)
    run(FakeEmbedder(vectors), samples, tmp_path / "second", n_resamples=RESAMPLES)

    def comparable(folder):
        summary = json.loads((folder / "summary.json").read_text(encoding="utf-8"))
        summary.pop("performance")
        return summary

    assert comparable(tmp_path / "first") == comparable(tmp_path / "second")
    for name in ("roc.csv", "threshold_sweep.csv", "raw/pairs.csv"):
        assert (tmp_path / "first" / name).read_bytes() == (tmp_path / "second" / name).read_bytes()


def test_an_error_mid_run_leaves_no_partial_directory(tmp_path):
    samples, vectors = fake_run_inputs()
    embedder = FakeEmbedder(vectors, fail_on=samples[2].path)

    with pytest.raises(RuntimeError, match="exploded"):
        run(embedder, samples, tmp_path / "results" / "fake", n_resamples=RESAMPLES)

    assert list((tmp_path / "results").iterdir()) == []


def test_unavailable_weights_are_reported_as_not_evaluated_and_the_run_continues(tmp_path):
    samples, vectors = fake_run_inputs()

    summary = run(FakeEmbedder(vectors, unavailable="no network"), samples, tmp_path / "dino", n_resamples=RESAMPLES)

    written = json.loads((tmp_path / "dino" / "summary.json").read_text(encoding="utf-8"))
    assert written == {
        "variant": "fake", "task": "matching", "limitation": LIMITATION, "models": {"fake": "fake-model"},
        "status": "no evaluado", "reason": "no network",
    }
    assert summary == written
    assert {path.name for path in (tmp_path / "dino").iterdir()} == {"summary.json", "environment.json"}


# --- main: command line -----------------------------------------------------------


def write_manifest(root, rows):
    lines = ["path,task,label"] + [f"{path},matching,{label}" for path, label in rows]
    (root / "manifest.csv").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return root / "manifest.csv"


def test_main_runs_the_chosen_variant_on_the_manifest_images(tmp_path, monkeypatch):
    root = tmp_path / "datasets"
    rows = [("matching/A/1.jpg", "A"), ("matching/A/2.jpg", "A"), ("matching/B/1.jpg", "B"), ("matching/B/2.jpg", "B")]
    for path, _ in rows:
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        (root / path).write_bytes(b"x")
    manifest = write_manifest(root, rows)
    vectors = {root / path: np.array(vector) for (path, _), vector in zip(rows, OVERLAP["vectors"])}
    monkeypatch.setattr(run_matching, "EMBEDDERS", {"fake": lambda: FakeEmbedder(vectors)})

    run_matching.main(["--variant", "fake", "--manifest", str(manifest), "--output-dir", str(tmp_path / "out"), "--resamples", "40"])

    assert json.loads((tmp_path / "out" / "summary.json").read_text(encoding="utf-8"))["images"]["total"] == 4


def test_main_limit_keeps_only_the_first_images_in_path_order(tmp_path, monkeypatch):
    root = tmp_path / "datasets"
    rows = [("matching/A/1.jpg", "A"), ("matching/A/2.jpg", "A"), ("matching/B/1.jpg", "B"), ("matching/B/2.jpg", "B")]
    for path, _ in rows:
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        (root / path).write_bytes(b"x")
    manifest = write_manifest(root, rows)
    vectors = {root / path: np.array(vector) for (path, _), vector in zip(rows, OVERLAP["vectors"])}
    monkeypatch.setattr(run_matching, "EMBEDDERS", {"fake": lambda: FakeEmbedder(vectors)})

    run_matching.main(["--variant", "fake", "--manifest", str(manifest), "--output-dir", str(tmp_path / "out"), "--limit", "3", "--resamples", "40"])

    summary = json.loads((tmp_path / "out" / "summary.json").read_text(encoding="utf-8"))
    assert summary["images"]["total"] == 3
    assert summary["pairs"] == {"total": 3, "genuine": 1, "impostor": 2}


def test_main_stops_before_running_when_images_are_missing(tmp_path, monkeypatch):
    manifest = write_manifest(tmp_path, [("matching/A/1.jpg", "A")])
    monkeypatch.setattr(run_matching, "EMBEDDERS", {"fake": lambda: pytest.fail("must not be built")})

    with pytest.raises(SystemExit, match="download_datasets.py"):
        run_matching.main(["--variant", "fake", "--manifest", str(manifest), "--output-dir", str(tmp_path / "out"), "--resamples", "40"])

    assert not (tmp_path / "out").exists()
