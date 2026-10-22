"""Manifest-driven dataset loader.

Image lists come only from `datasets/manifest.csv`; the folders on disk are
never scanned. Run `python -m benchmarks.dataset` to print counts per class.
"""

import csv
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

DATASETS_DIR = Path(__file__).resolve().parent / "datasets"
DEFAULT_MANIFEST = DATASETS_DIR / "manifest.csv"
DOWNLOAD_SCRIPT = "benchmarks/download_datasets.py"

# `no_animal/screenshot` has no images; it is dropped from every run and output.
EXCLUDED_LABELS = frozenset({"no_animal/screenshot"})
EXCLUSION_NOTE = "Class no_animal/screenshot is excluded: it has no images."

MAX_MISSING_SHOWN = 5


class DatasetMissingError(FileNotFoundError):
    """Files listed in the manifest are not on disk."""


@dataclass(frozen=True)
class Sample:
    path: Path
    task: str
    label: str


def load_samples(manifest: Path = DEFAULT_MANIFEST, task: str | None = None) -> list[Sample]:
    """Return the manifest samples sorted by path, or raise before returning anything
    if any listed file is missing. Paths are relative to the manifest folder."""
    root = Path(manifest).parent
    with open(manifest, newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    samples = [
        Sample(path=root / row["path"], task=row["task"], label=row["label"])
        for row in rows
        if row["label"] not in EXCLUDED_LABELS and (task is None or row["task"] == task)
    ]
    samples.sort(key=lambda sample: sample.path)

    missing = [sample.path for sample in samples if not sample.path.is_file()]
    if missing:
        shown = ", ".join(path.relative_to(root).as_posix() for path in missing[:MAX_MISSING_SHOWN])
        raise DatasetMissingError(
            f"{len(missing)} file(s) listed in {Path(manifest).name} are missing "
            f"(first: {shown}). Download them with: python {DOWNLOAD_SCRIPT}"
        )
    return samples


def count_by_label(samples: list[Sample]) -> dict[tuple[str, str], int]:
    """Number of samples per (task, label), ordered by key."""
    counts = Counter((sample.task, sample.label) for sample in samples)
    return dict(sorted(counts.items()))


def main() -> None:
    samples = load_samples()
    for (task, label), count in count_by_label(samples).items():
        print(f"{task}\t{label}\t{count}")
    print(f"total\t{len(samples)}")
    print(EXCLUSION_NOTE)


if __name__ == "__main__":
    main()
