"""Register manually added moderation images in `datasets/manifest.csv`.

`download_datasets.py` rewrites the manifest with only the images it downloads (prefix `oi_`).
Images added by hand under `datasets/moderation/` are not in it, so the manifest-driven loader
would never see them. This step scans for them and rewrites the manifest sorted by path.
It is idempotent: manual rows are rebuilt from the files on disk on every run.

Usage (after download_datasets.py): python -m benchmarks.register_manual
"""

import csv
from pathlib import Path

from benchmarks.dataset import DATASETS_DIR

SOURCE = "Manual (recolección web)"
LICENSE = "No registrada"
AUTHOR = "Matías Alvarado"
TASK = "moderation"
DOWNLOADED_PREFIX = "oi_"
IMAGE_SUFFIXES = frozenset({".jpg", ".jpeg", ".png", ".webp"})
FIELDS = ["path", "task", "label", "source", "source_id", "license", "author", "original_url"]


def scan_manual(datasets_dir: Path = DATASETS_DIR) -> list[dict]:
    """Manifest rows for every moderation image that was not downloaded, sorted by path."""
    moderation = Path(datasets_dir) / TASK
    rows = [
        {
            "path": file.relative_to(datasets_dir).as_posix(),
            "task": TASK,
            "label": file.parent.relative_to(moderation).as_posix(),
            "source": SOURCE,
            "source_id": file.name,
            "license": LICENSE,
            "author": AUTHOR,
            "original_url": "",
        }
        for file in moderation.rglob("*")
        if file.is_file()
        and file.suffix.lower() in IMAGE_SUFFIXES
        and not file.name.lower().startswith(DOWNLOADED_PREFIX)
    ]
    return sorted(rows, key=lambda row: row["path"])


def register(datasets_dir: Path = DATASETS_DIR) -> int:
    """Rewrite the manifest with the current manual images and return how many there are."""
    manifest = Path(datasets_dir) / "manifest.csv"
    with open(manifest, newline="", encoding="utf-8") as handle:
        kept = [row for row in csv.DictReader(handle) if row["source"] != SOURCE]
    manual = scan_manual(datasets_dir)
    with open(manifest, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(sorted(kept + manual, key=lambda row: row["path"]))
    return len(manual)


def main() -> None:
    print(f"Manual images registered in the manifest: {register()}")


if __name__ == "__main__":
    main()
