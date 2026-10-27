"""run_all: one subprocess per allowlisted variant (subprocess.run patched), results published atomically."""

import json
import subprocess
import sys
from pathlib import Path

import pytest

from benchmarks import run_all
from benchmarks.embedders import EMBEDDERS
from benchmarks.moderators import MODERATORS
from benchmarks.output import write_json
from benchmarks.plots import CHARTS
from tests.benchmarks import test_findings, test_plots

EXPECTED = [
    ("matching", "clip_full"), ("matching", "yolo_clip"), ("matching", "dinov2"),
    ("moderation", "yolo"), ("moderation", "clip"),
]


class FakeRun:
    """Stands in for subprocess.run: records each call and writes the summary the runner would write."""

    def __init__(self, statuses=None, returncodes=None, writer=None):
        self.calls = []
        self.statuses = statuses or {}
        self.returncodes = returncodes or {}
        self.writer = writer

    def __call__(self, argv, **kwargs):
        self.calls.append((list(argv), kwargs))
        variant = argv[argv.index("--variant") + 1]
        output = Path(argv[argv.index("--output-dir") + 1])
        code = self.returncodes.get(variant, 0)
        task = argv[2].removeprefix("benchmarks.run_")
        if self.writer:
            self.writer(output.parent.parent, task, variant)
        elif code == 0:
            output.mkdir(parents=True)
            status = self.statuses.get(variant, "evaluado")
            write_json(output / "summary.json", {"variant": variant, "status": status, "reason": "offline" if status != "evaluado" else None})
        return subprocess.CompletedProcess(argv, code)


@pytest.fixture
def fake(monkeypatch):
    def install(**options):
        runner = FakeRun(**options)
        monkeypatch.setattr(run_all.subprocess, "run", runner)
        return runner

    return install


@pytest.fixture
def reports(monkeypatch):
    seen = []

    def publish(staging, cx01=None):
        seen.append((staging, sorted(p.relative_to(staging).as_posix() for p in staging.rglob("summary.json"))))
        (staging / "hallazgos.md").write_text("### Hallazgos\n", encoding="utf-8")

    monkeypatch.setattr(run_all, "publish_reports", publish)
    return seen


def test_the_allowlist_is_fixed_and_matches_the_runner_registries():
    assert [(task, variant) for task, variants in run_all.ALLOWLIST.items() for variant in variants] == EXPECTED
    assert set(run_all.ALLOWLIST["matching"]) == set(EMBEDDERS)
    assert set(run_all.ALLOWLIST["moderation"]) == set(MODERATORS)


def test_argv_uses_the_current_interpreter_as_a_module_and_nothing_else(tmp_path):
    argv = run_all.build_argv("matching", "dinov2", tmp_path / "out")

    assert argv == [sys.executable, "-m", "benchmarks.run_matching", "--variant", "dinov2", "--output-dir", str(tmp_path / "out")]


@pytest.mark.parametrize(
    ("task", "variant"),
    [("matching", "yolo"), ("moderation", "dinov2"), ("matching", "clip_full; rm -rf /"), ("training", "clip"), ("matching", "")],
)
def test_a_variant_outside_the_allowlist_raises(task, variant, tmp_path):
    with pytest.raises(ValueError):
        run_all.build_argv(task, variant, tmp_path)


def test_every_variant_runs_in_its_own_process_without_a_shell(tmp_path, fake, reports):
    runner = fake()

    run_all.run_all(tmp_path / "results")

    assert [(argv[2].removeprefix("benchmarks.run_"), argv[4]) for argv, _ in runner.calls] == EXPECTED
    for argv, kwargs in runner.calls:
        assert argv[:2] == [sys.executable, "-m"]
        assert kwargs["shell"] is False
        assert kwargs["cwd"] == run_all.BACKEND_DIR
        assert kwargs["check"] is False


def test_a_variant_not_evaluated_is_recorded_and_the_run_continues(tmp_path, fake, reports):
    fake(statuses={"dinov2": "no evaluado"})

    records = run_all.run_all(tmp_path / "results")

    assert [(r["task"], r["variant"], r["status"]) for r in records] == [
        (task, variant, "no evaluado" if variant == "dinov2" else "evaluado") for task, variant in EXPECTED
    ]
    saved = json.loads((tmp_path / "results" / "run_all.json").read_text(encoding="utf-8"))
    assert saved["variants"] == records
    assert "limitation" in saved


def test_results_are_built_in_a_staging_directory_and_then_renamed(tmp_path, fake, reports):
    fake()
    final = tmp_path / "results"

    run_all.run_all(final)

    staging, summaries = reports[0]
    assert staging != final and staging.parent == final.parent  # reports were built before the rename
    assert len(summaries) == len(EXPECTED)
    assert not staging.exists()
    assert (final / "hallazgos.md").exists()
    assert sorted(p.parent.relative_to(final).as_posix() for p in final.rglob("summary.json")) == sorted(
        f"{task}/{variant}" for task, variant in EXPECTED
    )


def test_a_crashed_runner_aborts_and_keeps_the_previous_results(tmp_path, fake, reports):
    final = tmp_path / "results"
    final.mkdir()
    (final / "previous.txt").write_text("old", encoding="utf-8")
    runner = fake(returncodes={"yolo_clip": 1})

    with pytest.raises(RuntimeError, match="yolo_clip"):
        run_all.run_all(final)

    assert len(runner.calls) == 2  # stops at the crash
    assert [p.name for p in tmp_path.iterdir()] == ["results"]
    assert [p.name for p in final.iterdir()] == ["previous.txt"]


def test_dry_run_lists_the_five_allowlisted_commands_and_runs_nothing(tmp_path, fake, capsys):
    runner = fake()

    run_all.main(["--dry-run", "--results-dir", str(tmp_path / "results")])

    lines = capsys.readouterr().out.strip().splitlines()
    assert len(lines) == len(EXPECTED)
    assert all(f"--variant {variant} " in line for line, (_, variant) in zip(lines, EXPECTED))
    assert runner.calls == []
    assert not (tmp_path / "results").exists()


def test_a_runner_that_exits_0_without_a_summary_aborts(tmp_path, fake, reports):
    fake(writer=lambda root, task, variant: None)

    with pytest.raises(RuntimeError, match="clip_full"):
        run_all.run_all(tmp_path / "results")

    assert list(tmp_path.iterdir()) == []


def full_variant(root: Path, task: str, variant: str) -> None:
    if task == "matching":
        summary = {**test_findings.matching(variant), **test_plots.matching_summary(variant)}
    else:
        summary = {**test_findings.moderation(variant), **test_plots.moderation_summary(variant)}
    test_plots.write_variant(root, task, summary)


def test_the_published_results_hold_the_charts_and_the_findings(tmp_path, fake):
    fake(writer=full_variant)
    final = tmp_path / "results"

    run_all.run_all(final)

    assert sorted(p.name for p in (final / "plots").iterdir()) == sorted(CHARTS)
    assert (final / "hallazgos.md").read_text(encoding="utf-8").startswith("### Hallazgos")
    assert json.loads((final / "findings.json").read_text(encoding="utf-8"))["threshold_status"] == "sin hallazgo"


def test_a_non_zero_exit_aborts_even_if_a_summary_was_written(tmp_path, fake, reports):
    fake(writer=full_variant, returncodes={"yolo": 1})

    with pytest.raises(RuntimeError, match="moderation/yolo"):
        run_all.run_all(tmp_path / "results")

    assert list(tmp_path.iterdir()) == []
