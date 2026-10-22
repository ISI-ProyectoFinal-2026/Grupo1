"""Moderation benchmark: does the method accept animal photos and reject everything else?

`evaluate` is pure (labels, decisions and scores in, metrics out); `run` and `main` add the adapters,
the profiling and the atomic result files. A method accepts or rejects (`decide`, the timed answer)
and also gives a continuous `score` that feeds the ROC.
"""

import argparse
from collections import Counter
from pathlib import Path
from typing import NamedTuple

import numpy as np

from benchmarks.dataset import DEFAULT_MANIFEST, EXCLUSION_NOTE, DatasetMissingError, Sample, load_samples
from benchmarks.metrics import (
    DEFAULT_RESAMPLES,
    DEFAULT_SEED,
    ConfidenceInterval,
    auc,
    balanced_accuracy,
    bootstrap_ci,
    confusion_matrix,
    false_accept_rate,
    latency_stats,
    per_class_recall,
    roc_curve,
)
from benchmarks.moderators import MODERATORS
from benchmarks.output import (
    EVALUATED,
    LIMITATION,
    RESULTS_DIR,
    atomic_directory,
    write_csv,
    write_curve_csv,
    write_environment,
    write_json,
)
from benchmarks.profiling import profile

ANIMAL_PREFIX = "animal/"
OTHER_PREFIX = "no_animal/"
CLASSES = ("animal", "no_animal")


class Evaluation(NamedTuple):
    summary: dict
    roc: tuple  # (fpr, tpr, thresholds)


def _interval(ci: ConfidenceInterval) -> dict:
    return {"estimate": ci.estimate, "low": ci.low, "high": ci.high}


def _negatives_accepted(is_animal: np.ndarray, accepted: np.ndarray) -> float:
    negatives = ~is_animal
    if not negatives.any():
        raise ValueError("at least one non-animal image is required")
    return float(accepted[negatives].mean())


def evaluate(
    labels: list[str],
    accepted: list[bool],
    scores: list[float],
    *,
    n_resamples: int = DEFAULT_RESAMPLES,
    seed: int = DEFAULT_SEED,
) -> Evaluation:
    """Metrics of one method. `labels` look like "animal/dog" or "no_animal/plush"; `accepted[i]` is
    the method's answer for image i and `scores[i]` its continuous score (higher means animal)."""
    is_animal = np.array([label.startswith(ANIMAL_PREFIX) for label in labels])
    accepted_flags = np.asarray(accepted, dtype=bool)
    roc = roc_curve(is_animal, scores)  # raises unless both classes are present

    actual = np.where(is_animal, CLASSES[0], CLASSES[1])
    predicted = np.where(accepted_flags, CLASSES[0], CLASSES[1])
    images = np.arange(len(labels))  # every image is its own resampling group

    def interval(statistic, *arrays) -> dict:
        return _interval(bootstrap_ci(statistic, images, *arrays, n_resamples=n_resamples, seed=seed))

    animals = [(label, flag) for label, flag, animal in zip(labels, accepted_flags, is_animal) if animal]
    others = [(label, flag) for label, flag, animal in zip(labels, accepted_flags, is_animal) if not animal]
    summary = {
        "images": {
            "total": len(labels),
            "animal": int(is_animal.sum()),
            "no_animal": int((~is_animal).sum()),
            "per_class": dict(sorted(Counter(labels).items())),
        },
        "per_class_recall": per_class_recall(*zip(*animals)),
        "false_accept_rate": {
            "overall": interval(_negatives_accepted, is_animal, accepted_flags),
            "per_subclass": false_accept_rate(*zip(*((label.removeprefix(OTHER_PREFIX), flag) for label, flag in others))),
        },
        "balanced_accuracy": interval(balanced_accuracy, actual, predicted),
        "confusion_matrix": {"labels": list(CLASSES), "matrix": confusion_matrix(actual, predicted, CLASSES).tolist()},
        "auc": interval(auc, is_animal, np.asarray(scores, dtype=float)),
    }
    return Evaluation(summary, roc)


def _write_tables(folder: Path, samples: list[Sample], decisions: list[bool], scores: list[float], evaluation: Evaluation) -> None:
    summary = evaluation.summary
    counts = summary["images"]["per_class"]
    rows = [(label, "recall", counts[label], rate) for label, rate in summary["per_class_recall"].items()]
    rows += [
        (f"{OTHER_PREFIX}{name}", "false_accept_rate", counts[f"{OTHER_PREFIX}{name}"], rate)
        for name, rate in summary["false_accept_rate"]["per_subclass"].items()
    ]
    write_csv(folder / "per_class.csv", ["class", "metric", "images", "rate"], rows)
    write_csv(
        folder / "scores.csv",
        ["image", "label", "score", "accepted"],
        [(f"{s.label}/{s.path.name}", s.label, score, accepted) for s, score, accepted in zip(samples, scores, decisions)],
    )
    fpr, tpr, thresholds = evaluation.roc
    write_curve_csv(folder / "roc.csv", ["fpr", "tpr", "threshold"], fpr, tpr, thresholds)


def run(
    moderator, samples: list[Sample], output_dir: Path, *, seed: int = DEFAULT_SEED, n_resamples: int = DEFAULT_RESAMPLES
) -> dict:
    """Time the accept/reject answer for every sample, score each image once, evaluate and publish
    the result files atomically."""
    answers: dict[Path, bool] = {}

    def decide(sample: Sample) -> None:
        answers[sample.path] = moderator.decide(sample.path)

    with atomic_directory(output_dir) as staging:
        profiled = profile(moderator.load, decide, samples)
        decisions = [answers[sample.path] for sample in samples]
        scores = [moderator.score(sample.path) for sample in samples]
        evaluation = evaluate([s.label for s in samples], decisions, scores, n_resamples=n_resamples, seed=seed)
        summary = {
            "variant": moderator.name,
            "task": "moderation",
            "limitation": LIMITATION,
            "excluded": EXCLUSION_NOTE,
            "models": moderator.model_ids,
            "status": EVALUATED,
            "seed": seed,
            "n_resamples": n_resamples,
            "model_size_mb": moderator.model_size_mb(),
            **evaluation.summary,
            "performance": {
                "latency_ms": latency_stats(profiled.latencies_ms)._asdict(),
                "rss_after_load_mb": profiled.rss_after_load_mb,
                "peak_rss_mb": profiled.peak_rss_mb,
            },
        }
        _write_tables(staging, samples, decisions, scores, evaluation)
        write_json(staging / "summary.json", summary)
        write_environment(staging, moderator.model_ids, seed)
    return summary


def limit_per_class(samples: list[Sample], limit: int) -> list[Sample]:
    """The first `limit` images of every class, keeping path order."""
    taken: Counter = Counter()
    kept = []
    for sample in samples:
        if taken[sample.label] < limit:
            taken[sample.label] += 1
            kept.append(sample)
    return kept


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run the moderation benchmark for one method.")
    parser.add_argument("--variant", required=True, choices=sorted(MODERATORS))
    parser.add_argument("--limit", type=int, help="use only the first N images of every class (smoke runs)")
    parser.add_argument("--resamples", type=int, default=DEFAULT_RESAMPLES, help="bootstrap resamples")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output-dir", type=Path, help="default: results/moderation/<variant>")
    args = parser.parse_args(argv)

    try:
        samples = load_samples(args.manifest, task="moderation")
    except DatasetMissingError as error:
        raise SystemExit(f"error: {error}") from error
    if args.limit:
        samples = limit_per_class(samples, args.limit)
    output_dir = args.output_dir or RESULTS_DIR / "moderation" / args.variant
    summary = run(MODERATORS[args.variant](), samples, output_dir, n_resamples=args.resamples)
    print(f"{args.variant}: {summary['status']} -> {output_dir}")


if __name__ == "__main__":
    main()
