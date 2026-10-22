"""Manifest-driven dataset loader: sorted, excludes the empty class, fails fast."""

import csv
from pathlib import Path

import pytest

from benchmarks.dataset import (
    DatasetMissingError,
    count_by_label,
    load_samples,
)

HEADER = ["path", "task", "label", "source", "source_id", "license", "author", "original_url"]


def _write_dataset(root: Path, rows: list[tuple[str, str, str]], *, create: bool = True) -> Path:
    """Write a manifest under `root` from (path, task, label) rows and, by default, the files."""
    manifest = root / "manifest.csv"
    with open(manifest, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(HEADER)
        for path, task, label in rows:
            writer.writerow([path, task, label, "src", "id", "CC BY 4.0", "author", "http://x"])
            if create:
                file = root / path
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(b"x")
    return manifest


def test_samples_are_sorted_by_path_regardless_of_manifest_order(tmp_path):
    manifest = _write_dataset(
        tmp_path,
        [
            ("matching/dog_b/02.jpg", "matching", "dog_b"),
            ("matching/dog_a/02.jpg", "matching", "dog_a"),
            ("matching/dog_b/01.jpg", "matching", "dog_b"),
            ("matching/dog_a/01.jpg", "matching", "dog_a"),
        ],
    )

    samples = load_samples(manifest)

    assert [s.path for s in samples] == [
        tmp_path / "matching/dog_a/01.jpg",
        tmp_path / "matching/dog_a/02.jpg",
        tmp_path / "matching/dog_b/01.jpg",
        tmp_path / "matching/dog_b/02.jpg",
    ]
    assert [s.label for s in samples] == ["dog_a", "dog_a", "dog_b", "dog_b"]
    assert {s.task for s in samples} == {"matching"}


def test_order_is_identical_for_a_reversed_manifest(tmp_path):
    rows = [
        ("moderation/animal/dog/a.jpg", "moderation", "animal/dog"),
        ("moderation/animal/cat/b.jpg", "moderation", "animal/cat"),
        ("matching/dog_a/01.jpg", "matching", "dog_a"),
    ]
    forward = load_samples(_write_dataset(tmp_path, rows))
    backward = load_samples(_write_dataset(tmp_path, rows[::-1]))

    assert [s.path for s in forward] == [s.path for s in backward]
    assert forward[0].path == tmp_path / "matching/dog_a/01.jpg"


def test_only_manifest_files_are_returned_not_everything_on_disk(tmp_path):
    manifest = _write_dataset(tmp_path, [("matching/dog_a/01.jpg", "matching", "dog_a")])
    stray = tmp_path / "matching/dog_a/stray.jpg"
    stray.write_bytes(b"x")

    samples = load_samples(manifest)

    assert [s.path for s in samples] == [tmp_path / "matching/dog_a/01.jpg"]


def test_screenshot_class_is_excluded_even_when_listed(tmp_path):
    manifest = _write_dataset(
        tmp_path,
        [
            ("moderation/animal/dog/a.jpg", "moderation", "animal/dog"),
            ("moderation/no_animal/screenshot/s.jpg", "moderation", "no_animal/screenshot"),
            ("moderation/no_animal/plush/p.jpg", "moderation", "no_animal/plush"),
        ],
    )

    samples = load_samples(manifest)

    assert [s.label for s in samples] == ["animal/dog", "no_animal/plush"]


def test_excluded_class_does_not_need_its_files_on_disk(tmp_path):
    manifest = _write_dataset(
        tmp_path,
        [
            ("moderation/animal/dog/a.jpg", "moderation", "animal/dog"),
            ("moderation/no_animal/screenshot/s.jpg", "moderation", "no_animal/screenshot"),
        ],
    )
    (tmp_path / "moderation/no_animal/screenshot/s.jpg").unlink()

    samples = load_samples(manifest)

    assert [s.label for s in samples] == ["animal/dog"]


def test_task_filter_keeps_only_the_requested_task(tmp_path):
    manifest = _write_dataset(
        tmp_path,
        [
            ("matching/dog_a/01.jpg", "matching", "dog_a"),
            ("moderation/animal/dog/a.jpg", "moderation", "animal/dog"),
        ],
    )

    assert [s.label for s in load_samples(manifest, task="matching")] == ["dog_a"]
    assert [s.label for s in load_samples(manifest, task="moderation")] == ["animal/dog"]


def test_missing_file_fails_before_returning_and_names_path_and_script(tmp_path):
    manifest = _write_dataset(
        tmp_path,
        [
            ("matching/dog_a/01.jpg", "matching", "dog_a"),
            ("matching/dog_a/02.jpg", "matching", "dog_a"),
        ],
    )
    (tmp_path / "matching/dog_a/02.jpg").unlink()

    with pytest.raises(DatasetMissingError) as error:
        load_samples(manifest)

    message = str(error.value)
    assert "matching/dog_a/02.jpg" in message
    assert "download_datasets.py" in message
    assert "1 file(s)" in message


def test_missing_report_counts_every_missing_file(tmp_path):
    manifest = _write_dataset(
        tmp_path,
        [
            ("matching/dog_a/01.jpg", "matching", "dog_a"),
            ("matching/dog_b/01.jpg", "matching", "dog_b"),
            ("matching/dog_c/01.jpg", "matching", "dog_c"),
        ],
        create=False,
    )

    with pytest.raises(DatasetMissingError, match=r"3 file\(s\)"):
        load_samples(manifest)


def test_count_by_label_groups_and_sorts(tmp_path):
    manifest = _write_dataset(
        tmp_path,
        [
            ("moderation/animal/dog/a.jpg", "moderation", "animal/dog"),
            ("moderation/animal/dog/b.jpg", "moderation", "animal/dog"),
            ("moderation/animal/cat/c.jpg", "moderation", "animal/cat"),
        ],
    )

    counts = count_by_label(load_samples(manifest))

    assert counts == {("moderation", "animal/cat"): 1, ("moderation", "animal/dog"): 2}
    assert list(counts) == [("moderation", "animal/cat"), ("moderation", "animal/dog")]
