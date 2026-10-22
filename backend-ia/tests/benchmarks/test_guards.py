"""Guards: constants the benchmark mirrors from production must not drift (conftest mocks keep imports safe)."""

from app.ml import pipeline

from benchmarks.moderators import YOLO_ANIMAL_LABELS

COCO_ANIMALS = {"bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"}


def test_benchmark_yolo_labels_equal_the_production_animal_labels():
    assert YOLO_ANIMAL_LABELS == pipeline._ANIMAL_LABELS
    assert len(YOLO_ANIMAL_LABELS) == 10


def test_production_animal_labels_are_the_ten_coco_animals():
    assert pipeline._ANIMAL_LABELS == COCO_ANIMALS
