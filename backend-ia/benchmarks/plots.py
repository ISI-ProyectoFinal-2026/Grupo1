"""PNG charts from the result files. Agg canvas only (no pyplot, no GUI); every figure carries the limitation."""

import json
import textwrap
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.figure import Figure

from benchmarks.output import EVALUATED, LIMITATION, read_csv
from benchmarks.run_matching import PRODUCTION_THRESHOLD

CHARTS = (
    "roc_matching.png",
    "roc_moderation.png",
    "threshold_sweep_matching.png",
    "confusion_matching.png",
    "confusion_moderation.png",
)
# color per method, never per rank: YOLO-based (production) orange, CLIP-based blue, DINOv2 aqua
COLORS = {"yolo_clip": "#eb6834", "yolo": "#eb6834", "clip_full": "#2a78d6", "clip": "#2a78d6", "dinov2": "#1baf7a"}
FALLBACK_COLOR = "#52514e"
INK, MUTED, GRID = "#0b0b0b", "#52514e", "#e4e3df"
FOOTNOTE_CHARS_PER_COLUMN = 105
DPI = 150


@dataclass
class TaskRuns:
    folders: dict = field(default_factory=dict)  # variant -> result folder
    summaries: dict = field(default_factory=dict)
    not_evaluated: list = field(default_factory=list)

    @property
    def evaluated(self) -> list:
        return sorted(self.folders)

    def curves(self) -> dict:
        curves = {}
        for variant in self.evaluated:
            rows = read_csv(self.folders[variant] / "roc.csv")
            fpr, tpr = (np.array([float(row[key]) for row in rows]) for key in ("fpr", "tpr"))
            curves[variant] = (fpr, tpr, self.summaries[variant]["auc"]["estimate"])
        return curves

    def sweeps(self) -> dict:
        sweeps = {}
        for variant in self.evaluated:
            rows = read_csv(self.folders[variant] / "threshold_sweep.csv")
            sweeps[variant] = tuple(
                np.array([float(row[key]) for row in rows]) for key in ("threshold", "precision", "recall", "f1")
            )
        return sweeps


def load_task(results_dir: Path, task: str) -> TaskRuns:
    runs = TaskRuns()
    for summary_path in sorted((Path(results_dir) / task).glob("*/summary.json")):
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        if summary["status"] == EVALUATED:
            runs.folders[summary["variant"]] = summary_path.parent
            runs.summaries[summary["variant"]] = summary
        else:
            runs.not_evaluated.append(summary["variant"])
    return runs


def _new_figure(columns: int, not_evaluated: list | None = None) -> Figure:
    figure = Figure(figsize=(5.5 * columns, 5.5), layout="constrained")
    FigureCanvasAgg(figure)
    note = f"No evaluado: {', '.join(not_evaluated)}\n" if not_evaluated else ""
    figure.get_layout_engine().set(rect=(0, 0.1, 1, 0.9))  # bottom band for the footnote
    figure.text(0.01, 0.01, note + textwrap.fill(LIMITATION, FOOTNOTE_CHARS_PER_COLUMN * columns), fontsize=6.5, color=MUTED, va="bottom")
    return figure


def _style(axes, title: str, xlabel: str, ylabel: str) -> None:
    axes.set_title(title, color=INK, fontsize=11, loc="left")
    axes.set_xlabel(xlabel, color=MUTED)
    axes.set_ylabel(ylabel, color=MUTED)
    axes.grid(color=GRID, linewidth=0.8)
    axes.set_axisbelow(True)
    for side in ("top", "right"):
        axes.spines[side].set_visible(False)


def _panels(items: dict, not_evaluated: list | None) -> tuple[Figure, list]:
    figure = _new_figure(max(len(items), 1), not_evaluated)
    panels = list(np.atleast_1d(figure.subplots(1, max(len(items), 1))))
    if not items:
        panels[0].text(0.5, 0.5, "Sin variantes evaluadas", ha="center", va="center", color=MUTED)
        panels[0].set_axis_off()
    return figure, panels


def roc_figure(curves: dict, title: str, not_evaluated: list | None = None) -> Figure:
    figure = _new_figure(1, not_evaluated)
    axes = figure.subplots()
    axes.plot([0, 1], [0, 1], color=GRID, linestyle="--", linewidth=1, label="_azar")
    for variant, (fpr, tpr, area) in curves.items():
        axes.plot(fpr, tpr, linewidth=2, color=COLORS.get(variant, FALLBACK_COLOR), label=f"{variant} (AUC {area:.3f})")
    _style(axes, title, "Tasa de falsos positivos", "Tasa de verdaderos positivos")
    if curves:
        axes.legend(loc="lower right", frameon=False)
    return figure


def sweep_figure(sweeps: dict, not_evaluated: list | None = None) -> Figure:
    figure, panels = _panels(sweeps, not_evaluated)
    for axes, (variant, (thresholds, precision, recall, f1)) in zip(panels, sweeps.items()):
        axes.plot(thresholds, precision, linewidth=2, color="#2a78d6", label="Precisión")
        axes.plot(thresholds, recall, linewidth=2, color="#eb6834", label="Recall")
        axes.plot(thresholds, f1, linewidth=2, color="#1baf7a", label="F1")
        axes.axvline(PRODUCTION_THRESHOLD, color=MUTED, linestyle="--", linewidth=1, label=f"Producción ({PRODUCTION_THRESHOLD})")
        _style(axes, f"Barrido de umbral: {variant}", "Umbral de similitud", "Valor")
        axes.legend(loc="lower left", frameon=False)
    return figure


def confusion_figure(matrices: dict, title: str, not_evaluated: list | None = None) -> Figure:
    figure, panels = _panels(matrices, not_evaluated)
    for axes, (variant, (labels, matrix)) in zip(panels, matrices.items()):
        values = np.asarray(matrix)
        axes.imshow(values, cmap="Blues", aspect="auto")
        for (row, column), count in np.ndenumerate(values):
            dark = count > values.max() / 2
            axes.text(column, row, str(count), ha="center", va="center", color="white" if dark else INK)
        axes.set_xticks(range(len(labels)), labels)
        axes.set_yticks(range(len(labels)), labels)
        axes.set_title(f"{title}: {variant}", color=INK, fontsize=11, loc="left")
        axes.set_xlabel("Predicho", color=MUTED)
        axes.set_ylabel("Real", color=MUTED)
    return figure


def matching_confusion(summary: dict) -> tuple[list, list]:
    block = summary["at_production_threshold"]
    return ["genuine", "impostor"], [[block["tp"], block["fn"]], [block["fp"], block["tn"]]]


def save(figure: Figure, path: Path) -> Path:
    path = Path(path)
    figure.savefig(path, format="png", dpi=DPI, metadata={"Description": LIMITATION})
    return path


def render(results_dir: Path, out_dir: Path) -> list[Path]:
    matching, moderation = load_task(results_dir, "matching"), load_task(results_dir, "moderation")
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    figures = {
        "roc_matching.png": roc_figure(matching.curves(), "ROC matching", matching.not_evaluated),
        "roc_moderation.png": roc_figure(moderation.curves(), "ROC moderación", moderation.not_evaluated),
        "threshold_sweep_matching.png": sweep_figure(matching.sweeps(), matching.not_evaluated),
        "confusion_matching.png": confusion_figure(
            {variant: matching_confusion(matching.summaries[variant]) for variant in matching.evaluated},
            f"Umbral {PRODUCTION_THRESHOLD}",
            matching.not_evaluated,
        ),
        "confusion_moderation.png": confusion_figure(
            {
                variant: (block["labels"], block["matrix"])
                for variant in moderation.evaluated
                for block in [moderation.summaries[variant]["confusion_matrix"]]
            },
            "Moderación",
            moderation.not_evaluated,
        ),
    }
    return [save(figure, out_dir / name) for name, figure in figures.items()]
