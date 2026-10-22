"""Moderation benchmark: does the method accept animal photos and reject everything else?

`evaluate` is pure: labels, decisions and scores in, metrics out. A method accepts or rejects
(`decide`, the timed answer) and also gives a continuous `score` that feeds the ROC.
"""

from collections import Counter
from typing import NamedTuple

import numpy as np

from benchmarks.metrics import (
    DEFAULT_RESAMPLES,
    DEFAULT_SEED,
    ConfidenceInterval,
    auc,
    balanced_accuracy,
    bootstrap_ci,
    confusion_matrix,
    false_accept_rate,
    per_class_recall,
    roc_curve,
)

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
