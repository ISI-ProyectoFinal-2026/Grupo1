"""Evaluation metrics (numpy only, no model imports).

Scores are "higher means positive". A sample is predicted positive when
`score >= threshold`, the same boundary as `matching_service`, which skips
candidates with `similarity < SIMILARITY_THRESHOLD`.
"""

from typing import Callable, Hashable, Iterable, NamedTuple, Sequence

import numpy as np

FAR_EPSILON = 1e-12
DEFAULT_SEED = 42
DEFAULT_RESAMPLES = 1000
DEFAULT_CONFIDENCE = 0.95
LATENCY_TAIL_PERCENTILE = 95


class PrecisionRecall(NamedTuple):
    precision: float
    recall: float
    f1: float
    tp: int
    fp: int
    fn: int
    tn: int


class ThresholdSweep(NamedTuple):
    """Metrics at every distinct score, thresholds ascending."""

    thresholds: np.ndarray
    precision: np.ndarray
    recall: np.ndarray
    f1: np.ndarray
    best_threshold: float
    best_f1: float


class ConfidenceInterval(NamedTuple):
    estimate: float
    low: float
    high: float


class LatencyStats(NamedTuple):
    median: float
    p95: float
    mean: float


def _rng(seed: int) -> np.random.Generator:
    """The only place random numbers are drawn, so one seed fixes every resample."""
    return np.random.default_rng(seed)


def _as_arrays(y_true: Sequence, scores: Sequence) -> tuple[np.ndarray, np.ndarray]:
    labels = np.asarray(y_true).astype(bool)
    values = np.asarray(scores, dtype=float)
    if labels.ndim != 1 or labels.shape != values.shape:
        raise ValueError("y_true and scores must be 1-D arrays of the same length")
    return labels, values


def _as_binary_arrays(y_true: Sequence, scores: Sequence) -> tuple[np.ndarray, np.ndarray]:
    labels, values = _as_arrays(y_true, scores)
    if labels.all() or not labels.any():
        raise ValueError("y_true must contain both classes (positive and negative)")
    return labels, values


def _cumulative_counts(
    labels: np.ndarray, values: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Thresholds (descending) with the positives and negatives scoring >= each one."""
    order = np.argsort(-values, kind="stable")
    sorted_values = values[order]
    sorted_labels = labels[order]
    last_of_group = np.append(np.diff(sorted_values) != 0, True)
    true_positives = np.cumsum(sorted_labels)[last_of_group]
    false_positives = np.cumsum(~sorted_labels)[last_of_group]
    return sorted_values[last_of_group], true_positives, false_positives


def _f1(precision: np.ndarray, recall: np.ndarray) -> np.ndarray:
    total = precision + recall
    return np.divide(2 * precision * recall, total, out=np.zeros_like(total), where=total > 0)


def roc_curve(y_true: Sequence, scores: Sequence) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(fpr, tpr, thresholds) from (0, 0) at threshold +inf to (1, 1); ties share one point."""
    labels, values = _as_binary_arrays(y_true, scores)
    thresholds, tp, fp = _cumulative_counts(labels, values)
    fpr = np.insert(fp / (~labels).sum(), 0, 0.0)
    tpr = np.insert(tp / labels.sum(), 0, 0.0)
    return fpr, tpr, np.insert(thresholds, 0, np.inf)


def auc(y_true: Sequence, scores: Sequence) -> float:
    """Area under the ROC curve; tied scores count as half a win."""
    fpr, tpr, _ = roc_curve(y_true, scores)
    return float(np.trapezoid(tpr, fpr))


def eer(y_true: Sequence, scores: Sequence) -> float:
    """Equal error rate: where FPR equals FNR, interpolated linearly between ROC points."""
    fpr, tpr, _ = roc_curve(y_true, scores)
    gap = fpr - (1 - tpr)  # non-decreasing, from -1 to +1
    upper = int(np.argmax(gap >= 0))
    if gap[upper] == 0:
        return float(fpr[upper])
    lower = upper - 1
    share = -gap[lower] / (gap[upper] - gap[lower])
    return float(fpr[lower] + share * (fpr[upper] - fpr[lower]))


def tar_at_far(y_true: Sequence, scores: Sequence, far: float = 0.01) -> float:
    """True accept rate at the loosest threshold whose false accept rate is <= `far`."""
    fpr, tpr, _ = roc_curve(y_true, scores)
    return float(tpr[fpr <= far + FAR_EPSILON].max())


def precision_recall_at(y_true: Sequence, scores: Sequence, threshold: float) -> PrecisionRecall:
    """Precision, recall and F1 at `score >= threshold`; 0.0 when a denominator is empty."""
    labels, values = _as_arrays(y_true, scores)
    predicted = values >= threshold
    tp = int((predicted & labels).sum())
    fp = int((predicted & ~labels).sum())
    fn = int((~predicted & labels).sum())
    tn = int((~predicted & ~labels).sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return PrecisionRecall(precision, recall, f1, tp, fp, fn, tn)


def threshold_sweep(y_true: Sequence, scores: Sequence) -> ThresholdSweep:
    """Precision, recall and F1 at each distinct score; best F1 keeps the lowest threshold on ties."""
    labels, values = _as_binary_arrays(y_true, scores)
    thresholds, tp, fp = _cumulative_counts(labels, values)
    precision = (tp / (tp + fp))[::-1]
    recall = (tp / labels.sum())[::-1]
    f1 = _f1(precision, recall)
    thresholds = thresholds[::-1]
    best = int(np.argmax(f1))
    return ThresholdSweep(thresholds, precision, recall, f1, float(thresholds[best]), float(f1[best]))


def confusion_matrix(y_true: Sequence, y_pred: Sequence, labels: Sequence) -> np.ndarray:
    """Counts with rows = true label and columns = predicted label, both in `labels` order."""
    index = {label: position for position, label in enumerate(labels)}
    matrix = np.zeros((len(index), len(index)), dtype=int)
    for actual, predicted in zip(y_true, y_pred, strict=True):
        for label in (actual, predicted):
            if label not in index:
                raise ValueError(f"label {label!r} is not in labels {list(labels)}")
        matrix[index[actual], index[predicted]] += 1
    return matrix


def top_k_hits(
    similarity: np.ndarray, identities: Sequence, k: int, min_similarity: float | None = None
) -> tuple[int, int]:
    """Leave-one-out top-k as (hits, queries): queries with a same-identity sample among their k
    nearest others. With `min_similarity`, that sample must also score at least that much.

    `similarity[i, j]` is higher for closer samples; the diagonal (the query itself) is ignored and
    ties keep the lower index first. Queries whose identity has no other sample cannot hit, so they
    are not counted as queries.
    """
    if k < 1:
        raise ValueError("k must be at least 1")
    matrix = np.asarray(similarity, dtype=float)
    if matrix.ndim != 2 or matrix.shape[0] != matrix.shape[1]:
        raise ValueError("similarity must be a square matrix")
    ids = np.asarray(identities)
    if ids.shape != (matrix.shape[0],):
        raise ValueError("identities needs one identity per row of similarity")
    _, inverse, counts = np.unique(ids, return_inverse=True, return_counts=True)
    has_partner = counts[inverse] > 1
    if not has_partner.any():
        raise ValueError("no identity has two samples, so there is nothing to find")
    masked = np.where(np.eye(len(ids), dtype=bool), -np.inf, matrix)
    nearest = np.argsort(-masked, axis=1, kind="stable")[:, : min(k, len(ids) - 1)]
    found = ids[nearest] == ids[:, None]
    if min_similarity is not None:
        found &= np.take_along_axis(masked, nearest, axis=1) >= min_similarity
    return int(found.any(axis=1)[has_partner].sum()), int(has_partner.sum())


def top_k_accuracy(
    similarity: np.ndarray, identities: Sequence, k: int, min_similarity: float | None = None
) -> float:
    """Share of queries that `top_k_hits` counts as found."""
    hits, queries = top_k_hits(similarity, identities, k, min_similarity)
    return hits / queries


def bootstrap_ci(
    statistic: Callable[..., float],
    groups: Sequence,
    *arrays: Sequence,
    n_resamples: int = DEFAULT_RESAMPLES,
    confidence: float = DEFAULT_CONFIDENCE,
    seed: int = DEFAULT_SEED,
) -> ConfidenceInterval:
    """Percentile bootstrap CI of `statistic(*arrays)`, resampling whole `groups` with replacement.

    Resampling by group (for example one identity) keeps correlated samples together. Resamples on
    which `statistic` raises `ValueError` (such as a single class for AUC) are dropped.
    """
    columns = [np.asarray(column) for column in arrays]
    group_ids = np.asarray(groups)
    if any(len(column) != len(group_ids) for column in columns):
        raise ValueError("groups and every array must have the same length")
    _, inverse = np.unique(group_ids, return_inverse=True)
    members = [np.flatnonzero(inverse == group) for group in range(inverse.max() + 1)]
    estimate = float(statistic(*columns))
    rng = _rng(seed)
    values = []
    for _ in range(n_resamples):
        chosen = rng.integers(0, len(members), size=len(members))
        index = np.concatenate([members[group] for group in chosen])
        try:
            values.append(float(statistic(*(column[index] for column in columns))))
        except ValueError:
            continue
    if not values:
        raise ValueError("every bootstrap resample was degenerate")
    tail = (1 - confidence) / 2 * 100
    low, high = np.percentile(values, [tail, 100 - tail])
    return ConfidenceInterval(estimate, float(low), float(high))


def latency_stats(latencies_ms: Iterable[float]) -> LatencyStats:
    """Median, p95 and mean. p95 uses numpy's linear interpolation between the closest ranks:
    position 0.95 * (n - 1), so for 1..100 it is 95 + 0.05 * (96 - 95) = 95.05."""
    values = np.asarray(list(latencies_ms), dtype=float)
    if values.size == 0:
        raise ValueError("latency_stats needs at least one sample")
    return LatencyStats(
        float(np.median(values)),
        float(np.percentile(values, LATENCY_TAIL_PERCENTILE)),
        float(values.mean()),
    )


def _rate_by_group(groups: Sequence[Hashable], flags: Sequence[bool]) -> dict:
    """Share of True flags in each group, with groups in sorted order."""
    if len(groups) != len(flags):
        raise ValueError("groups and flags must have the same length")
    if not len(groups):
        raise ValueError("at least one sample is required")
    return {
        group: float(np.mean([flag for member, flag in zip(groups, flags) if member == group]))
        for group in sorted(set(groups))
    }


def per_class_recall(classes: Sequence[Hashable], correct: Sequence[bool]) -> dict:
    """Recall of each class: the share of its samples that were classified correctly."""
    return _rate_by_group(classes, correct)


def false_accept_rate(subclasses: Sequence[Hashable], accepted: Sequence[bool]) -> dict:
    """Share of negative samples wrongly accepted, per negative subclass (for example plush)."""
    return _rate_by_group(subclasses, accepted)


def balanced_accuracy(y_true: Sequence, y_pred: Sequence) -> float:
    """Mean of the per-class recalls, so a rare class weighs as much as a common one."""
    if len(y_true) != len(y_pred):
        raise ValueError("y_true and y_pred must have the same length")
    correct = [actual == predicted for actual, predicted in zip(y_true, y_pred)]
    return float(np.mean(list(per_class_recall(y_true, correct).values())))
