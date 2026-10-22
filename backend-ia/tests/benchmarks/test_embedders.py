"""Embedding adapters: lazy loading, delegation to the production pipeline, failure modes (fakes only)."""

import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
import torch
from PIL import Image

from benchmarks.embedders import EMBEDDERS, ClipFull, Dinov2Full, ModelUnavailable, YoloClip

BACKEND_IA = Path(__file__).resolve().parents[2]
MIB = 1024 * 1024
CLIP_BYTES = (10 * 10 + 10) * 4  # Linear(10, 10): weights + bias, float32
YOLO_BYTES = (5 * 4 + 4) * 4  # Linear(5, 4)


@pytest.fixture
def image_path(tmp_path):
    path = tmp_path / "dog.png"
    Image.new("RGBA", (6, 4), (200, 100, 50, 255)).save(path)
    return path


class FakePipeline:
    """Stands in for app.ml.pipeline: records what it receives, answers from fixed values."""

    def __init__(self, crop=None, vector=(3.0, 4.0)):
        self.received = []
        self.crop = crop
        self.vector = list(vector)
        self.clip_model = torch.nn.Linear(10, 10)
        self.yolo_model = SimpleNamespace(model=torch.nn.Linear(5, 4))

    def generate_embedding(self, image):
        self.received.append(image)
        return self.vector

    def detect_and_crop(self, image):
        self.received.append(image)
        return self.crop


def test_importing_the_module_loads_no_model():
    probe = (
        "import sys; import benchmarks.embedders; "
        "heavy = ('app.ml.pipeline', 'timm', 'ultralytics', 'open_clip'); "
        "sys.exit(any(name in sys.modules for name in heavy))"
    )
    result = subprocess.run([sys.executable, "-c", probe], cwd=BACKEND_IA, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


def test_registry_maps_variant_names_to_adapters():
    assert EMBEDDERS == {"clip_full": ClipFull, "yolo_clip": YoloClip, "dinov2": Dinov2Full}
    assert [cls.name for cls in EMBEDDERS.values()] == ["clip_full", "yolo_clip", "dinov2"]


def test_clip_full_embeds_the_whole_image_as_rgb(image_path):
    pipeline = FakePipeline(vector=(3.0, 4.0))
    embedder = ClipFull(pipeline=pipeline)
    embedder.load()

    vector = embedder.embed(image_path)

    np.testing.assert_array_equal(vector, [3.0, 4.0])
    (seen,) = pipeline.received
    assert (seen.mode, seen.size) == ("RGB", (6, 4))


def test_yolo_clip_returns_none_when_nothing_is_detected(image_path):
    pipeline = FakePipeline(crop=None)
    embedder = YoloClip(pipeline=pipeline)
    embedder.load()

    assert embedder.embed(image_path) is None
    assert len(pipeline.received) == 1  # only the detector ran, no embedding


def test_yolo_clip_embeds_the_crop_not_the_full_image(image_path):
    crop = Image.new("RGB", (2, 2))
    pipeline = FakePipeline(crop=crop, vector=(1.0, 2.0))
    embedder = YoloClip(pipeline=pipeline)
    embedder.load()

    vector = embedder.embed(image_path)

    np.testing.assert_array_equal(vector, [1.0, 2.0])
    assert pipeline.received[-1] is crop
    assert len(pipeline.received) == 2


def test_dinov2_failing_to_load_raises_model_unavailable_with_the_reason():
    def offline():
        raise OSError("no network")

    embedder = Dinov2Full(factory=offline)

    with pytest.raises(ModelUnavailable, match="no network") as caught:
        embedder.load()
    assert isinstance(caught.value.__cause__, OSError)


def test_dinov2_embeds_a_normalised_vector_from_the_transformed_image(image_path):
    seen = []

    def transform(image):
        seen.append(image)
        return torch.zeros(3, 2, 2)

    class Model(torch.nn.Module):
        def forward(self, batch):
            assert batch.shape == (1, 3, 2, 2)
            return torch.tensor([[3.0, 4.0]])

    embedder = Dinov2Full(factory=lambda: (Model(), transform))
    embedder.load()

    vector = embedder.embed(image_path)

    np.testing.assert_allclose(vector, [0.6, 0.8], rtol=1e-6)
    assert seen[0].mode == "RGB"


def test_model_size_is_the_parameter_bytes_of_every_model_used():
    clip_only = ClipFull(pipeline=FakePipeline())
    clip_only.load()
    with_yolo = YoloClip(pipeline=FakePipeline())
    with_yolo.load()
    dino = Dinov2Full(factory=lambda: (torch.nn.Linear(5, 4), None))
    dino.load()

    assert clip_only.model_size_mb() == pytest.approx(CLIP_BYTES / MIB)
    assert with_yolo.model_size_mb() == pytest.approx((CLIP_BYTES + YOLO_BYTES) / MIB)
    assert dino.model_size_mb() == pytest.approx(YOLO_BYTES / MIB)


def test_model_ids_name_the_weights_each_variant_uses():
    assert ClipFull.model_ids == {"clip": "open_clip ViT-B-32 laion2b_s34b_b79k"}
    assert YoloClip.model_ids == {"yolo": "ultralytics yolov8n.pt", **ClipFull.model_ids}
    assert Dinov2Full.model_ids == {"dinov2": "timm vit_small_patch14_dinov2.lvd142m"}
