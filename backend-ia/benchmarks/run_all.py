"""Full benchmark (D10): each variant in its own process (RAM isolation), then charts and findings.

Command: `python -m benchmarks.run_all`. Everything is built in a staging directory and renamed at the end.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

from benchmarks import findings, plots
from benchmarks.output import LIMITATION, RESULTS_DIR, atomic_directory, write_json

BACKEND_DIR = Path(__file__).resolve().parents[1]
# fixed allowlist: the only variants that can reach a command line
ALLOWLIST = {"matching": ("clip_full", "yolo_clip", "dinov2"), "moderation": ("yolo", "clip")}
RUN_RECORD = "run_all.json"


def build_argv(task: str, variant: str, output_dir: Path) -> list[str]:
    if variant not in ALLOWLIST.get(task, ()):
        raise ValueError(f"variant not in the allowlist: {task}/{variant!r}")
    return [sys.executable, "-m", f"benchmarks.run_{task}", "--variant", variant, "--output-dir", str(output_dir)]


def planned(results_dir: Path) -> list[list[str]]:
    return [build_argv(task, variant, Path(results_dir) / task / variant) for task, variants in ALLOWLIST.items() for variant in variants]


def run_variant(task: str, variant: str, output_dir: Path) -> dict:
    argv = build_argv(task, variant, output_dir)
    completed = subprocess.run(argv, shell=False, check=False, cwd=BACKEND_DIR)
    summary_path = Path(output_dir) / "summary.json"
    if completed.returncode != 0 or not summary_path.exists():
        raise RuntimeError(f"{task}/{variant} failed (exit code {completed.returncode}); no results were published")
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    return {"task": task, "variant": variant, "status": summary["status"], "reason": summary.get("reason")}


def publish_reports(staging: Path, cx01: dict | None = None) -> None:
    plots.render(staging, staging / "plots")
    findings.write(findings.decide(findings.load_summaries(staging), cx01), staging)


def run_all(results_dir: Path = RESULTS_DIR) -> list[dict]:
    """A crash aborts the run and keeps the previous results; a "no evaluado" variant is recorded and the run goes on."""
    with atomic_directory(results_dir) as staging:
        records = [
            run_variant(task, variant, staging / task / variant) for task, variants in ALLOWLIST.items() for variant in variants
        ]
        publish_reports(staging)
        write_json(staging / RUN_RECORD, {"limitation": LIMITATION, "variants": records})
    return records


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run every benchmark variant, then the charts and the findings.")
    parser.add_argument("--dry-run", action="store_true", help="print the allowlisted commands and run nothing")
    parser.add_argument("--results-dir", type=Path, default=RESULTS_DIR)
    args = parser.parse_args(argv)

    if args.dry_run:
        for command in planned(args.results_dir):
            print(subprocess.list2cmdline(command))
        return
    for record in run_all(args.results_dir):
        print(f"{record['task']}/{record['variant']}: {record['status']}")


if __name__ == "__main__":
    main()
