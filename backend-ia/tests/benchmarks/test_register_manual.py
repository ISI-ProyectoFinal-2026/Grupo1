"""Manually added moderation images are registered in the manifest, reproducibly."""

import csv
from pathlib import Path

import pytest

from benchmarks.dataset import count_by_label, load_samples
from benchmarks.register_manual import (
    AUTHOR,
    LICENSE,
    SOURCE,
    register,
    scan_manual,
)

HEADER = ["path", "task", "label", "source", "source_id", "license", "author", "original_url"]
DOWNLOADED = {
    "path": "moderation/animal/dog/oi_abc.jpg",
    "task": "moderation",
    "label": "animal/dog",
    "source": "Open Images V7 (test)",
    "source_id": "abc",
    "license": "https://creativecommons.org/licenses/by/2.0/",
    "author": "Someone",
    "original_url": "https://example.org/abc",
}


def _touch(root: Path, relative: str) -> None:
    file = root / relative
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_bytes(b"x")


def _write_manifest(root: Path, rows: list[dict]) -> Path:
    manifest = root / "manifest.csv"
    with open(manifest, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADER)
        writer.writeheader()
        writer.writerows(rows)
    return manifest


def _read_manifest(root: Path) -> list[dict]:
    with open(root / "manifest.csv", newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


# --- scan_manual ---------------------------------------------------------------------


def test_scan_registers_non_downloaded_moderation_images(tmp_path):
    _touch(tmp_path, "moderation/no_animal/plush/bob.webp")

    assert scan_manual(tmp_path) == [
        {
            "path": "moderation/no_animal/plush/bob.webp",
            "task": "moderation",
            "label": "no_animal/plush",
            "source": "Manual (recolección web)",
            "source_id": "bob.webp",
            "license": "No registrada",
            "author": "Matías Alvarado",
            "original_url": "",
        }
    ]


def test_registration_constants_are_the_agreed_values():
    assert (SOURCE, LICENSE, AUTHOR) == ("Manual (recolección web)", "No registrada", "Matías Alvarado")


def test_scan_skips_downloaded_placeholders_and_non_images(tmp_path):
    _touch(tmp_path, "moderation/animal/dog/oi_abc.jpg")
    _touch(tmp_path, "moderation/animal/dog/.gitkeep")
    _touch(tmp_path, "moderation/animal/dog/notes.txt")
    _touch(tmp_path, "moderation/animal/dog/real.jpg")

    assert [row["path"] for row in scan_manual(tmp_path)] == ["moderation/animal/dog/real.jpg"]


def test_scan_ignores_matching_images(tmp_path):
    _touch(tmp_path, "matching/dog_dfn_0001/01.jpg")
    _touch(tmp_path, "matching/dog_0001/01.jpg")

    assert scan_manual(tmp_path) == []


@pytest.mark.parametrize("name", ["a.jpg", "a.JPEG", "a.png", "a.WebP"])
def test_scan_accepts_every_image_format_case_insensitively(tmp_path, name):
    _touch(tmp_path, f"moderation/no_animal/drawing/{name}")

    assert [row["source_id"] for row in scan_manual(tmp_path)] == [name]


def test_scan_is_sorted_by_path_not_by_discovery_order(tmp_path):
    for relative in ["moderation/no_animal/plush/b.webp", "moderation/animal/cat/z.jpg", "moderation/no_animal/plush/a.webp"]:
        _touch(tmp_path, relative)

    assert [row["path"] for row in scan_manual(tmp_path)] == [
        "moderation/animal/cat/z.jpg",
        "moderation/no_animal/plush/a.webp",
        "moderation/no_animal/plush/b.webp",
    ]


def test_scan_without_a_moderation_folder_finds_nothing(tmp_path):
    assert scan_manual(tmp_path) == []


# --- register ------------------------------------------------------------------------


def test_register_adds_manual_rows_and_keeps_downloaded_ones(tmp_path):
    _write_manifest(tmp_path, [DOWNLOADED])
    _touch(tmp_path, "moderation/no_animal/plush/bob.webp")

    added = register(tmp_path)

    rows = _read_manifest(tmp_path)
    assert added == 1
    assert [row["path"] for row in rows] == [
        "moderation/animal/dog/oi_abc.jpg",
        "moderation/no_animal/plush/bob.webp",
    ]
    assert rows[0] == DOWNLOADED


def test_register_is_idempotent_byte_for_byte(tmp_path):
    _write_manifest(tmp_path, [DOWNLOADED])
    _touch(tmp_path, "moderation/no_animal/plush/bob.webp")
    _touch(tmp_path, "moderation/no_animal/drawing/draw.webp")

    register(tmp_path)
    first = (tmp_path / "manifest.csv").read_bytes()
    register(tmp_path)

    assert (tmp_path / "manifest.csv").read_bytes() == first


def test_register_drops_manual_rows_whose_file_was_removed(tmp_path):
    _write_manifest(tmp_path, [DOWNLOADED])
    _touch(tmp_path, "moderation/no_animal/plush/bob.webp")
    register(tmp_path)

    (tmp_path / "moderation/no_animal/plush/bob.webp").unlink()
    register(tmp_path)

    assert [row["path"] for row in _read_manifest(tmp_path)] == ["moderation/animal/dog/oi_abc.jpg"]


def test_register_keeps_the_manifest_sorted_by_path(tmp_path):
    later = {**DOWNLOADED, "path": "moderation/no_animal/person/oi_zzz.jpg", "label": "no_animal/person"}
    _write_manifest(tmp_path, [later, DOWNLOADED])
    _touch(tmp_path, "moderation/no_animal/object/mine.jpg")

    register(tmp_path)

    paths = [row["path"] for row in _read_manifest(tmp_path)]
    assert paths == sorted(paths)


def test_registered_images_reach_the_loader(tmp_path):
    _touch(tmp_path, "moderation/animal/dog/oi_abc.jpg")
    _write_manifest(tmp_path, [DOWNLOADED])
    for index in range(3):
        _touch(tmp_path, f"moderation/no_animal/plush/p{index}.webp")
    _touch(tmp_path, "moderation/no_animal/drawing/d.webp")

    register(tmp_path)

    counts = count_by_label(load_samples(tmp_path / "manifest.csv", task="moderation"))
    assert counts[("moderation", "no_animal/plush")] == 3
    assert counts[("moderation", "no_animal/drawing")] == 1
    assert counts[("moderation", "animal/dog")] == 1


def test_register_fails_before_writing_when_the_manifest_is_missing(tmp_path):
    _touch(tmp_path, "moderation/no_animal/plush/bob.webp")

    with pytest.raises(FileNotFoundError):
        register(tmp_path)

    assert not (tmp_path / "manifest.csv").exists()
