"""Embedding adapters for the matching benchmark.

Every adapter exposes `name`, `model_ids`, `load()`, `embed(path)` and `model_size_mb()`. Nothing heavy
is imported at module level: `app.ml.pipeline` (YOLO + OpenCLIP, loaded on import) and `timm` are only
touched in `load()`, so importing this module and running the tests never loads a model.
"""

import importlib
from pathlib import Path
from typing import Any, Callable

import numpy as np

MIB = 1024 * 1024
CLIP_ID = "open_clip ViT-B-32 laion2b_s34b_b79k"
YOLO_ID = "ultralytics yolov8n.pt"
DINOV2_TIMM_NAME = "vit_small_patch14_dinov2.lvd142m"
DINOV2_INPUT_SIZE = 224


class ModelUnavailable(RuntimeError):
    """The weights cannot be loaded (for example offline); the runner reports "no evaluado"."""


def open_rgb(path: Path):
    from PIL import Image

    with Image.open(path) as image:
        return image.convert("RGB")


def parameters_mb(module: Any) -> float:
    """Size of the parameters of a torch module in MiB."""
    return sum(p.numel() * p.element_size() for p in module.parameters()) / MIB


def _production_pipeline():
    # Deferred on purpose: this import loads YOLO and OpenCLIP.
    return importlib.import_module("app.ml.pipeline")


class PipelineAdapter:
    """Shared loading for the adapters that delegate to `app.ml.pipeline` (injectable for tests)."""

    def __init__(self, pipeline: Any = None) -> None:
        self._injected = pipeline
        self._pipeline: Any = None

    def load(self) -> None:
        self._pipeline = self._injected if self._injected is not None else _production_pipeline()


class ClipFull(PipelineAdapter):
    """OpenCLIP alone on the full image."""

    name = "clip_full"
    model_ids = {"clip": CLIP_ID}

    def embed(self, path: Path) -> np.ndarray:
        return np.asarray(self._pipeline.generate_embedding(open_rgb(path)), dtype=float)

    def model_size_mb(self) -> float:
        return parameters_mb(self._pipeline.clip_model)


class YoloClip(PipelineAdapter):
    """Production path: YOLO crop, then OpenCLIP on the crop. None when no animal is detected."""

    name = "yolo_clip"
    model_ids = {"yolo": YOLO_ID, "clip": CLIP_ID}

    def embed(self, path: Path) -> np.ndarray | None:
        crop = self._pipeline.detect_and_crop(open_rgb(path))
        if crop is None:
            return None
        return np.asarray(self._pipeline.generate_embedding(crop), dtype=float)

    def model_size_mb(self) -> float:
        return parameters_mb(self._pipeline.yolo_model.model) + parameters_mb(self._pipeline.clip_model)


def _timm_dinov2() -> tuple[Any, Callable]:
    import timm

    model = timm.create_model(
        DINOV2_TIMM_NAME, pretrained=True, num_classes=0, img_size=DINOV2_INPUT_SIZE
    ).eval()
    config = timm.data.resolve_data_config({"input_size": (3, DINOV2_INPUT_SIZE, DINOV2_INPUT_SIZE)}, model=model)
    return model, timm.data.create_transform(**config)


class Dinov2Full:
    """DINOv2 ViT-S/14 (384-d) through timm on the full image."""

    name = "dinov2"
    model_ids = {"dinov2": f"timm {DINOV2_TIMM_NAME}"}

    def __init__(self, factory: Callable[[], tuple[Any, Callable]] = _timm_dinov2) -> None:
        self._factory = factory
        self._model: Any = None
        self._transform: Callable | None = None

    def load(self) -> None:
        try:
            self._model, self._transform = self._factory()
        except Exception as error:  # offline, missing package or corrupt cache: all mean "no evaluado"
            reason = f"{type(error).__name__}: {error}"  # the type keeps a real bug visible in the report
            raise ModelUnavailable(f"DINOv2 weights could not be loaded ({reason})") from error

    def embed(self, path: Path) -> np.ndarray:
        import torch

        batch = self._transform(open_rgb(path)).unsqueeze(0)
        with torch.no_grad():
            features = self._model(batch)
            features = features / features.norm(dim=-1, keepdim=True)
        return features[0].numpy().astype(float)

    def model_size_mb(self) -> float:
        return parameters_mb(self._model)


EMBEDDERS = {cls.name: cls for cls in (ClipFull, YoloClip, Dinov2Full)}
