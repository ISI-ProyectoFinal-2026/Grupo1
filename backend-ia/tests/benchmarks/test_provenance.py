"""Provenance record: git boundary, versions and manifest hash (subprocess patched, no real git run)."""

import hashlib
import os
import platform
import subprocess
import sys
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError
from pathlib import Path

import pytest

from benchmarks import provenance
from benchmarks.provenance import NOT_AVAILABLE, collect, manifest_sha256

COMMIT = "0123456789abcdef0123456789abcdef01234567"
GIT_COMMANDS = [["git", "rev-parse", "HEAD"], ["git", "status", "--porcelain"]]
BACKEND_IA = Path(__file__).resolve().parents[2]


class FakeGit:
    """Replaces `subprocess.run` and records every call."""

    def __init__(self, status_output="", returncode=0, error=None):
        self.status_output = status_output
        self.returncode = returncode
        self.error = error
        self.calls = []

    def __call__(self, argv, **kwargs):
        self.calls.append((list(argv), kwargs))
        if self.error:
            raise self.error
        stdout = COMMIT + "\n" if argv[1] == "rev-parse" else self.status_output
        return subprocess.CompletedProcess(argv, self.returncode, stdout=stdout, stderr="")


@pytest.fixture
def manifest(tmp_path):
    path = tmp_path / "manifest.csv"
    path.write_bytes(b"path,label\na.jpg,dog\n")
    return path


@pytest.fixture
def fake_git(monkeypatch):
    git = FakeGit()
    monkeypatch.setattr(provenance.subprocess, "run", git)
    return git


# --- git boundary (threat: repository selection) ---------------------------------


def test_repo_root_is_derived_from_the_module_file():
    assert provenance.REPO_ROOT == Path(provenance.__file__).resolve().parents[2]
    assert (provenance.REPO_ROOT / "backend-ia").is_dir()


def test_git_runs_fixed_commands_in_the_repo_root_without_a_shell(fake_git, manifest):
    collect(manifest_path=manifest)
    assert [argv for argv, _ in fake_git.calls] == GIT_COMMANDS
    for argv, kwargs in fake_git.calls:
        assert kwargs["cwd"] == provenance.REPO_ROOT
        assert "-C" not in argv
        assert not kwargs.get("shell", False)
        assert kwargs["timeout"] > 0


def test_commit_and_clean_tree(fake_git, manifest):
    record = collect(manifest_path=manifest)
    assert record["commit"] == COMMIT
    assert record["dirty"] is False


def test_dirty_flag_is_true_when_porcelain_lists_changes(monkeypatch, manifest):
    monkeypatch.setattr(provenance.subprocess, "run", FakeGit(status_output=" M backend-ia/x.py\n"))
    assert collect(manifest_path=manifest)["dirty"] is True


@pytest.mark.parametrize(
    "failure",
    [
        FakeGit(error=FileNotFoundError("git")),
        FakeGit(error=subprocess.TimeoutExpired("git", 10)),
        FakeGit(error=OSError("denied")),
        FakeGit(returncode=128),
    ],
    ids=["git-missing", "timeout", "os-error", "not-a-repository"],
)
def test_git_failure_records_not_available(monkeypatch, manifest, failure):
    monkeypatch.setattr(provenance.subprocess, "run", failure)
    record = collect(manifest_path=manifest)
    assert record["commit"] == NOT_AVAILABLE
    assert record["dirty"] == NOT_AVAILABLE


def test_not_available_is_the_spanish_marker():
    assert NOT_AVAILABLE == "No disponible"


# --- manifest hash -----------------------------------------------------------------


def test_manifest_sha256_matches_the_file_bytes(manifest):
    assert manifest_sha256(manifest) == hashlib.sha256(manifest.read_bytes()).hexdigest()


def test_missing_manifest_records_not_available(tmp_path):
    assert manifest_sha256(tmp_path / "absent.csv") == NOT_AVAILABLE


def test_default_manifest_is_the_dataset_manifest():
    assert provenance.DEFAULT_MANIFEST == BACKEND_IA / "benchmarks" / "datasets" / "manifest.csv"


# --- environment fields --------------------------------------------------------------


def test_environment_fields(fake_git, manifest, monkeypatch):
    monkeypatch.setattr(provenance, "version", lambda name: {"torch": "2.13.0"}[name])
    record = collect(models={"matching": "clip_full"}, seed=7, manifest_path=manifest)
    assert record["python"] == platform.python_version()
    assert record["torch"] == "2.13.0"
    assert record["platform"] == platform.platform()
    assert record["cpu"] == (platform.processor() or NOT_AVAILABLE)
    assert record["cpu_threads"] == os.cpu_count()
    assert record["models"] == {"matching": "clip_full"}
    assert record["seed"] == 7
    assert record["manifest_sha256"] == hashlib.sha256(manifest.read_bytes()).hexdigest()


def test_seed_defaults_to_42_and_models_to_empty(fake_git, manifest):
    record = collect(manifest_path=manifest)
    assert record["seed"] == 42
    assert record["models"] == {}


def test_missing_torch_records_not_available(fake_git, manifest, monkeypatch):
    def absent(name):
        raise PackageNotFoundError(name)

    monkeypatch.setattr(provenance, "version", absent)
    assert collect(manifest_path=manifest)["torch"] == NOT_AVAILABLE


def test_date_is_utc_iso_8601(fake_git, manifest):
    stamp = datetime.fromisoformat(collect(manifest_path=manifest)["date"])
    assert stamp.utcoffset() == timezone.utc.utcoffset(None)


def test_collect_reads_the_torch_version_without_importing_torch():
    probe = "import sys; from benchmarks.provenance import collect; collect(); sys.exit('torch' in sys.modules)"
    result = subprocess.run([sys.executable, "-c", probe], cwd=BACKEND_IA, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


# --- benchmark-only dependencies ---------------------------------------------------------


def test_benchmark_requirements_extend_the_service_and_pin_every_extra():
    lines = [
        line.strip()
        for line in (BACKEND_IA / "requirements-benchmark.txt").read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    assert lines[0] == "-r requirements.txt"
    extras = {line.split("==")[0].lower() for line in lines[1:]}
    assert extras == {"timm", "matplotlib", "psutil"}
    assert all("==" in line for line in lines[1:])
