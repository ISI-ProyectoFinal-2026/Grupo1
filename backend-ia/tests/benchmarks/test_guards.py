"""Guards: constants the benchmark mirrors from production must not drift (conftest mocks keep imports safe)."""

from app.ml import pipeline
from app.services.matching_service import SIMILARITY_THRESHOLD

from benchmarks.moderators import YOLO_ANIMAL_LABELS
from benchmarks.run_matching import PRODUCTION_THRESHOLD

COCO_ANIMALS = {"bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"}


def test_benchmark_yolo_labels_equal_the_production_animal_labels():
    assert YOLO_ANIMAL_LABELS == pipeline._ANIMAL_LABELS
    assert len(YOLO_ANIMAL_LABELS) == 10


def test_production_animal_labels_are_the_ten_coco_animals():
    assert pipeline._ANIMAL_LABELS == COCO_ANIMALS


def test_benchmark_threshold_equals_the_production_similarity_threshold():
    assert PRODUCTION_THRESHOLD == SIMILARITY_THRESHOLD == 0.75
