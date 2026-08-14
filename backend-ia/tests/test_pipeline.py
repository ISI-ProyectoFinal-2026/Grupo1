"""Tests de app.ml.pipeline — detección (YOLO) + embedding (OpenCLIP).

Los constructores reales de YOLO/OpenCLIP están parcheados en
tests/conftest.py antes de importar este módulo, así que `pipeline.yolo_model`
y `pipeline.clip_model`/`clip_preprocess` son mocks: cada test configura el
resultado que el modelo "real" habría devuelto.
"""

import pytest
import torch
from PIL import Image

from app.ml import pipeline


class FakeBox:
    """Imita ultralytics.engine.results.Boxes para una sola detección."""

    def __init__(self, cls_id: int, conf: float, xyxy: tuple[int, int, int, int]):
        self.cls = [cls_id]
        self.conf = [conf]
        self.xyxy = [list(xyxy)]


class FakeResult:
    def __init__(self, boxes: list[FakeBox]):
        self.boxes = boxes


def _image(width: int = 100, height: int = 100) -> Image.Image:
    return Image.new("RGB", (width, height))


def test_detect_and_crop_detecta_perro():
    pipeline.yolo_model.names = {16: "dog"}
    pipeline.yolo_model.return_value = [FakeResult([FakeBox(16, 0.9, (10, 10, 50, 50))])]

    crop = pipeline.detect_and_crop(_image())

    assert crop is not None
    assert crop.size == (40, 40)


def test_detect_and_crop_detecta_gato():
    pipeline.yolo_model.names = {15: "cat"}
    pipeline.yolo_model.return_value = [FakeResult([FakeBox(15, 0.8, (0, 0, 20, 30))])]

    crop = pipeline.detect_and_crop(_image())

    assert crop is not None
    assert crop.size == (20, 30)


def test_detect_and_crop_sin_mascota_devuelve_none():
    pipeline.yolo_model.names = {0: "person"}
    pipeline.yolo_model.return_value = [FakeResult([FakeBox(0, 0.95, (0, 0, 20, 30))])]

    crop = pipeline.detect_and_crop(_image())

    assert crop is None


def test_detect_and_crop_sin_detecciones_devuelve_none():
    pipeline.yolo_model.names = {}
    pipeline.yolo_model.return_value = [FakeResult([])]

    crop = pipeline.detect_and_crop(_image())

    assert crop is None


def test_detect_and_crop_elige_la_deteccion_de_mayor_confianza():
    pipeline.yolo_model.names = {15: "cat", 16: "dog"}
    pipeline.yolo_model.return_value = [
        FakeResult(
            [
                FakeBox(15, 0.4, (0, 0, 10, 10)),
                FakeBox(16, 0.9, (5, 5, 25, 25)),
            ]
        )
    ]

    crop = pipeline.detect_and_crop(_image())

    assert crop is not None
    assert crop.size == (20, 20)


def test_generate_embedding_devuelve_512_floats_normalizado():
    pipeline.clip_preprocess = lambda image: torch.rand(3, 224, 224)
    pipeline.clip_model.encode_image = lambda tensor: torch.rand(1, 512)

    embedding = pipeline.generate_embedding(_image())

    assert isinstance(embedding, list)
    assert len(embedding) == 512
    assert all(isinstance(v, float) for v in embedding)

    norm = sum(v * v for v in embedding) ** 0.5
    assert norm == pytest.approx(1.0, abs=1e-4)
