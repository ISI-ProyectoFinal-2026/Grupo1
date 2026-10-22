"""Evaluation metrics (numpy only, no model imports).

Scores are "higher means positive". A sample is predicted positive when
`score >= threshold`, the same boundary as `matching_service`, which skips
candidates with `similarity < SIMILARITY_THRESHOLD`.
"""

from typing import NamedTuple, Sequence

import numpy as np

FAR_EPSILON = 1e-12


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
