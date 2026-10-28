"""Tests de app.ml.pipeline — detección (YOLO) + embedding (DINOv2).

Los constructores reales de YOLO/DINOv2 están parcheados en
tests/conftest.py antes de importar este módulo, así que `pipeline.yolo_model`
y `pipeline.dino_model`/`dino_transform` son mocks: cada test configura el
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


# Same criterion as contains_animal (the upload screening): a bird accepted when
# uploading must not end up rejected by the async moderation (PR #195 review).
def test_detect_and_crop_acepta_cualquier_animal():
    pipeline.yolo_model.names = {14: "bird"}
    pipeline.yolo_model.return_value = [FakeResult([FakeBox(14, 0.7, (5, 5, 25, 35))])]

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


# Real case (report 3583): another dog peeking in at the edge was detected as
# "sheep" 0.61, the pet in the foreground as "dog" 0.37. Picking by confidence
# alone embedded a strip of fur and grass instead of the reported pet.
def test_detect_and_crop_no_elige_un_animal_chico_del_borde_sobre_el_principal():
    pipeline.yolo_model.names = {16: "dog", 18: "sheep"}
    pipeline.yolo_model.return_value = [
        FakeResult(
            [
                FakeBox(18, 0.61, (0, 17, 22, 43)),
                FakeBox(16, 0.37, (6, 4, 89, 87)),
            ]
        )
    ]

    crop = pipeline.detect_and_crop(_image())

    assert crop is not None
    assert crop.size == (83, 83)


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


def test_generate_embedding_devuelve_768_floats_normalizado():
    pipeline.dino_transform = lambda image: torch.rand(3, 224, 224)
    pipeline.dino_model = lambda tensor: torch.rand(1, 768)

    embedding = pipeline.generate_embedding(_image())

    assert isinstance(embedding, list)
    assert len(embedding) == 768
    assert pipeline.EMBEDDING_DIM == 768
    assert all(isinstance(v, float) for v in embedding)

    norm = sum(v * v for v in embedding) ** 0.5
    assert norm == pytest.approx(1.0, abs=1e-4)


# DINOv2's transform resizes the short side and CENTER-CROPS to a square: on an
# elongated crop (a sitting dog, a dog lying sideways) that cut the head off.
# Padding to a square first keeps the whole animal in view.
def test_generate_embedding_rellena_a_cuadrado_sin_recortar_al_animal():
    received = []

    def spy_transform(image):
        received.append(image)
        return torch.rand(3, 224, 224)

    pipeline.dino_transform = spy_transform
    pipeline.dino_model = lambda tensor: torch.rand(1, 768)
    tall = Image.new("RGB", (40, 100), (255, 0, 0))

    pipeline.generate_embedding(tall)

    padded = received[0]
    assert padded.size == (100, 100)
    # The original content is centred and intact; the padding is neutral grey.
    assert padded.getpixel((50, 50)) == (255, 0, 0)
    assert padded.getpixel((30, 0)) == (255, 0, 0)
    assert padded.getpixel((69, 99)) == (255, 0, 0)
    assert padded.getpixel((0, 50)) == pipeline.PAD_COLOR
    assert padded.getpixel((99, 50)) == pipeline.PAD_COLOR


# --- contains_animal: any COCO animal class, not only cats/dogs -------------


def test_contains_animal_true_for_dog():
    pipeline.yolo_model.names = {16: "dog"}
    pipeline.yolo_model.return_value = [FakeResult([FakeBox(16, 0.9, (10, 10, 50, 50))])]

    assert pipeline.contains_animal(_image()) is True


@pytest.mark.parametrize(
    ("cls_id", "label"),
    [(14, "bird"), (15, "cat"), (17, "horse"), (20, "elephant"), (23, "giraffe")],
)
def test_contains_animal_true_for_any_coco_animal(cls_id, label):
    pipeline.yolo_model.names = {cls_id: label}
    pipeline.yolo_model.return_value = [FakeResult([FakeBox(cls_id, 0.7, (0, 0, 10, 10))])]

    assert pipeline.contains_animal(_image()) is True


def test_contains_animal_false_when_only_non_animals_are_detected():
    pipeline.yolo_model.names = {0: "person", 2: "car"}
    pipeline.yolo_model.return_value = [
        FakeResult([FakeBox(0, 0.95, (0, 0, 20, 30)), FakeBox(2, 0.9, (5, 5, 40, 40))])
    ]

    assert pipeline.contains_animal(_image()) is False


def test_contains_animal_false_without_detections():
    pipeline.yolo_model.names = {}
    pipeline.yolo_model.return_value = [FakeResult([]), FakeResult(None)]

    assert pipeline.contains_animal(_image()) is False


# DINOv2 is pretrained at 518px, but at 224px the identity benchmark is the
# same (AUC 0.984 vs 0.985) and the embedding is 6x faster (0.30s vs 1.8s).
def test_dino_corre_a_224px():
    create_kwargs = pipeline.timm.create_model.call_args.kwargs
    data_config_args = pipeline.timm.data.resolve_data_config.call_args.args

    assert pipeline.DINO_INPUT_SIZE == 224
    assert create_kwargs["img_size"] == 224
    assert data_config_args[0] == {"input_size": (3, 224, 224)}
