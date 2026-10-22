"""Statistics helpers checked against hand-computed values (numpy only, no models)."""

import numpy as np
import pytest

from benchmarks.metrics import (
    auc,
    balanced_accuracy,
    bootstrap_ci,
    false_accept_rate,
    latency_stats,
    per_class_recall,
    top_k_accuracy,
    top_k_hits,
)

# One-dimensional "embeddings": similarity = -distance, so rankings are easy to check by hand.
POINTS = np.array([0.0, 0.1, 1.0, 1.1, 2.0, 2.1, 2.25, 2.9])
IDENTITIES = ["A", "A", "B", "B", "C", "C", "D", "D"]
SIMILARITY = -np.abs(POINTS[:, None] - POINTS[None, :])


# --- top_k_accuracy -------------------------------------------------------------


def test_top1_leave_one_out_on_four_identities():
    # D1 (2.25) is closest to C2, C1 and only then D2 -> the single top-1 miss.
    assert top_k_accuracy(SIMILARITY, IDENTITIES, k=1) == pytest.approx(7 / 8)


def test_top_k_grows_with_k():
    assert top_k_accuracy(SIMILARITY, IDENTITIES, k=2) == pytest.approx(7 / 8)
    assert top_k_accuracy(SIMILARITY, IDENTITIES, k=3) == pytest.approx(1.0)


def test_top_k_ignores_the_query_itself():
    # The diagonal is the highest similarity; counting it would make every query a hit.
    assert top_k_accuracy(SIMILARITY, IDENTITIES, k=1) < 1.0


def test_top_k_skips_identities_with_a_single_sample():
    points = np.append(POINTS, 9.0)
    similarity = -np.abs(points[:, None] - points[None, :])
    # "E" has no partner to find, so it neither hits nor counts in the denominator.
    assert top_k_accuracy(similarity, IDENTITIES + ["E"], k=1) == pytest.approx(7 / 8)


def test_top_k_rejects_invalid_input():
    with pytest.raises(ValueError, match="k must be"):
        top_k_accuracy(SIMILARITY, IDENTITIES, k=0)
    with pytest.raises(ValueError, match="square"):
        top_k_accuracy(SIMILARITY[:, :4], IDENTITIES, k=1)
    with pytest.raises(ValueError, match="one identity per row"):
        top_k_accuracy(SIMILARITY, IDENTITIES[:-1], k=1)
    with pytest.raises(ValueError, match="two samples"):
        top_k_accuracy(np.eye(3), ["A", "B", "C"], k=1)


# --- bootstrap_ci ----------------------------------------------------------------


def _mean(values):
    return float(np.mean(values))


def test_bootstrap_is_deterministic_for_a_fixed_seed():
    values = np.arange(40, dtype=float)
    groups = np.arange(40) // 2
    first = bootstrap_ci(_mean, groups, values)
    second = bootstrap_ci(_mean, groups, values)
    assert first == second


def test_bootstrap_default_seed_is_42_with_1000_resamples():
    values = np.arange(40, dtype=float)
    groups = np.arange(40) // 2
    assert bootstrap_ci(_mean, groups, values) == bootstrap_ci(
        _mean, groups, values, n_resamples=1000, seed=42
    )


def test_bootstrap_changes_with_the_seed():
    values = np.arange(40, dtype=float)
    groups = np.arange(40) // 2
    assert bootstrap_ci(_mean, groups, values, seed=1) != bootstrap_ci(_mean, groups, values, seed=2)


def test_bootstrap_resamples_whole_identity_groups():
    sizes = []

    def record_size(values):
        sizes.append(len(values))
        return float(len(values))

    # Group "big" has 3 samples and "small" has 1: drawing 2 groups gives 6, 4 or 2 samples, never 5, 3 or 1.
    bootstrap_ci(record_size, ["big", "big", "big", "small"], np.arange(4.0), n_resamples=200)
    assert set(sizes[1:]) <= {2, 4, 6}
    assert {2, 4, 6} <= set(sizes[1:])


def test_bootstrap_interval_brackets_the_estimate():
    values = np.arange(40, dtype=float)
    result = bootstrap_ci(_mean, np.arange(40), values)
    assert result.estimate == pytest.approx(19.5)
    assert result.low <= result.estimate <= result.high


def test_bootstrap_interval_narrows_with_more_data():
    def width(samples):
        values = np.tile([0.0, 1.0], samples // 2)
        result = bootstrap_ci(_mean, np.arange(samples), values)
        return result.high - result.low

    assert width(400) < width(40)


def test_bootstrap_passes_every_array_resampled_together():
    labels = np.array([1, 1, 0, 0, 1, 0, 1, 0])
    scores = np.array([0.9, 0.8, 0.2, 0.1, 0.7, 0.3, 0.6, 0.4])
    result = bootstrap_ci(auc, np.arange(8), labels, scores)
    assert result.estimate == pytest.approx(1.0)
    assert result.high == pytest.approx(1.0)


def test_bootstrap_skips_degenerate_resamples():
    labels = np.array([1, 0, 0, 0, 0, 0, 0, 0])
    scores = np.linspace(1.0, 0.0, 8)
    # Resamples without the single positive raise inside `auc`; they are dropped, not fatal.
    result = bootstrap_ci(auc, np.arange(8), labels, scores)
    assert result.estimate == pytest.approx(1.0)


def test_bootstrap_raises_when_every_resample_is_degenerate():
    calls = []

    def fails_after_the_estimate(values):
        calls.append(1)
        if len(calls) > 1:
            raise ValueError("degenerate")
        return 0.0

    with pytest.raises(ValueError, match="every bootstrap resample"):
        bootstrap_ci(fails_after_the_estimate, [0, 1], np.arange(2.0), n_resamples=10)


def test_bootstrap_rejects_mismatched_lengths():
    with pytest.raises(ValueError, match="same length"):
        bootstrap_ci(_mean, [0, 1, 2], np.arange(4.0))


# --- latency_stats ---------------------------------------------------------------


def test_latency_p95_uses_linear_interpolation():
    # Position 0.95 * (100 - 1) = 94.05 between the 95th and 96th sorted values: 95 + 0.05 * 1.
    stats = latency_stats(range(1, 101))
    assert stats.p95 == pytest.approx(95.05)
    assert stats.median == pytest.approx(50.5)
    assert stats.mean == pytest.approx(50.5)


def test_latency_stats_of_one_sample():
    stats = latency_stats([12.5])
    assert (stats.median, stats.p95, stats.mean) == (12.5, 12.5, 12.5)


def test_latency_stats_rejects_empty_input():
    with pytest.raises(ValueError, match="at least one"):
        latency_stats([])


# --- balanced_accuracy, per_class_recall, false_accept_rate -------------------------


def test_balanced_accuracy_averages_class_recalls():
    # Positives: 3 of 4 right (0.75). Negatives: 1 of 2 right (0.5). Plain accuracy would be 4/6.
    y_true = [1, 1, 1, 1, 0, 0]
    y_pred = [1, 1, 1, 0, 0, 1]
    assert balanced_accuracy(y_true, y_pred) == pytest.approx(0.625)


def test_balanced_accuracy_is_one_for_a_perfect_classifier():
    assert balanced_accuracy(["a", "b", "b"], ["a", "b", "b"]) == pytest.approx(1.0)


def test_per_class_recall_reports_every_class_sorted():
    classes = ["rabbit", "rabbit", "turtle", "turtle", "turtle", "dog"]
    correct = [True, False, False, False, True, True]
    assert per_class_recall(classes, correct) == {
        "dog": 1.0,
        "rabbit": 0.5,
        "turtle": pytest.approx(1 / 3),
    }


def test_false_accept_rate_is_per_subclass():
    subclasses = ["plush", "plush", "plush", "plush", "drawing", "drawing", "object"]
    accepted = [True, True, False, False, True, False, False]
    assert false_accept_rate(subclasses, accepted) == {
        "drawing": 0.5,
        "object": 0.0,
        "plush": 0.5,
    }


@pytest.mark.parametrize("function", [per_class_recall, false_accept_rate])
def test_group_rates_reject_bad_input(function):
    with pytest.raises(ValueError, match="same length"):
        function(["a", "b"], [True])
    with pytest.raises(ValueError, match="at least one"):
        function([], [])


def test_balanced_accuracy_rejects_bad_input():
    with pytest.raises(ValueError, match="same length"):
        balanced_accuracy([1, 0], [1])


# --- top_k_hits and the similarity floor -------------------------------------------


def test_top_k_hits_returns_the_counts_behind_the_accuracy():
    assert top_k_hits(SIMILARITY, IDENTITIES, k=1) == (7, 8)
    assert top_k_hits(SIMILARITY, IDENTITIES, k=3) == (8, 8)


def test_top_k_hits_counts_only_queries_that_have_a_partner():
    points = np.append(POINTS, 9.0)
    similarity = -np.abs(points[:, None] - points[None, :])
    assert top_k_hits(similarity, IDENTITIES + ["E"], k=1) == (7, 8)


def test_a_similarity_floor_turns_far_partners_into_misses():
    # D1 and D2 are 0.65 apart (similarity -0.65): found in the top 3, but below the floor.
    assert top_k_accuracy(SIMILARITY, IDENTITIES, k=3, min_similarity=-0.2) == pytest.approx(6 / 8)
    assert top_k_hits(SIMILARITY, IDENTITIES, k=3, min_similarity=-0.2) == (6, 8)
    assert top_k_accuracy(SIMILARITY, IDENTITIES, k=3, min_similarity=-1.0) == pytest.approx(1.0)
