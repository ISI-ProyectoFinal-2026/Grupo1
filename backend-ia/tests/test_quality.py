"""Tests for app.ml.quality: sharpness of the pet crop (issue #212)."""

import numpy as np
import pytest
from PIL import Image, ImageFilter

from app.ml import quality


def _checkerboard(width: int = 512, height: int = 512, square: int = 8) -> Image.Image:
    ys, xs = np.indices((height, width))
    board = (((xs // square) + (ys // square)) % 2 * 255).astype(np.uint8)
    return Image.fromarray(board, mode="L").convert("RGB")


def test_a_sharp_image_is_above_the_threshold():
    assert quality.sharpness(_checkerboard()) >= quality.SHARPNESS_THRESHOLD
    assert quality.is_low_quality(_checkerboard()) is False


def test_a_blurred_image_is_below_the_threshold():
    blurred = _checkerboard().filter(ImageFilter.GaussianBlur(8))

    assert quality.sharpness(blurred) < quality.SHARPNESS_THRESHOLD
    assert quality.is_low_quality(blurred) is True


def test_a_flat_image_has_zero_sharpness():
    assert quality.sharpness(Image.new("RGB", (300, 200), (120, 80, 40))) == 0.0


def test_the_threshold_is_the_calibrated_value():
    assert quality.SHARPNESS_THRESHOLD == 10.0


# The score is measured with the longer side at 512 px, so the same content
# scores the same whatever the resolution of the upload.
def test_the_crop_is_resized_to_512_px_on_its_longer_side_keeping_the_aspect_ratio(monkeypatch):
    sizes = []
    real_resize = Image.Image.resize

    def spy_resize(self, size, *args, **kwargs):
        sizes.append(size)
        return real_resize(self, size, *args, **kwargs)

    monkeypatch.setattr(Image.Image, "resize", spy_resize)

    quality.sharpness(_checkerboard(width=1000, height=300))
    quality.sharpness(_checkerboard(width=100, height=250))

    assert sizes == [(512, 154), (205, 512)]


def test_matches_the_variance_of_a_3x3_laplacian_with_reflected_borders():
    gray = np.array(
        [[10, 20, 30, 40], [50, 60, 70, 80], [90, 100, 110, 120], [130, 140, 150, 255]], dtype=np.uint8
    )
    image = Image.fromarray(gray, mode="L").convert("RGB").resize((512, 512), Image.BILINEAR)

    resized = np.asarray(image.convert("L"), dtype=np.float64)
    padded = np.pad(resized, 1, mode="reflect")
    expected = np.zeros_like(resized)
    rows, cols = resized.shape
    for dy, dx, weight in [(0, 1, 1), (1, 0, 1), (1, 1, -4), (1, 2, 1), (2, 1, 1)]:
        expected += weight * padded[dy : dy + rows, dx : dx + cols]

    assert quality.sharpness(image) == pytest.approx(expected.var())


def test_an_empty_crop_counts_as_low_quality():
    assert quality.is_low_quality(Image.new("RGB", (0, 10))) is True
