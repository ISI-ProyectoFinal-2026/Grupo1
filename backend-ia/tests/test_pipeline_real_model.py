"""Optional smoke test of `contains_animal` against the real YOLOv8n weights.

Skipped by default (CI mocks every model in conftest.py). Run it locally with:

    RUN_REAL_MODEL_TESTS=1 pytest tests/test_pipeline_real_model.py

conftest.py replaces `ultralytics.YOLO` with a MagicMock, but the real class
is still reachable at `ultralytics.models.YOLO`, so this test loads it from
there and swaps it into the pipeline only for its own duration. OpenCLIP is
not needed. Fixture images and their licenses: tests/fixtures/README.md.
"""

import os
from pathlib import Path

import pytest
from PIL import Image

from app.ml import pipeline

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_REAL_MODEL_TESTS") != "1",
    reason="set RUN_REAL_MODEL_TESTS=1 to run against the real YOLO weights",
)

_FIXTURES = Path(__file__).parent / "fixtures"
_WEIGHTS = Path(__file__).resolve().parents[1] / "yolov8n.pt"


@pytest.fixture
def real_yolo(monkeypatch):
    from ultralytics.models import YOLO

    monkeypatch.setattr(pipeline, "yolo_model", YOLO(str(_WEIGHTS)))


def _load(name: str) -> Image.Image:
    return Image.open(_FIXTURES / name).convert("RGB")


def test_real_model_detects_an_animal_in_a_dog_photo(real_yolo):
    assert pipeline.contains_animal(_load("dog.jpg")) is True


def test_real_model_detects_no_animal_in_a_landscape_photo(real_yolo):
    assert pipeline.contains_animal(_load("landscape.jpg")) is False
