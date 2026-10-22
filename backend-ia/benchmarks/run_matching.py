"""Matching benchmark: how well do image embeddings tell the same dog from different dogs?

`evaluate` is pure (identities and embeddings in, metrics out); `run` and `main` add the adapters, the
profiling and the atomic result files.
"""

import argparse
from collections import Counter
from pathlib import Path
from typing import NamedTuple

import numpy as np

from benchmarks.dataset import DEFAULT_MANIFEST, DatasetMissingError, Sample, load_samples
from benchmarks.embedders import EMBEDDERS, ModelUnavailable
from benchmarks.metrics import (
    DEFAULT_RESAMPLES,
    DEFAULT_SEED,
    ConfidenceInterval,
    ThresholdSweep,
    auc,
    bootstrap_ci,
    eer,
    precision_recall_at,
    roc_curve,
    tar_at_far,
    threshold_sweep,
    latency_stats,
    top_k_hits,
)
from benchmarks.output import (
    EVALUATED,
    LIMITATION,
    NOT_EVALUATED,
    RESULTS_DIR,
    atomic_directory,
    write_csv,
    write_environment,
    write_json,
)
from benchmarks.profiling import profile

# Mirrors production (`matching_service`): a candidate counts only above this similarity and within the
# 5 nearest. tests/benchmarks/test_guards.py fails if the threshold drifts.
PRODUCTION_THRESHOLD = 0.75
PRODUCTION_TOP_K = 5
TOP_1 = 1
MAX_CURVE_POINTS = 1000  # the full per-pair scores go to raw/ (ignored); committed curves are thinned


class Evaluation(NamedTuple):
    summary: dict
    pairs: list  # (i, j, genuine, score) with i < j, positions in the input lists
    roc: tuple  # (fpr, tpr, thresholds)
    sweep: ThresholdSweep


def _interval(ci: ConfidenceInterval) -> dict:
    return {"estimate": ci.estimate, "low": ci.low, "high": ci.high}


def _pairs_of(similarity: np.ndarray, identities: np.ndarray, picked: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(genuine flags, scores) of every pair of distinct images in `picked`; a resample may repeat images."""
    rows, cols = np.triu_indices(len(picked), k=1)
    first, second = picked[rows], picked[cols]
    different = first != second
    first, second = first[different], second[different]
    genuine = identities[first] == identities[second]
    if genuine.all() or not genuine.any():
        raise ValueError("scored pairs must contain both classes (genuine and impostor)")
    return genuine, similarity[first, second]


def _threshold_block(genuine: np.ndarray, scores: np.ndarray, threshold: float, all_genuine_pairs: int) -> dict:
    result = precision_recall_at(genuine, scores, threshold)
    return {
        "threshold": float(threshold),
        "precision": result.precision,
        "recall_detected": result.recall,
        "recall_end_to_end": result.tp / all_genuine_pairs,
        "f1": result.f1,
        "tp": result.tp,
        "fp": result.fp,
        "fn": result.fn,
        "tn": result.tn,
    }


def evaluate(
    identities: list[str],
    embeddings: list,
    *,
    n_resamples: int = DEFAULT_RESAMPLES,
    seed: int = DEFAULT_SEED,
) -> Evaluation:
    """Score every pair i<j of embedded images; None marks an image where detection failed.

    Pairs, ROC, top-k and the confidence intervals use the embedded images only ("detected"). Recall and
    top-k are also reported end-to-end, where an undetected image counts as a miss because production
    answers 422 for it.
    """
    everyone = np.asarray(identities)
    embedded = np.array([i for i, vector in enumerate(embeddings) if vector is not None])
    vectors = np.vstack([embeddings[i] for i in embedded]).astype(float)
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
    similarity = vectors @ vectors.T
    ids = everyone[embedded]
    picked = np.arange(len(embedded))

    genuine, scores = _pairs_of(similarity, ids, picked)
    counts = Counter(identities)
    all_genuine_pairs = sum(n * (n - 1) // 2 for n in counts.values())
    all_queries = sum(n for n in counts.values() if n > 1)

    sweep = threshold_sweep(genuine, scores)
    best = sweep.best_threshold

    def gain(chosen: np.ndarray) -> float:
        flags, values = _pairs_of(similarity, ids, chosen)
        return precision_recall_at(flags, values, best).f1 - precision_recall_at(flags, values, PRODUCTION_THRESHOLD).f1

    def interval(statistic) -> dict:
        return _interval(bootstrap_ci(statistic, ids, picked, n_resamples=n_resamples, seed=seed))

    def top_k(k: int, min_similarity: float | None = None) -> dict:
        hits, queries = top_k_hits(similarity, ids, k, min_similarity)
        return {"detected": hits / queries, "end_to_end": hits / all_queries}

    summary = {
        "images": {
            "total": len(identities),
            "embedded": len(embedded),
            "undetected": len(identities) - len(embedded),
            "detection_rate": len(embedded) / len(identities),
        },
        "pairs": {"total": len(scores), "genuine": int(genuine.sum()), "impostor": int((~genuine).sum())},
        "auc": interval(lambda chosen: auc(*_pairs_of(similarity, ids, chosen))),
        "eer": eer(genuine, scores),
        "tar_at_far_1pct": interval(lambda chosen: tar_at_far(*_pairs_of(similarity, ids, chosen))),
        "at_production_threshold": _threshold_block(genuine, scores, PRODUCTION_THRESHOLD, all_genuine_pairs),
        "at_best_threshold": _threshold_block(genuine, scores, best, all_genuine_pairs),
        "f1_gain_at_best_threshold": interval(gain),
        "top_k": {
            "top1": top_k(TOP_1),
            "top5": top_k(PRODUCTION_TOP_K),
            "top5_at_production_threshold": top_k(PRODUCTION_TOP_K, PRODUCTION_THRESHOLD),
        },
    }
    rows, cols = np.triu_indices(len(embedded), k=1)
    pairs = [
        (int(embedded[r]), int(embedded[c]), bool(g), float(s)) for r, c, g, s in zip(rows, cols, genuine, scores)
    ]
    return Evaluation(summary, pairs, roc_curve(genuine, scores), sweep)


def _thin(length: int) -> np.ndarray:
    """At most MAX_CURVE_POINTS evenly spaced positions, always including the first and the last."""
    if length <= MAX_CURVE_POINTS:
        return np.arange(length)
    return np.unique(np.linspace(0, length - 1, MAX_CURVE_POINTS).round().astype(int))


def _write_curves(folder: Path, samples: list[Sample], evaluation: Evaluation) -> None:
    fpr, tpr, thresholds = evaluation.roc
    keep = _thin(len(thresholds))
    write_csv(folder / "roc.csv", ["fpr", "tpr", "threshold"], list(zip(fpr[keep], tpr[keep], thresholds[keep])))
    sweep = evaluation.sweep
    keep = _thin(len(sweep.thresholds))
    columns = (sweep.thresholds, sweep.precision, sweep.recall, sweep.f1)
    write_csv(folder / "threshold_sweep.csv", ["threshold", "precision", "recall", "f1"], list(zip(*(c[keep] for c in columns))))
    (folder / "raw").mkdir()
    name = [f"{sample.label}/{sample.path.name}" for sample in samples]
    write_csv(
        folder / "raw" / "pairs.csv",
        ["image_a", "image_b", "genuine", "similarity"],
        [(name[i], name[j], genuine, score) for i, j, genuine, score in evaluation.pairs],
    )


def run(
    embedder, samples: list[Sample], output_dir: Path, *, seed: int = DEFAULT_SEED, n_resamples: int = DEFAULT_RESAMPLES
) -> dict:
    """Embed every sample (timed), evaluate, and publish the result files atomically.

    Weights that cannot load produce a "no evaluado" summary instead of an error, so the other
    variants still run.
    """
    header = {"variant": embedder.name, "task": "matching", "limitation": LIMITATION, "models": embedder.model_ids}
    embeddings: dict[Path, object] = {}

    def embed(sample: Sample) -> None:
        embeddings[sample.path] = embedder.embed(sample.path)

    with atomic_directory(output_dir) as staging:
        try:
            profiled = profile(embedder.load, embed, samples)
        except ModelUnavailable as error:
            summary = {**header, "status": NOT_EVALUATED, "reason": str(error)}
        else:
            evaluation = evaluate(
                [sample.label for sample in samples],
                [embeddings[sample.path] for sample in samples],
                n_resamples=n_resamples,
                seed=seed,
            )
            summary = {
                **header,
                "status": EVALUATED,
                "seed": seed,
                "n_resamples": n_resamples,
                "model_size_mb": embedder.model_size_mb(),
                **evaluation.summary,
                "performance": {
                    "latency_ms": latency_stats(profiled.latencies_ms)._asdict(),
                    "rss_after_load_mb": profiled.rss_after_load_mb,
                    "peak_rss_mb": profiled.peak_rss_mb,
                },
            }
            _write_curves(staging, samples, evaluation)
        write_json(staging / "summary.json", summary)
        write_environment(staging, embedder.model_ids, seed)
    return summary


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run the matching benchmark for one embedding variant.")
    parser.add_argument("--variant", required=True, choices=sorted(EMBEDDERS))
    parser.add_argument("--limit", type=int, help="use only the first N images in path order (smoke runs)")
    parser.add_argument("--resamples", type=int, default=DEFAULT_RESAMPLES, help="bootstrap resamples")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output-dir", type=Path, help="default: results/matching/<variant>")
    args = parser.parse_args(argv)

    try:
        samples = load_samples(args.manifest, task="matching")
    except DatasetMissingError as error:
        raise SystemExit(f"error: {error}") from error
    if args.limit:
        samples = samples[: args.limit]
    output_dir = args.output_dir or RESULTS_DIR / "matching" / args.variant
    summary = run(EMBEDDERS[args.variant](), samples, output_dir, n_resamples=args.resamples)
    print(f"{args.variant}: {summary['status']} -> {output_dir}")


if __name__ == "__main__":
    main()
