"""Moderation adapters: YOLO as production decides it, CLIP zero-shot with fixed prompts (fakes only)."""

import math
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
import torch
from PIL import Image

from benchmarks.moderators import (
    MODERATORS,
    NEGATIVE_PROMPTS,
    POSITIVE_PROMPTS,
    ClipZeroShot,
    YoloModerator,
    positive_softmax_mass,
)

BACKEND_IA = Path(__file__).resolve().parents[2]
MIB = 1024 * 1024
YOLO_BYTES = (10 * 10 + 10) * 4  # Linear(10, 10): weights + bias, float32
CLIP_BYTES = (5 * 4 + 4) * 4  # Linear(5, 4)
LOW_CONFIDENCE = 0.001


@pytest.fixture
def image_path(tmp_path):
    path = tmp_path / "photo.png"
    Image.new("RGB", (6, 4)).save(path)
    return path


class FakeYolo:
    """Callable like `ultralytics.YOLO`: returns the configured (label, confidence) detections."""

    names = {0: "dog", 1: "person", 2: "cat"}

    def __init__(self, detections=()):
        ids = {label: index for index, label in self.names.items()}
        self.boxes = [SimpleNamespace(cls=[ids[label]], conf=[conf]) for label, conf in detections]
        self.calls = []
        self.model = torch.nn.Linear(10, 10)

    def __call__(self, image, **options):
        self.calls.append(options)
        return [SimpleNamespace(boxes=self.boxes)]


def yolo_pipeline(detections=(), accepted=False):
    return SimpleNamespace(yolo_model=FakeYolo(detections), contains_animal=lambda image: accepted)


def test_importing_the_module_loads_no_model():
    probe = (
        "import sys; import benchmarks.moderators; "
        "sys.exit(any(name in sys.modules for name in ('app.ml.pipeline', 'ultralytics', 'open_clip')))"
    )
    result = subprocess.run([sys.executable, "-c", probe], cwd=BACKEND_IA, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


def test_registry_maps_variant_names_to_adapters():
    assert MODERATORS == {"yolo": YoloModerator, "clip": ClipZeroShot}


@pytest.mark.parametrize("accepted", [True, False])
def test_yolo_decision_is_the_production_contains_animal(image_path, accepted):
    moderator = YoloModerator(pipeline=yolo_pipeline(detections=[("dog", 0.9)], accepted=accepted))
    moderator.load()

    assert moderator.decide(image_path) is accepted


def test_yolo_score_is_the_highest_animal_confidence_at_a_low_threshold(image_path):
    pipeline = yolo_pipeline(detections=[("dog", 0.3), ("person", 0.95), ("cat", 0.6)])
    moderator = YoloModerator(pipeline=pipeline)
    moderator.load()

    assert moderator.score(image_path) == 0.6  # the person at 0.95 is not an animal
    assert pipeline.yolo_model.calls == [{"conf": LOW_CONFIDENCE}]


def test_yolo_score_is_zero_when_no_animal_is_detected(image_path):
    moderator = YoloModerator(pipeline=yolo_pipeline(detections=[("person", 0.95)]))
    moderator.load()

    assert moderator.score(image_path) == 0.0


def test_positive_softmax_mass_of_equal_logits_is_the_share_of_positive_prompts():
    assert positive_softmax_mass([0.0, 0.0, 0.0, 0.0], n_positive=1) == pytest.approx(0.25)
    assert positive_softmax_mass([0.0, 0.0, 0.0, 0.0], n_positive=3) == pytest.approx(0.75)


def test_positive_softmax_mass_follows_the_logits_and_does_not_overflow():
    assert positive_softmax_mass([math.log(3), 0.0, 0.0, 0.0], n_positive=1) == pytest.approx(0.5)
    assert positive_softmax_mass([1000.0, 0.0], n_positive=1) == pytest.approx(1.0)


def test_clip_prompts_are_fixed_constants():
    assert POSITIVE_PROMPTS == (
        "a photo of a dog",
        "a photo of a cat",
        "a photo of a bird",
        "a photo of a rabbit",
        "a photo of a turtle",
        "a photo of an animal",
    )
    assert NEGATIVE_PROMPTS == (
        "a photo of a person",
        "a photo of a landscape",
        "a photo of an object",
        "a drawing",
        "a photo of a plush toy",
    )


class FakeClipModel(torch.nn.Linear):
    """Image features are whatever the test sets; every positive prompt points to (1, 0), every negative to (0, 1)."""

    def __init__(self, image_feature, log_scale=0.0):
        super().__init__(5, 4)
        self.image_feature = torch.tensor([image_feature])
        self.logit_scale = torch.tensor(log_scale)

    def encode_image(self, batch):
        return self.image_feature

    def encode_text(self, tokens):
        return torch.tensor([[2.0, 0.0]] * len(POSITIVE_PROMPTS) + [[0.0, 2.0]] * len(NEGATIVE_PROMPTS))


def clip_moderator(image_feature, log_scale=0.0):
    tokenized = []

    def tokenizer(prompts):
        tokenized.append(list(prompts))
        return torch.zeros(len(prompts), 3)

    pipeline = SimpleNamespace(
        clip_model=FakeClipModel(image_feature, log_scale),
        clip_preprocess=lambda image: torch.zeros(3, 2, 2),
    )
    moderator = ClipZeroShot(pipeline=pipeline, tokenizer=tokenizer)
    moderator.load()
    return moderator, tokenized


def test_clip_scores_the_positive_softmax_mass_of_the_fixed_prompts(image_path):
    moderator, tokenized = clip_moderator([3.0, 0.0])  # unnormalised on purpose

    expected = 6 * math.e / (6 * math.e + 5)  # cosine 1 vs positives, 0 vs negatives, scale exp(0) = 1
    assert moderator.score(image_path) == pytest.approx(expected)
    assert tokenized == [list(POSITIVE_PROMPTS + NEGATIVE_PROMPTS)]


def test_clip_decision_accepts_an_animal_looking_image_and_rejects_the_rest(image_path):
    animal, _ = clip_moderator([1.0, 0.0], log_scale=math.log(100))
    other, _ = clip_moderator([0.0, 1.0], log_scale=math.log(100))

    assert animal.decide(image_path) is True
    assert other.decide(image_path) is False


@pytest.mark.parametrize("mass, accepted", [(0.5, True), (0.4999, False)])
def test_clip_decision_boundary_is_half_the_probability_mass(image_path, mass, accepted):
    moderator, _ = clip_moderator([1.0, 0.0])
    moderator.score = lambda path: mass

    assert moderator.decide(image_path) is accepted


def test_model_size_is_the_parameter_bytes_of_the_model_each_variant_uses():
    yolo = YoloModerator(pipeline=yolo_pipeline())
    yolo.load()
    clip, _ = clip_moderator([1.0, 0.0])

    assert yolo.model_size_mb() == pytest.approx(YOLO_BYTES / MIB)
    assert clip.model_size_mb() == pytest.approx(CLIP_BYTES / MIB)
