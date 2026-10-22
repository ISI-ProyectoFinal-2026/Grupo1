"""Shared result writing: atomic directories and files that carry the dataset limitation."""

import csv
import json
import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Sequence

import numpy as np

from benchmarks.provenance import collect

RESULTS_DIR = Path(__file__).resolve().parent / "results"
LIMITATION = (
    "Dataset limitation: (a) DogFaceNet images are already face crops, so the matching benchmark measures "
    "face-level re-identification, not production crops (YOLO bounding box, background included); "
    "(b) the no_animal/screenshot class is empty and is excluded."
)
COMMENT_PREFIX = "# "
MAX_CURVE_POINTS = 1000
EVALUATED = "evaluado"
NOT_EVALUATED = "no evaluado"


@contextmanager
def atomic_directory(final: Path) -> Iterator[Path]:
    """Yield a staging directory next to `final` and rename it to `final` only if the block succeeds.

    A failure removes the staging directory and leaves any previous results untouched, so a run never
    leaves partial output.
    """
    final = Path(final)
    final.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(dir=final.parent, prefix=f".{final.name}."))
    try:
        yield staging
        if final.exists():
            shutil.rmtree(final)
        staging.rename(final)
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def write_json(path: Path, data: Any) -> None:
    text = json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False)
    Path(path).write_text(text + "\n", encoding="utf-8")


def write_csv(path: Path, header: Sequence[str], rows: Sequence[Sequence]) -> None:
    """CSV whose first line is the limitation as a comment; `read_csv` skips it."""
    with open(path, "w", newline="", encoding="utf-8") as handle:
        handle.write(f"{COMMENT_PREFIX}{LIMITATION}\n")
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)


def write_curve_csv(path: Path, header: Sequence[str], *columns: np.ndarray) -> None:
    """A curve as CSV, thinned to at most MAX_CURVE_POINTS evenly spaced rows that keep both ends.

    The full per-point data stays in the ignored raw/ folder; the committed curve is for plotting.
    """
    length = len(columns[0])
    keep = np.arange(length)
    if length > MAX_CURVE_POINTS:
        keep = np.unique(np.linspace(0, length - 1, MAX_CURVE_POINTS).round().astype(int))
    write_csv(path, header, list(zip(*(column[keep] for column in columns))))


def read_csv(path: Path) -> list[dict[str, str]]:
    with open(path, newline="", encoding="utf-8") as handle:
        lines = [line for line in handle if not line.startswith(COMMENT_PREFIX)]
    return list(csv.DictReader(lines))


def write_environment(directory: Path, models: dict[str, str], seed: int) -> None:
    write_json(Path(directory) / "environment.json", {**collect(models=models, seed=seed), "limitation": LIMITATION})
