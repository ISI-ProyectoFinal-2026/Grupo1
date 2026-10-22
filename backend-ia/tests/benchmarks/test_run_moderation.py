"""Moderation evaluation checked against hand-computed values (fake decisions and scores)."""

import pytest

from benchmarks.run_moderation import evaluate

RESAMPLES = 40

# (label, accepted by the method, score). Six animals, four non-animals, by hand:
#   recall: dog 1/2, rabbit 2/2, turtle 0/2  ->  TP 3, FN 3
#   false accepts: plush 1/2, drawing 0/2    ->  FP 1, TN 3
#   balanced accuracy = (3/6 + 3/4) / 2 = 0.625
#   AUC: positives beat 4, 3, 4, 3, 3, 3 of the 4 negatives = 20/24
CASES = [
    ("animal/dog", True, 0.9),
    ("animal/dog", False, 0.2),
    ("animal/rabbit", True, 0.8),
    ("animal/rabbit", True, 0.6),
    ("animal/turtle", False, 0.3),
    ("animal/turtle", False, 0.1),
    ("no_animal/plush", True, 0.7),
    ("no_animal/plush", False, 0.05),
    ("no_animal/drawing", False, 0.02),
    ("no_animal/drawing", False, 0.01),
]


def run_evaluate(cases=CASES, **options):
    labels, accepted, scores = zip(*cases)
    return evaluate(list(labels), list(accepted), list(scores), n_resamples=RESAMPLES, **options)


def test_every_animal_class_has_its_own_recall_including_rabbit_and_turtle():
    summary = run_evaluate().summary

    assert summary["per_class_recall"] == {"animal/dog": 0.5, "animal/rabbit": 1.0, "animal/turtle": 0.0}


def test_false_accept_rate_is_reported_per_non_animal_subclass_and_overall():
    summary = run_evaluate().summary["false_accept_rate"]

    assert summary["per_subclass"] == {"drawing": 0.0, "plush": 0.5}
    assert summary["overall"]["estimate"] == pytest.approx(0.25)
    assert summary["overall"]["low"] <= summary["overall"]["high"]


def test_balanced_accuracy_confusion_matrix_and_auc():
    summary = run_evaluate().summary

    assert summary["balanced_accuracy"]["estimate"] == pytest.approx(0.625)
    assert summary["confusion_matrix"] == {"labels": ["animal", "no_animal"], "matrix": [[3, 3], [1, 3]]}
    assert summary["auc"]["estimate"] == pytest.approx(20 / 24)
    assert summary["images"] == {
        "total": 10,
        "animal": 6,
        "no_animal": 4,
        "per_class": {
            "animal/dog": 2, "animal/rabbit": 2, "animal/turtle": 2, "no_animal/drawing": 2, "no_animal/plush": 2,
        },
    }


def test_a_perfect_method_scores_one_everywhere():
    perfect = [(label, label.startswith("animal/"), 1.0 if label.startswith("animal/") else 0.0) for label, _, _ in CASES]

    summary = run_evaluate(perfect).summary

    assert summary["balanced_accuracy"]["estimate"] == 1.0
    assert summary["false_accept_rate"]["overall"]["estimate"] == 0.0
    assert summary["false_accept_rate"]["per_subclass"] == {"drawing": 0.0, "plush": 0.0}
    assert summary["auc"]["estimate"] == 1.0
    assert summary["confusion_matrix"]["matrix"] == [[6, 0], [0, 4]]


def test_the_roc_curve_runs_from_the_origin_to_the_corner():
    fpr, tpr, thresholds = run_evaluate().roc

    assert (fpr[0], tpr[0], thresholds[0]) == (0.0, 0.0, float("inf"))
    assert (fpr[-1], tpr[-1]) == (1.0, 1.0)


def test_the_same_seed_gives_the_same_intervals():
    assert run_evaluate().summary == run_evaluate().summary
    assert run_evaluate(seed=7).summary["balanced_accuracy"]["estimate"] == 0.625


def test_a_run_with_only_animals_raises_instead_of_reporting_a_number():
    with pytest.raises(ValueError, match="both classes"):
        run_evaluate([case for case in CASES if case[0].startswith("animal/")])
