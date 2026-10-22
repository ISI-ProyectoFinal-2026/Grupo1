"""Moderation adapters: is there an animal in the image?

Every adapter exposes `name`, `model_ids`, `load()`, `decide(path)` (the accept/reject answer that is
timed), `score(path)` (a continuous value for the ROC) and `model_size_mb()`. Models load in `load()`
only, never at import.
"""

import numpy as np

from benchmarks.embedders import CLIP_ID, YOLO_ID, PipelineAdapter, open_rgb, parameters_mb

# Same ten COCO animals as `app.ml.pipeline._ANIMAL_LABELS`; tests/benchmarks/test_guards.py fails on drift.
YOLO_ANIMAL_LABELS = frozenset(
    {"bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"}
)
YOLO_SCORE_CONFIDENCE = 0.001  # keeps weak detections so the score can rank every image

# Fixed in advance and never tuned on the data. The animal prompts follow the animal classes of the
# dataset plus a generic one; the others follow its no_animal classes (screenshot has no images).
POSITIVE_PROMPTS = (
    "a photo of a dog",
    "a photo of a cat",
    "a photo of a bird",
    "a photo of a rabbit",
    "a photo of a turtle",
    "a photo of an animal",
)
NEGATIVE_PROMPTS = (
    "a photo of a person",
    "a photo of a landscape",
    "a photo of an object",
    "a drawing",
    "a photo of a plush toy",
)
CLIP_ACCEPT_MASS = 0.5
CLIP_MODEL_NAME = "ViT-B-32"


def positive_softmax_mass(logits, n_positive: int) -> float:
    """Softmax probability mass of the first `n_positive` prompts."""
    values = np.asarray(logits, dtype=float)
    weights = np.exp(values - values.max())
    return float(weights[:n_positive].sum() / weights.sum())


class YoloModerator(PipelineAdapter):
    """Production YOLOv8n screening: the decision is `contains_animal`, the score the best animal confidence."""

    name = "yolo"
    model_ids = {"yolo": YOLO_ID}

    def decide(self, path) -> bool:
        return bool(self._pipeline.contains_animal(open_rgb(path)))

    def score(self, path) -> float:
        yolo = self._pipeline.yolo_model
        best = 0.0
        for result in yolo(open_rgb(path), conf=YOLO_SCORE_CONFIDENCE):
            for box in result.boxes or []:
                if yolo.names[int(box.cls[0])] in YOLO_ANIMAL_LABELS:
                    best = max(best, float(box.conf[0]))
        return best

    def model_size_mb(self) -> float:
        return parameters_mb(self._pipeline.yolo_model.model)


class ClipZeroShot(PipelineAdapter):
    """OpenCLIP zero-shot: probability mass of the animal prompts among all the fixed prompts."""

    name = "clip"
    model_ids = {"clip": CLIP_ID}

    def __init__(self, pipeline=None, tokenizer=None) -> None:
        super().__init__(pipeline)
        self._tokenizer = tokenizer
        self._text_features = None

    def load(self) -> None:
        import torch

        super().load()
        tokenizer = self._tokenizer
        if tokenizer is None:
            import open_clip  # deferred: only needed when no tokenizer is injected

            tokenizer = open_clip.get_tokenizer(CLIP_MODEL_NAME)
        tokens = tokenizer(list(POSITIVE_PROMPTS + NEGATIVE_PROMPTS))
        with torch.no_grad():
            features = self._pipeline.clip_model.encode_text(tokens)
        self._text_features = features / features.norm(dim=-1, keepdim=True)

    def score(self, path) -> float:
        import torch

        model = self._pipeline.clip_model
        batch = self._pipeline.clip_preprocess(open_rgb(path)).unsqueeze(0)
        with torch.no_grad():
            feature = model.encode_image(batch)[0]
            feature = feature / feature.norm()
            logits = model.logit_scale.exp() * (self._text_features @ feature)
        return positive_softmax_mass(logits.numpy(), len(POSITIVE_PROMPTS))

    def decide(self, path) -> bool:
        return self.score(path) >= CLIP_ACCEPT_MASS

    def model_size_mb(self) -> float:
        return parameters_mb(self._pipeline.clip_model)


MODERATORS = {cls.name: cls for cls in (YoloModerator, ClipZeroShot)}
