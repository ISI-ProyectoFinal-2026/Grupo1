"""Tests for app.services.image_analysis_service.

The HTTP download goes through httpx.MockTransport and `contains_animal` is
mocked: the focus is the download/decode wiring, its limits and how failures
are reported, not the ML model.
"""

import io
import threading

import httpx
import pytest
from PIL import Image

from app.services import image_analysis_service
from app.services.image_analysis_service import MAX_IMAGE_BYTES, ImageUnavailableError

_RealAsyncClient = httpx.AsyncClient


def _png_bytes(size: int = 32) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (size, size), color="blue").save(buf, format="PNG")
    return buf.getvalue()


def _serve(monkeypatch, handler):
    """Route every request of the service's AsyncClient to `handler`."""

    def factory(*args, **kwargs):
        return _RealAsyncClient(*args, transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(image_analysis_service.httpx, "AsyncClient", factory)


def _serve_bytes(monkeypatch, content: bytes, status_code: int = 200):
    _serve(monkeypatch, lambda request: httpx.Response(status_code, content=content))


@pytest.mark.asyncio
async def test_returns_true_when_the_image_contains_an_animal(monkeypatch):
    _serve_bytes(monkeypatch, _png_bytes())
    monkeypatch.setattr(image_analysis_service, "contains_animal", lambda image: True)

    assert await image_analysis_service.image_has_animal("https://example.com/dog.png") is True


@pytest.mark.asyncio
async def test_returns_false_when_the_image_has_no_animal(monkeypatch):
    _serve_bytes(monkeypatch, _png_bytes())
    monkeypatch.setattr(image_analysis_service, "contains_animal", lambda image: False)

    assert await image_analysis_service.image_has_animal("https://example.com/car.png") is False


@pytest.mark.asyncio
async def test_runs_inference_off_the_event_loop_thread(monkeypatch):
    """YOLO inference is CPU-bound: on the loop thread it would stall every
    other request the service is handling."""
    _serve_bytes(monkeypatch, _png_bytes())
    loop_thread = threading.get_ident()
    seen_threads = []

    def fake_contains_animal(image):
        seen_threads.append(threading.get_ident())
        return True

    monkeypatch.setattr(image_analysis_service, "contains_animal", fake_contains_animal)

    await image_analysis_service.image_has_animal("https://example.com/dog.png")

    assert seen_threads and seen_threads[0] != loop_thread


@pytest.mark.asyncio
async def test_raises_image_unavailable_when_the_download_fails(monkeypatch):
    def handler(request):
        raise httpx.ConnectError("boom", request=request)

    _serve(monkeypatch, handler)

    with pytest.raises(ImageUnavailableError):
        await image_analysis_service.image_has_animal("https://example.com/x.png")


@pytest.mark.asyncio
async def test_raises_image_unavailable_on_http_error_status(monkeypatch):
    _serve_bytes(monkeypatch, b"", status_code=404)

    with pytest.raises(ImageUnavailableError):
        await image_analysis_service.image_has_animal("https://example.com/missing.png")


@pytest.mark.asyncio
async def test_raises_image_unavailable_when_the_bytes_are_not_an_image(monkeypatch):
    _serve_bytes(monkeypatch, b"not an image")

    with pytest.raises(ImageUnavailableError):
        await image_analysis_service.image_has_animal("https://example.com/file.txt")


@pytest.mark.asyncio
async def test_raises_image_unavailable_when_the_download_exceeds_the_size_cap(monkeypatch):
    contains = []
    monkeypatch.setattr(image_analysis_service, "contains_animal", lambda image: contains.append(1))

    def handler(request):
        # A streamed body without Content-Length: the cap must apply while reading.
        async def body():
            chunk = b"\0" * 1_000_000
            for _ in range(MAX_IMAGE_BYTES // len(chunk) + 1):
                yield chunk

        return httpx.Response(200, content=body())

    _serve(monkeypatch, handler)

    with pytest.raises(ImageUnavailableError):
        await image_analysis_service.image_has_animal("https://example.com/huge.png")
    assert contains == []


@pytest.mark.asyncio
async def test_rejects_early_when_content_length_exceeds_the_size_cap(monkeypatch):
    _serve(
        monkeypatch,
        lambda request: httpx.Response(
            200, headers={"Content-Length": str(MAX_IMAGE_BYTES + 1)}, content=b"x"
        ),
    )

    with pytest.raises(ImageUnavailableError):
        await image_analysis_service.image_has_animal("https://example.com/huge.png")


@pytest.mark.asyncio
async def test_raises_image_unavailable_on_a_decompression_bomb(monkeypatch):
    # A 64x64 image is > 2x a 100-pixel limit, which PIL treats as a bomb.
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 100)
    _serve_bytes(monkeypatch, _png_bytes(64))

    with pytest.raises(ImageUnavailableError):
        await image_analysis_service.image_has_animal("https://example.com/bomb.png")
