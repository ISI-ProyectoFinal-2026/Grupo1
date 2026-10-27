"""Charts: Agg only, a readable PNG and the dataset limitation on every figure."""

import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from benchmarks import plots
from benchmarks.output import LIMITATION, write_csv, write_json

BACKEND_IA = Path(__file__).resolve().parents[2]
GUI_MODULES = ("matplotlib.pyplot", "tkinter", "PyQt5", "PyQt6", "PySide2", "PySide6", "wx", "gi")


def one_line(text: str) -> str:
    return " ".join(text.split())


def figure_text(figure) -> str:
    return one_line(" ".join(text.get_text() for text in figure.texts))


def matching_summary(variant: str, status: str = "evaluado") -> dict:
    if status != "evaluado":
        return {"variant": variant, "task": "matching", "status": status, "reason": "offline"}
    block = {"tp": 8, "fp": 2, "fn": 1, "tn": 30}
    return {
        "variant": variant, "task": "matching", "status": status,
        "auc": {"estimate": 0.9, "low": 0.85, "high": 0.95},
        "at_production_threshold": {"threshold": 0.75, **block},
        "at_best_threshold": {"threshold": 0.8, **block},
    }


def moderation_summary(variant: str) -> dict:
    return {
        "variant": variant, "task": "moderation", "status": "evaluado",
        "auc": {"estimate": 0.8, "low": 0.7, "high": 0.9},
        "confusion_matrix": {"labels": ["animal", "no_animal"], "matrix": [[30, 2], [5, 25]]},
    }


def write_variant(results: Path, task: str, summary: dict) -> None:
    folder = results / task / summary["variant"]
    folder.mkdir(parents=True)
    write_json(folder / "summary.json", summary)
    if summary["status"] != "evaluado":
        return
    write_csv(folder / "roc.csv", ["fpr", "tpr", "threshold"], [(0.0, 0.0, 1.0), (0.1, 0.7, 0.8), (1.0, 1.0, 0.0)])
    if task == "matching":
        write_csv(
            folder / "threshold_sweep.csv",
            ["threshold", "precision", "recall", "f1"],
            [(0.9, 1.0, 0.4, 0.57), (0.75, 0.8, 0.9, 0.85), (0.5, 0.5, 1.0, 0.67)],
        )


def fixture_results(tmp_path: Path) -> Path:
    results = tmp_path / "results"
    write_variant(results, "matching", matching_summary("yolo_clip"))
    write_variant(results, "matching", matching_summary("clip_full"))
    write_variant(results, "matching", matching_summary("dinov2", status="no evaluado"))
    write_variant(results, "moderation", moderation_summary("yolo"))
    write_variant(results, "moderation", moderation_summary("clip"))
    return results


def every_figure():
    curve = (np.array([0.0, 0.2, 1.0]), np.array([0.0, 0.8, 1.0]), 0.85)
    sweep = (np.array([0.9, 0.75, 0.5]), np.array([1.0, 0.8, 0.5]), np.array([0.4, 0.9, 1.0]), np.array([0.6, 0.85, 0.7]))
    matrix = (["animal", "no_animal"], [[3, 1], [0, 4]])
    return [
        plots.roc_figure({"yolo_clip": curve}, "ROC"),
        plots.sweep_figure({"yolo_clip": sweep}),
        plots.confusion_figure({"yolo": matrix}, "Confusion"),
    ]


def test_every_figure_uses_the_agg_canvas_and_carries_the_limitation():
    from matplotlib.backends.backend_agg import FigureCanvasAgg

    for figure in every_figure():
        assert isinstance(figure.canvas, FigureCanvasAgg)
        assert one_line(LIMITATION) in figure_text(figure)


def test_saved_png_is_readable_and_its_metadata_states_the_limitation(tmp_path):
    path = plots.save(every_figure()[0], tmp_path / "roc.png")

    assert path.stat().st_size > 0
    with Image.open(path) as image:
        assert image.format == "PNG"
        assert image.width > 0 and image.height > 0
        assert image.info["Description"] == LIMITATION


def test_render_writes_the_five_charts_from_the_result_files(tmp_path):
    results = fixture_results(tmp_path)

    written = plots.render(results, results / "plots")

    assert sorted(path.name for path in written) == sorted(plots.CHARTS)
    for path in written:
        assert path.parent == results / "plots"
        with Image.open(path) as image:
            assert image.info["Description"] == LIMITATION


def test_not_evaluated_variants_are_named_on_the_chart_and_left_out_of_the_curves(tmp_path):
    results = fixture_results(tmp_path)
    runs = plots.load_task(results, "matching")

    assert sorted(runs.evaluated) == ["clip_full", "yolo_clip"]
    assert runs.not_evaluated == ["dinov2"]
    figure = plots.roc_figure(runs.curves(), "ROC", not_evaluated=runs.not_evaluated)
    assert "No evaluado: dinov2" in figure_text(figure)
    assert sorted(line.get_label() for line in figure.axes[0].get_lines() if not line.get_label().startswith("_")) == [
        "clip_full (AUC 0.900)", "yolo_clip (AUC 0.900)",
    ]


def test_matching_confusion_matrix_is_built_from_the_production_threshold_counts():
    labels, matrix = plots.matching_confusion(matching_summary("yolo_clip"))

    assert labels == ["genuine", "impostor"]
    assert matrix == [[8, 1], [2, 30]]  # rows true, columns predicted


def test_rendering_imports_no_gui_toolkit(tmp_path):
    probe = (
        "import sys; from pathlib import Path; from benchmarks import plots; "
        "import numpy as np; "
        "c = (np.array([0.0, 1.0]), np.array([0.0, 1.0]), 0.5); "
        f"plots.save(plots.roc_figure({{'x': c}}, 'ROC'), Path(r'{tmp_path}') / 'p.png'); "
        f"print([m for m in {GUI_MODULES!r} if m in sys.modules])"
    )
    result = subprocess.run([sys.executable, "-c", probe], cwd=BACKEND_IA, capture_output=True, text=True)

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "[]"


def test_a_task_with_no_evaluated_variant_still_gets_its_charts(tmp_path):
    results = tmp_path / "results"
    write_variant(results, "matching", matching_summary("dinov2", status="no evaluado"))
    write_variant(results, "moderation", moderation_summary("yolo"))

    written = plots.render(results, results / "plots")

    assert len(written) == len(plots.CHARTS)
    assert all(path.stat().st_size > 0 for path in written)


def test_one_panel_per_variant_in_sweeps_and_confusion_matrices():
    matrix = (["animal", "no_animal"], [[3, 1], [0, 4]])
    figure = plots.confusion_figure({"yolo": matrix, "clip": matrix}, "Moderación")

    assert [axes.get_title(loc="left") for axes in figure.axes] == ["Moderación: yolo", "Moderación: clip"]
    assert sorted(text.get_text() for text in figure.axes[0].texts) == ["0", "1", "3", "4"]
