"""Pre-registered decision rule (design.md, approved 2026-10-22) applied to the result files.

The output is a "Hallazgos" block and a JSON record under results/; it never changes app/, weights or the threshold.
"""

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path

from benchmarks.output import EVALUATED, LIMITATION, RESULTS_DIR, write_json
from benchmarks.run_matching import PRODUCTION_THRESHOLD

APP_DIR = Path(__file__).resolve().parents[1] / "app"
BASELINES = {"matching": "yolo_clip", "moderation": "yolo"}
ALTERNATIVES = {"matching": ("clip_full", "dinov2"), "moderation": ("clip",)}
P95_LIMIT_MS = 5000.0  # PDD v1.0
THRESHOLD_GAIN = 0.02
TOLERANCE = 1e-9
REPLACE, KEEP, NOT_EVALUATED = "reemplazar", "mantener", "no evaluado"
TASK_NAMES = {"matching": "Matching", "moderation": "Moderación"}


@dataclass
class Comparison:
    task: str
    alternative: str
    baseline: str
    verdict: str
    beats: bool = False
    fast_enough: bool = False
    p95_ms: float | None = None
    cx01: str | None = None

    @property
    def finding(self) -> bool:
        # conditions 1 and 2 hold: a written finding (and issue draft) even without the CX01 record
        return self.beats and self.fast_enough


@dataclass
class Findings:
    comparisons: list
    threshold: dict | None
    threshold_status: str


def _disjoint_better(alternative: dict, baseline: dict, higher_is_better: bool = True) -> bool:
    if higher_is_better:
        return alternative["low"] > baseline["high"]
    return alternative["high"] < baseline["low"]


def _beats(task: str, alternative: dict, baseline: dict) -> bool:
    if task == "matching":
        return any(_disjoint_better(alternative[key], baseline[key]) for key in ("auc", "tar_at_far_1pct"))
    return _disjoint_better(alternative["balanced_accuracy"], baseline["balanced_accuracy"]) and _disjoint_better(
        alternative["false_accept_rate"]["overall"], baseline["false_accept_rate"]["overall"], higher_is_better=False
    )


def _evaluated(summary: dict) -> bool:
    return summary.get("status") == EVALUATED


def _summary_of(runs: dict, variant: str) -> dict:
    return runs.get(variant) or {"variant": variant, "status": NOT_EVALUATED}


def compare(task: str, alternative: dict, baseline: dict, cx01: str | None = None) -> Comparison:
    names = alternative["variant"], baseline["variant"]
    if not (_evaluated(alternative) and _evaluated(baseline)):
        return Comparison(task, *names, NOT_EVALUATED, cx01=cx01)
    p95 = alternative["performance"]["latency_ms"]["p95"]
    result = Comparison(task, *names, KEEP, _beats(task, alternative, baseline), p95 < P95_LIMIT_MS, p95, cx01)
    if result.finding and cx01:
        result.verdict = REPLACE
    return result


def threshold_finding(summary: dict) -> bool:
    gain = summary["f1_gain_at_best_threshold"]
    excludes_zero = gain["low"] > 0 or gain["high"] < 0
    return gain["estimate"] >= THRESHOLD_GAIN - TOLERANCE and excludes_zero


def decide(summaries: dict, cx01: dict | None = None) -> Findings:
    """`summaries[task][variant]` is a parsed summary.json; `cx01[variant]` names its CX01 record (ADR)."""
    cx01 = cx01 or {}
    comparisons = []
    for task, alternatives in ALTERNATIVES.items():
        runs = summaries.get(task, {})
        baseline = _summary_of(runs, BASELINES[task])
        comparisons += [compare(task, _summary_of(runs, name), baseline, cx01.get(name)) for name in alternatives]

    baseline = _summary_of(summaries.get("matching", {}), BASELINES["matching"])
    if not _evaluated(baseline):
        return Findings(comparisons, None, NOT_EVALUATED)
    if not threshold_finding(baseline):
        return Findings(comparisons, None, "sin hallazgo")
    threshold = {
        "variant": BASELINES["matching"],
        "best_threshold": baseline["at_best_threshold"]["threshold"],
        "gain": baseline["f1_gain_at_best_threshold"],
    }
    return Findings(comparisons, threshold, "hallazgo")


def _comparison_line(result: Comparison) -> str:
    head = f"- {TASK_NAMES[result.task]}, {result.alternative} frente a {result.baseline}: {result.verdict}."
    if result.verdict == NOT_EVALUATED:
        return head
    line = (
        f"{head} IC 95 % disjuntos y a favor: {'sí' if result.beats else 'no'}. "
        f"p95: {result.p95_ms:.0f} ms (límite {P95_LIMIT_MS:.0f} ms). Registro CX01: {result.cx01 or 'no'}."
    )
    if result.finding and not result.cx01:
        line += " Hallazgo: cumple las condiciones 1 y 2, sin registro CX01 (ADR-0018); corresponde un borrador de issue."
    return line


def hallazgos(result: Findings) -> str:
    lines = ["### Hallazgos", "", f"Limitación: {LIMITATION}", ""]
    lines += [_comparison_line(comparison) for comparison in result.comparisons]
    if result.threshold:
        gain = result.threshold["gain"]
        lines.append(
            f"- Umbral ({result.threshold['variant']}): mejor F1 en umbral {result.threshold['best_threshold']:.2f}; "
            f"F1@t* − F1@{PRODUCTION_THRESHOLD} = {gain['estimate']:.3f} (IC 95 %: {gain['low']:.3f} a {gain['high']:.3f}). "
            f"Hallazgo de umbral; corresponde un borrador de issue. El valor {PRODUCTION_THRESHOLD} del código no cambia."
        )
    else:
        lines.append(f"- Umbral ({BASELINES['matching']}): {result.threshold_status}.")
    return "\n".join(lines) + "\n"


def load_summaries(results_dir: Path) -> dict:
    summaries = {task: {} for task in BASELINES}
    for task in summaries:
        for path in sorted((Path(results_dir) / task).glob("*/summary.json")):
            summary = json.loads(path.read_text(encoding="utf-8"))
            summaries[task][summary["variant"]] = summary
    return summaries


def write(result: Findings, results_dir: Path) -> list[Path]:
    results_dir = Path(results_dir).resolve()
    if results_dir == APP_DIR or APP_DIR in results_dir.parents:
        raise ValueError(f"findings are never written inside app/: {results_dir}")
    results_dir.mkdir(parents=True, exist_ok=True)
    record = {
        "limitation": LIMITATION,
        "comparisons": [{**asdict(c), "finding": c.finding} for c in result.comparisons],
        "threshold": result.threshold,
        "threshold_status": result.threshold_status,
    }
    write_json(results_dir / "findings.json", record)
    (results_dir / "hallazgos.md").write_text(hallazgos(result), encoding="utf-8")
    return [results_dir / "findings.json", results_dir / "hallazgos.md"]


def _cx01_entry(text: str) -> tuple[str, str]:
    variant, separator, record = text.partition("=")
    if not separator or not record:
        raise argparse.ArgumentTypeError("expected VARIANT=ADR, e.g. dinov2=docs/adr/0021-x.md")
    return variant, record


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Apply the pre-registered decision rule to the result files.")
    parser.add_argument("--results-dir", type=Path, default=RESULTS_DIR)
    parser.add_argument("--cx01", type=_cx01_entry, action="append", default=[], help="VARIANT=ADR (CX01 record)")
    args = parser.parse_args(argv)
    result = decide(load_summaries(args.results_dir), dict(args.cx01))
    for path in write(result, args.results_dir):
        print(path)


if __name__ == "__main__":
    main()
