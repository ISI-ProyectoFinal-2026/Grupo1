"""Provenance record stored with every benchmark run (environment.json).

Git is the only external boundary. It always runs from `REPO_ROOT`, which comes from this file's
location, with two fixed argument lists and no `-C`, no shell and no caller input. Anything that
cannot be read is recorded as "No disponible" instead of failing the run.
"""

import hashlib
import os
import platform
import subprocess
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any, Mapping

from benchmarks.metrics import DEFAULT_SEED

NOT_AVAILABLE = "No disponible"
REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = Path(__file__).resolve().parent / "datasets" / "manifest.csv"
GIT_TIMEOUT_SECONDS = 10
HASH_CHUNK_BYTES = 1024 * 1024


def _git(*arguments: str) -> str | None:
    """Standard output of a fixed git command, or None when git cannot answer."""
    try:
        completed = subprocess.run(
            ["git", *arguments],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=GIT_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return completed.stdout if completed.returncode == 0 else None


def _package_version(name: str) -> str:
    # Metadata lookup, not an import: importing torch would load a heavy runtime for one string.
    try:
        return version(name)
    except PackageNotFoundError:
        return NOT_AVAILABLE


def manifest_sha256(path: Path) -> str:
    """SHA-256 of the dataset manifest, which pins the exact images a run used."""
    digest = hashlib.sha256()
    try:
        with open(path, "rb") as handle:
            for chunk in iter(lambda: handle.read(HASH_CHUNK_BYTES), b""):
                digest.update(chunk)
    except OSError:
        return NOT_AVAILABLE
    return digest.hexdigest()


def collect(
    models: Mapping[str, str] | None = None,
    seed: int = DEFAULT_SEED,
    manifest_path: Path = DEFAULT_MANIFEST,
) -> dict[str, Any]:
    """Who, where and with what a benchmark ran: commit, dirty flag, versions, CPU, seed and data hash."""
    commit = _git("rev-parse", "HEAD")
    changes = _git("status", "--porcelain")
    return {
        "date": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "commit": commit.strip() if commit is not None else NOT_AVAILABLE,
        "dirty": bool(changes.strip()) if changes is not None else NOT_AVAILABLE,
        "python": platform.python_version(),
        "torch": _package_version("torch"),
        "platform": platform.platform(),
        "cpu": platform.processor() or NOT_AVAILABLE,
        "cpu_threads": os.cpu_count(),
        "models": dict(models or {}),
        "seed": seed,
        "manifest_sha256": manifest_sha256(manifest_path),
    }
