"""Core metrics checked against hand-computed values (numpy only, no models)."""

import numpy as np
import pytest

from benchmarks.metrics import (
    auc,
    confusion_matrix,
    eer,
    precision_recall_at,
    roc_curve,
    tar_at_far,
    threshold_sweep,
)

SINGLE_CLASS_FUNCTIONS = [auc, eer, tar_at_far, roc_curve]


def test_auc_is_one_for_separable_scores():
    assert auc([1, 1, 0, 0], [0.9, 0.8, 0.3, 0.1]) == pytest.approx(1.0)


def test_auc_is_zero_for_reversed_scores():
    assert auc([1, 1, 0, 0], [0.1, 0.3, 0.8, 0.9]) == pytest.approx(0.0)


def test_auc_is_half_for_all_tied_scores():
    assert auc([1, 0, 1, 0], [0.5, 0.5, 0.5, 0.5]) == pytest.approx(0.5)


def test_auc_counts_partial_ties_as_half():
    # Mann-Whitney pairs: (.9,.5)=1 (.9,.1)=1 (.5,.5)=.5 (.5,.1)=1 -> 3.5 / 4
    assert auc([1, 1, 0, 0], [0.9, 0.5, 0.5, 0.1]) == pytest.approx(0.875)


@pytest.mark.parametrize("function", SINGLE_CLASS_FUNCTIONS)
@pytest.mark.parametrize("labels", [[1, 1, 1], [0, 0, 0]])
def test_single_class_labels_raise_value_error(function, labels):
    with pytest.raises(ValueError, match="both classes"):
        function(labels, [0.9, 0.5, 0.1])


def test_roc_curve_starts_at_origin_and_ends_at_one_one():
    fpr, tpr, thresholds = roc_curve([1, 1, 0, 0], [0.9, 0.5, 0.5, 0.1])

    assert fpr.tolist() == [0.0, 0.0, 0.5, 1.0]
    assert tpr.tolist() == [0.0, 0.5, 1.0, 1.0]
    assert thresholds[1:].tolist() == [0.9, 0.5, 0.1]
    assert np.isinf(thresholds[0])


def test_eer_on_symmetric_case():
    # curve passes through (fpr, fnr) = (0.25, 0.25)
    labels = [1, 1, 1, 1, 0, 0, 0, 0]
    scores = [0.9, 0.8, 0.7, 0.3, 0.6, 0.2, 0.1, 0.05]

    assert eer(labels, scores) == pytest.approx(0.25)


def test_eer_is_zero_when_separable_and_one_when_reversed():
    assert eer([1, 1, 0, 0], [0.9, 0.8, 0.3, 0.1]) == pytest.approx(0.0)
    assert eer([1, 1, 0, 0], [0.1, 0.3, 0.8, 0.9]) == pytest.approx(1.0)


def test_eer_interpolates_inside_a_tied_segment():
    assert eer([1, 0], [0.5, 0.5]) == pytest.approx(0.5)


def _impostor_case():
    # 100 impostors scoring 0.00..0.99; genuine scores straddle the top impostors
    impostors = [i / 100 for i in range(100)]
    genuine = [0.995, 0.991, 0.985, 0.5]
    labels = [1] * len(genuine) + [0] * len(impostors)
    return labels, genuine + impostors


def test_tar_at_far_one_percent_allows_exactly_one_false_accept():
    labels, scores = _impostor_case()

    # threshold 0.985 accepts one impostor (0.99 = 1% FAR) and three genuine
    assert tar_at_far(labels, scores, far=0.01) == pytest.approx(0.75)


def test_tar_at_far_tightens_with_a_lower_far():
    labels, scores = _impostor_case()

    # FAR 0 only admits genuine scores above every impostor: 0.995 and 0.991
    assert tar_at_far(labels, scores, far=0.0) == pytest.approx(0.5)


def test_tar_at_far_is_zero_when_genuine_scores_are_below_the_impostors():
    impostors = [i / 100 for i in range(100)]
    labels = [1, 1] + [0] * 100

    assert tar_at_far(labels, [0.3, 0.2] + impostors) == pytest.approx(0.0)


def test_threshold_sweep_best_f1():
    labels = [1, 1, 0, 0]
    scores = [0.9, 0.6, 0.7, 0.2]

    sweep = threshold_sweep(labels, scores)

    assert sweep.thresholds.tolist() == [0.2, 0.6, 0.7, 0.9]
    assert sweep.f1 == pytest.approx([2 / 3, 0.8, 0.5, 2 / 3])
    assert sweep.precision == pytest.approx([0.5, 2 / 3, 0.5, 1.0])
    assert sweep.recall == pytest.approx([1.0, 1.0, 0.5, 0.5])
    assert sweep.best_threshold == pytest.approx(0.6)
    assert sweep.best_f1 == pytest.approx(0.8)


def test_threshold_sweep_best_f1_ties_pick_the_lowest_threshold():
    # F1 is 2/3 at 0.3 (tp2 fp2) and at 0.9 (tp1 fp0 fn1), 0.4 and 0.5 are worse
    sweep = threshold_sweep([1, 1, 0, 0], [0.9, 0.3, 0.5, 0.4])

    assert sweep.f1 == pytest.approx([2 / 3, 0.4, 0.5, 2 / 3])
    assert sweep.best_threshold == pytest.approx(0.3)


def test_threshold_sweep_with_tied_scores_has_one_threshold_per_distinct_score():
    sweep = threshold_sweep([1, 1, 0], [0.8, 0.8, 0.8])

    assert sweep.thresholds.tolist() == [0.8]
    assert sweep.best_threshold == pytest.approx(0.8)
    assert sweep.best_f1 == pytest.approx(0.8)  # P 2/3, R 1


def test_precision_recall_at_includes_the_threshold_itself():
    # matching_service skips similarity < 0.75, so a score of exactly 0.75 is a match
    result = precision_recall_at([1, 1, 0, 0], [0.75, 0.74, 0.75, 0.1], threshold=0.75)

    assert (result.tp, result.fp, result.fn, result.tn) == (1, 1, 1, 1)
    assert result.precision == pytest.approx(0.5)
    assert result.recall == pytest.approx(0.5)
    assert result.f1 == pytest.approx(0.5)


def test_precision_recall_at_just_below_the_threshold_is_negative():
    result = precision_recall_at([1, 0], [0.7499, 0.7499], threshold=0.75)

    assert (result.tp, result.fp, result.fn, result.tn) == (0, 0, 1, 1)


def test_precision_recall_at_reports_zero_when_nothing_is_predicted_positive():
    result = precision_recall_at([1, 0], [0.2, 0.1], threshold=0.75)

    assert result.precision == 0.0
    assert result.recall == 0.0
    assert result.f1 == 0.0


def test_precision_recall_at_with_perfect_split():
    result = precision_recall_at([1, 1, 0], [0.9, 0.8, 0.1], threshold=0.75)

    assert (result.precision, result.recall, result.f1) == (1.0, 1.0, 1.0)


def test_confusion_matrix_follows_the_label_order_given():
    y_true = ["dog", "dog", "cat", "bird"]
    y_pred = ["dog", "cat", "cat", "dog"]

    matrix = confusion_matrix(y_true, y_pred, labels=["cat", "dog", "bird"])

    # rows = true (cat, dog, bird), columns = predicted (cat, dog, bird)
    assert matrix.tolist() == [[1, 0, 0], [1, 1, 0], [0, 1, 0]]


def test_confusion_matrix_label_order_changes_the_layout():
    y_true = ["dog", "cat"]
    y_pred = ["dog", "dog"]

    assert confusion_matrix(y_true, y_pred, labels=["cat", "dog"]).tolist() == [[0, 1], [0, 1]]
    assert confusion_matrix(y_true, y_pred, labels=["dog", "cat"]).tolist() == [[1, 0], [1, 0]]


def test_confusion_matrix_rejects_labels_outside_the_given_order():
    with pytest.raises(ValueError, match="bird"):
        confusion_matrix(["dog", "bird"], ["dog", "dog"], labels=["cat", "dog"])
