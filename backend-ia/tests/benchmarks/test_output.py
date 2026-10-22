"""Result writing: atomic directories, JSON and CSV that carry the dataset limitation (tmp_path only)."""

import json

import pytest

from benchmarks import output
from benchmarks.output import (
    LIMITATION,
    atomic_directory,
    read_csv,
    write_csv,
    write_environment,
    write_json,
)


def test_the_limitation_states_both_declared_gaps():
    assert "face crops" in LIMITATION
    assert "screenshot" in LIMITATION


def test_atomic_directory_publishes_the_files_and_leaves_nothing_else(tmp_path):
    final = tmp_path / "matching" / "clip_full"

    with atomic_directory(final) as staging:
        assert staging != final
        (staging / "summary.json").write_text("{}")

    assert [path.name for path in final.iterdir()] == ["summary.json"]
    assert [path.name for path in final.parent.iterdir()] == ["clip_full"]


def test_an_error_inside_leaves_no_partial_directory(tmp_path):
    final = tmp_path / "matching" / "clip_full"

    with pytest.raises(RuntimeError, match="boom"):
        with atomic_directory(final) as staging:
            (staging / "summary.json").write_text("{}")
            raise RuntimeError("boom")

    assert not final.exists()
    assert list(final.parent.iterdir()) == []


def test_a_new_run_replaces_the_previous_results_entirely(tmp_path):
    final = tmp_path / "clip_full"
    with atomic_directory(final) as staging:
        (staging / "old.csv").write_text("old")

    with atomic_directory(final) as staging:
        (staging / "new.csv").write_text("new")

    assert [path.name for path in final.iterdir()] == ["new.csv"]


def test_a_failed_rerun_keeps_the_previous_results(tmp_path):
    final = tmp_path / "clip_full"
    with atomic_directory(final) as staging:
        (staging / "old.csv").write_text("old")

    with pytest.raises(RuntimeError):
        with atomic_directory(final) as staging:
            raise RuntimeError("boom")

    assert (final / "old.csv").read_text() == "old"
    assert [path.name for path in tmp_path.iterdir()] == ["clip_full"]


def test_write_json_is_readable_ordered_and_rejects_nan(tmp_path):
    path = tmp_path / "summary.json"

    write_json(path, {"b": 1, "a": [0.5, None]})

    assert json.loads(path.read_text(encoding="utf-8")) == {"b": 1, "a": [0.5, None]}
    assert list(json.loads(path.read_text(encoding="utf-8"))) == ["b", "a"]
    with pytest.raises(ValueError):
        write_json(tmp_path / "bad.json", {"x": float("nan")})


def test_csv_starts_with_the_limitation_and_reads_back_as_rows(tmp_path):
    path = tmp_path / "curve.csv"

    write_csv(path, ["fpr", "tpr"], [(0.0, 0.0), (0.5, 1.0)])

    assert path.read_text(encoding="utf-8").splitlines()[0] == f"# {LIMITATION}"
    assert read_csv(path) == [{"fpr": "0.0", "tpr": "0.0"}, {"fpr": "0.5", "tpr": "1.0"}]


def test_csv_with_a_comma_in_a_cell_survives_the_round_trip(tmp_path):
    path = tmp_path / "scores.csv"

    write_csv(path, ["path", "label"], [("a,b.jpg", "animal/dog")])

    assert read_csv(path) == [{"path": "a,b.jpg", "label": "animal/dog"}]


def test_environment_json_holds_the_provenance_and_the_limitation(tmp_path, monkeypatch):
    recorded = {}

    def collect(models, seed):
        recorded.update(models=models, seed=seed)
        return {"commit": "abc123", "seed": seed}

    monkeypatch.setattr(output, "collect", collect)

    write_environment(tmp_path, models={"clip": "ViT-B-32"}, seed=7)

    saved = json.loads((tmp_path / "environment.json").read_text(encoding="utf-8"))
    assert saved == {"commit": "abc123", "seed": 7, "limitation": LIMITATION}
    assert recorded == {"models": {"clip": "ViT-B-32"}, "seed": 7}
