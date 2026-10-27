"""Pre-registered decision rule: replace only with disjoint CIs, p95 < 5000 ms and a CX01 record."""

import json
from pathlib import Path

import pytest

from benchmarks import findings
from benchmarks.findings import KEEP, NOT_EVALUATED, REPLACE, compare, decide, threshold_finding
from benchmarks.output import LIMITATION, write_json

BACKEND_IA = Path(__file__).resolve().parents[2]
APP_DIR = BACKEND_IA / "app"


def interval(low: float, high: float) -> dict:
    return {"estimate": (low + high) / 2, "low": low, "high": high}


def matching(variant: str, auc=(0.80, 0.85), tar=(0.30, 0.40), p95=900.0, gain=(0.0, -0.01, 0.01), status="evaluado"):
    if status != "evaluado":
        return {"variant": variant, "status": status, "reason": "offline"}
    return {
        "variant": variant, "status": status,
        "auc": interval(*auc), "tar_at_far_1pct": interval(*tar),
        "f1_gain_at_best_threshold": dict(zip(("estimate", "low", "high"), gain)),
        "at_best_threshold": {"threshold": 0.82, "f1": 0.9},
        "at_production_threshold": {"threshold": 0.75, "f1": 0.87},
        "performance": {"latency_ms": {"median": p95 / 2, "p95": p95, "mean": p95 / 2}},
    }


def moderation(variant: str, balanced=(0.80, 0.85), far=(0.10, 0.20), p95=300.0):
    return {
        "variant": variant, "status": "evaluado",
        "balanced_accuracy": interval(*balanced),
        "false_accept_rate": {"overall": interval(*far), "per_subclass": {}},
        "performance": {"latency_ms": {"median": p95 / 2, "p95": p95, "mean": p95 / 2}},
    }


BASE = matching("yolo_clip")


def test_disjoint_better_auc_fast_and_with_a_cx01_record_replaces():
    result = compare("matching", matching("dinov2", auc=(0.90, 0.95), p95=4999.0), BASE, cx01="docs/adr/0021-x.md")

    assert result.verdict == REPLACE
    assert result.beats and result.fast_enough and result.finding


def test_disjoint_better_tar_alone_is_enough_for_matching():
    result = compare("matching", matching("dinov2", tar=(0.45, 0.50)), BASE, cx01="ADR-0021")

    assert result.verdict == REPLACE


def test_without_a_cx01_record_the_result_is_keep_but_the_finding_is_written():
    result = compare("matching", matching("dinov2", auc=(0.90, 0.95)), BASE)

    assert result.verdict == KEEP
    assert result.finding  # conditions 1 and 2 hold: a finding and an issue draft, never a code change


@pytest.mark.parametrize("auc", [(0.84, 0.95), (0.85, 0.95)])  # overlapping, and touching at 0.85
def test_overlapping_intervals_mean_keep_and_no_replacement_finding(auc):
    result = compare("matching", matching("dinov2", auc=auc), BASE, cx01="ADR-0021")

    assert result.verdict == KEEP
    assert not result.beats and not result.finding


@pytest.mark.parametrize("p95", [5200.0, 5000.0])
def test_a_p95_of_5000_ms_or_more_means_keep(p95):
    result = compare("matching", matching("dinov2", auc=(0.90, 0.95), p95=p95), BASE, cx01="ADR-0021")

    assert result.verdict == KEEP
    assert result.beats and not result.fast_enough and not result.finding


def test_a_worse_alternative_with_disjoint_intervals_is_keep():
    result = compare("matching", matching("dinov2", auc=(0.60, 0.70), tar=(0.10, 0.20)), BASE, cx01="ADR-0021")

    assert result.verdict == KEEP and not result.beats


def test_moderation_needs_both_balanced_accuracy_and_false_accept_rate():
    base = moderation("yolo")
    both = moderation("clip", balanced=(0.90, 0.95), far=(0.01, 0.05))
    only_accuracy = moderation("clip", balanced=(0.90, 0.95), far=(0.10, 0.20))
    only_far = moderation("clip", far=(0.01, 0.05))

    assert compare("moderation", both, base, cx01="ADR-0021").verdict == REPLACE
    assert compare("moderation", only_accuracy, base, cx01="ADR-0021").verdict == KEEP
    assert compare("moderation", only_far, base, cx01="ADR-0021").verdict == KEEP


def test_a_variant_not_evaluated_is_reported_as_such():
    result = compare("matching", matching("dinov2", status="no evaluado"), BASE, cx01="ADR-0021")

    assert result.verdict == NOT_EVALUATED and not result.finding


@pytest.mark.parametrize(
    ("gain", "fires"),
    [
        ((0.03, 0.01, 0.05), True),
        ((0.02, 0.005, 0.04), True),  # exactly 0.02
        ((0.019, 0.005, 0.04), False),  # below 0.02
        ((0.05, -0.01, 0.10), False),  # CI includes 0
        ((0.05, 0.0, 0.10), False),  # CI touches 0
    ],
)
def test_threshold_finding_needs_a_gain_of_0_02_and_a_ci_excluding_0(gain, fires):
    assert threshold_finding(matching("yolo_clip", gain=gain)) is fires


def test_decide_compares_every_alternative_with_the_current_pipeline():
    summaries = {
        "matching": {
            "yolo_clip": matching("yolo_clip", gain=(0.03, 0.01, 0.05)),
            "clip_full": matching("clip_full"),
            "dinov2": matching("dinov2", auc=(0.90, 0.95)),
        },
        "moderation": {"yolo": moderation("yolo"), "clip": moderation("clip")},
    }

    result = decide(summaries, cx01={"dinov2": "ADR-0021"})

    assert [(c.task, c.alternative, c.baseline, c.verdict) for c in result.comparisons] == [
        ("matching", "clip_full", "yolo_clip", KEEP),
        ("matching", "dinov2", "yolo_clip", REPLACE),
        ("moderation", "clip", "yolo", KEEP),
    ]
    assert result.threshold == {"variant": "yolo_clip", "best_threshold": 0.82, "gain": summaries["matching"]["yolo_clip"]["f1_gain_at_best_threshold"]}


def test_a_missing_variant_is_not_evaluated_and_no_threshold_finding_without_the_baseline():
    result = decide({"matching": {"dinov2": matching("dinov2")}, "moderation": {}})

    assert {c.verdict for c in result.comparisons} == {NOT_EVALUATED}
    assert result.threshold is None


def test_the_hallazgos_block_states_verdicts_the_threshold_and_the_limitation():
    summaries = {
        "matching": {"yolo_clip": matching("yolo_clip", gain=(0.03, 0.01, 0.05)), "dinov2": matching("dinov2", auc=(0.90, 0.95))},
        "moderation": {"yolo": moderation("yolo"), "clip": moderation("clip")},
    }

    block = findings.hallazgos(decide(summaries))

    assert block.startswith("### Hallazgos")
    assert LIMITATION in block
    assert "dinov2 frente a yolo_clip: mantener" in block
    assert "sin registro CX01" in block
    assert "clip_full frente a yolo_clip: no evaluado" in block
    assert "umbral 0.82" in block


def app_snapshot() -> dict:
    return {path: path.stat().st_mtime_ns for path in APP_DIR.rglob("*") if path.is_file()}


def test_output_is_written_only_under_results_and_app_is_never_touched(tmp_path):
    results = tmp_path / "results"
    summaries = {"matching": {"yolo_clip": BASE}, "moderation": {"yolo": moderation("yolo")}}
    for task, variants in summaries.items():
        for variant, summary in variants.items():
            (results / task / variant).mkdir(parents=True)
            write_json(results / task / variant / "summary.json", summary)
    before = app_snapshot()
    existing = set(tmp_path.rglob("*"))

    written = findings.write(findings.decide(findings.load_summaries(results)), results)

    assert set(tmp_path.rglob("*")) - existing == set(written)
    assert sorted(path.name for path in written) == ["findings.json", "hallazgos.md"]
    assert all(path.parent == results for path in written)
    assert json.loads((results / "findings.json").read_text(encoding="utf-8"))["limitation"] == LIMITATION
    assert app_snapshot() == before


def test_the_guard_points_at_the_service_app_folder():
    assert findings.APP_DIR == APP_DIR


def test_writing_inside_app_is_refused(tmp_path, monkeypatch):
    fake_app = tmp_path / "app"  # a stand-in, so a broken guard never writes into the real app/
    fake_app.mkdir()
    monkeypatch.setattr(findings, "APP_DIR", fake_app)

    for target in (fake_app, fake_app / "results"):
        with pytest.raises(ValueError, match="app"):
            findings.write(findings.decide({"matching": {}, "moderation": {}}), target)

    assert list(fake_app.rglob("*")) == []
