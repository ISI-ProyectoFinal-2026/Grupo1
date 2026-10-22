"""Moderation runner driven by fake decisions and scores, checked against hand-computed values."""

import json
from pathlib import Path

import pytest

from benchmarks import output, run_moderation
from benchmarks.dataset import EXCLUSION_NOTE, Sample
from benchmarks.output import LIMITATION, read_csv
from benchmarks.run_moderation import evaluate, run

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


# --- run: adapters, profiling and the result files ---------------------------------


class FakeModerator:
    name = "fake"
    model_ids = {"fake": "fake-model"}

    def __init__(self, answers, fail_on=None):
        self.answers = answers
        self.fail_on = fail_on
        self.decisions = 0
        self.scored = 0

    def load(self):
        pass

    def decide(self, path):
        if path == self.fail_on:
            raise RuntimeError("moderation exploded")
        self.decisions += 1
        return self.answers[path][0]

    def score(self, path):
        self.scored += 1
        return self.answers[path][1]

    def model_size_mb(self):
        return 6.25


def fake_run_inputs():
    paths = [Path(f"moderation/{label}/{n}.jpg") for n, (label, _, _) in enumerate(CASES)]
    samples = [Sample(path, "moderation", label) for path, (label, _, _) in zip(paths, CASES)]
    return samples, {path: (accepted, score) for path, (_, accepted, score) in zip(paths, CASES)}


@pytest.fixture(autouse=True)
def fixed_provenance(monkeypatch):
    monkeypatch.setattr(output, "collect", lambda models, seed: {"commit": "abc123", "models": models, "seed": seed})


def test_run_writes_the_summary_per_class_table_scores_roc_and_environment(tmp_path):
    samples, answers = fake_run_inputs()
    moderator = FakeModerator(answers)

    summary = run(moderator, samples, tmp_path / "fake", n_resamples=RESAMPLES)

    written = json.loads((tmp_path / "fake" / "summary.json").read_text(encoding="utf-8"))
    assert written == json.loads(json.dumps(summary))
    assert {path.name for path in (tmp_path / "fake").iterdir()} == {
        "summary.json", "per_class.csv", "scores.csv", "roc.csv", "environment.json",
    }
    assert (written["variant"], written["task"], written["status"]) == ("fake", "moderation", "evaluado")
    assert written["model_size_mb"] == 6.25
    assert set(written["performance"]["latency_ms"]) == {"median", "p95", "mean"}
    assert moderator.scored == len(samples)  # scored once per image, outside the timed warm-ups
    assert moderator.decisions > len(samples)  # the timed pass plus the warm-ups


def test_scores_csv_has_one_row_per_image_with_its_decision(tmp_path):
    samples, answers = fake_run_inputs()

    run(FakeModerator(answers), samples, tmp_path / "fake", n_resamples=RESAMPLES)

    rows = read_csv(tmp_path / "fake" / "scores.csv")
    assert len(rows) == 10
    assert rows[0] == {"image": "animal/dog/0.jpg", "label": "animal/dog", "score": "0.9", "accepted": "True"}
    assert rows[7] == {"image": "no_animal/plush/7.jpg", "label": "no_animal/plush", "score": "0.05", "accepted": "False"}


def test_per_class_csv_lists_recall_for_animals_and_false_accepts_for_the_rest(tmp_path):
    samples, answers = fake_run_inputs()

    run(FakeModerator(answers), samples, tmp_path / "fake", n_resamples=RESAMPLES)

    rows = {row["class"]: row for row in read_csv(tmp_path / "fake" / "per_class.csv")}
    assert set(rows) == {"animal/dog", "animal/rabbit", "animal/turtle", "no_animal/drawing", "no_animal/plush"}
    assert (rows["animal/turtle"]["metric"], rows["animal/turtle"]["images"], rows["animal/turtle"]["rate"]) == ("recall", "2", "0.0")
    assert (rows["no_animal/plush"]["metric"], rows["no_animal/plush"]["rate"]) == ("false_accept_rate", "0.5")


def test_every_output_states_the_limitation_and_the_excluded_class(tmp_path):
    samples, answers = fake_run_inputs()

    run(FakeModerator(answers), samples, tmp_path / "fake", n_resamples=RESAMPLES)

    summary = json.loads((tmp_path / "fake" / "summary.json").read_text(encoding="utf-8"))
    assert summary["limitation"] == LIMITATION
    assert summary["excluded"] == EXCLUSION_NOTE
    assert json.loads((tmp_path / "fake" / "environment.json").read_text(encoding="utf-8"))["limitation"] == LIMITATION
    for name in ("per_class.csv", "scores.csv", "roc.csv"):
        assert (tmp_path / "fake" / name).read_text(encoding="utf-8").startswith(f"# {LIMITATION}\n")
    assert "screenshot" not in " ".join(summary["images"]["per_class"])


def test_the_same_inputs_give_the_same_files_apart_from_timings(tmp_path):
    samples, answers = fake_run_inputs()

    run(FakeModerator(answers), samples, tmp_path / "first", n_resamples=RESAMPLES)
    run(FakeModerator(answers), samples, tmp_path / "second", n_resamples=RESAMPLES)

    def comparable(folder):
        summary = json.loads((folder / "summary.json").read_text(encoding="utf-8"))
        summary.pop("performance")
        return summary

    assert comparable(tmp_path / "first") == comparable(tmp_path / "second")
    for name in ("per_class.csv", "scores.csv", "roc.csv"):
        assert (tmp_path / "first" / name).read_bytes() == (tmp_path / "second" / name).read_bytes()


def test_an_error_mid_run_leaves_no_partial_directory(tmp_path):
    samples, answers = fake_run_inputs()
    moderator = FakeModerator(answers, fail_on=samples[3].path)

    with pytest.raises(RuntimeError, match="exploded"):
        run(moderator, samples, tmp_path / "results" / "fake", n_resamples=RESAMPLES)

    assert list((tmp_path / "results").iterdir()) == []


# --- main: command line -----------------------------------------------------------


def make_dataset(root, labels):
    """A manifest plus empty files for every label that is not the empty screenshot class."""
    rows = [f"moderation/{label}/{n}.jpg,moderation,{label}" for label in labels for n in range(3)]
    (root / "manifest.csv").write_text("path,task,label\n" + "\n".join(rows) + "\n", encoding="utf-8")
    for row in rows:
        file = root / row.split(",")[0]
        if "screenshot" not in str(file):
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(b"x")
    return root / "manifest.csv"


def fake_moderator_class(seen):
    class Everything:
        name = "fake"
        model_ids = {}

        def load(self):
            pass

        def decide(self, path):
            return "no_animal" not in path.parts[-3:-1] and "animal" in path.parts[-3:-1]

        def score(self, path):
            seen.append(path)
            return 0.9 if self.decide(path) else 0.1

        def model_size_mb(self):
            return 1.0

    return Everything


def test_main_leaves_out_the_screenshot_class_and_says_so(tmp_path, monkeypatch):
    manifest = make_dataset(tmp_path, ["animal/dog", "no_animal/plush", "no_animal/screenshot"])
    monkeypatch.setattr(run_moderation, "MODERATORS", {"fake": fake_moderator_class([])})

    run_moderation.main(["--variant", "fake", "--manifest", str(manifest), "--output-dir", str(tmp_path / "out"), "--resamples", "40"])

    summary = json.loads((tmp_path / "out" / "summary.json").read_text(encoding="utf-8"))
    assert summary["images"]["per_class"] == {"animal/dog": 3, "no_animal/plush": 3}
    assert summary["excluded"] == EXCLUSION_NOTE


def test_main_limit_keeps_the_first_images_of_every_class(tmp_path, monkeypatch):
    manifest = make_dataset(tmp_path, ["animal/dog", "animal/cat", "no_animal/plush"])
    seen = []
    monkeypatch.setattr(run_moderation, "MODERATORS", {"fake": fake_moderator_class(seen)})

    run_moderation.main(
        ["--variant", "fake", "--manifest", str(manifest), "--output-dir", str(tmp_path / "out"), "--limit", "2", "--resamples", "40"]
    )

    summary = json.loads((tmp_path / "out" / "summary.json").read_text(encoding="utf-8"))
    assert summary["images"]["per_class"] == {"animal/cat": 2, "animal/dog": 2, "no_animal/plush": 2}
    assert len(seen) == 6


def test_main_stops_before_running_when_images_are_missing(tmp_path, monkeypatch):
    manifest = tmp_path / "manifest.csv"
    manifest.write_text("path,task,label\nmoderation/animal/dog/0.jpg,moderation,animal/dog\n", encoding="utf-8")
    monkeypatch.setattr(run_moderation, "MODERATORS", {"fake": lambda: pytest.fail("must not be built")})

    with pytest.raises(SystemExit, match="download_datasets.py"):
        run_moderation.main(["--variant", "fake", "--manifest", str(manifest), "--output-dir", str(tmp_path / "out")])

    assert not (tmp_path / "out").exists()
