"""Screens an uploaded image before a report is created.

Downloads the image and asks YOLO whether it shows any animal and whether the
pet looks blurry (#212), or returns its embedding to rank similar reports
(#211). Nothing is persisted.
"""

import asyncio
import io
from dataclasses import dataclass

import httpx
from PIL import Image, UnidentifiedImageError

from app.ml.pipeline import detect_and_crop, generate_embedding
from app.ml.quality import is_low_quality

# Short on purpose: the user is waiting on this answer while filling the form.
_DOWNLOAD_TIMEOUT_SECONDS = 10.0

# Same cap as MAX_FILE_SIZE in backend/src/validators/uploads.validator.ts:
# nothing larger can be uploaded legitimately, so reading more is only a DoS.
MAX_IMAGE_BYTES = 10_000_000


class ImageUnavailableError(Exception):
    """The image could not be downloaded or decoded."""


@dataclass(frozen=True)
class ImageAnalysis:
    has_animal: bool
    # only a warning for the user; always False without an animal
    low_quality: bool


async def _download(image_url: str) -> bytes:
    try:
        async with httpx.AsyncClient(timeout=_DOWNLOAD_TIMEOUT_SECONDS) as client:
            async with client.stream("GET", image_url) as response:
                response.raise_for_status()
                declared = response.headers.get("Content-Length")
                if declared is not None and declared.isdigit() and int(declared) > MAX_IMAGE_BYTES:
                    raise ImageUnavailableError("image exceeds the size limit")

                buffer = bytearray()
                async for chunk in response.aiter_bytes():
                    buffer.extend(chunk)
                    if len(buffer) > MAX_IMAGE_BYTES:
                        raise ImageUnavailableError("image exceeds the size limit")
                return bytes(buffer)
    except httpx.HTTPError as exc:
        raise ImageUnavailableError(f"could not download image: {exc}") from exc


def _decode(content: bytes) -> Image.Image:
    try:
        return Image.open(io.BytesIO(content)).convert("RGB")
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
        raise ImageUnavailableError(f"could not decode image: {exc}") from exc


def _decode_and_analyze(content: bytes) -> ImageAnalysis:
    """CPU-bound: decode the bytes, run YOLO and measure the pet's sharpness. Runs in a worker thread."""
    # one YOLO pass: detect_and_crop finds an animal under the same criteria as contains_animal
    crop = detect_and_crop(_decode(content))
    if crop is None:
        return ImageAnalysis(has_animal=False, low_quality=False)
    return ImageAnalysis(has_animal=True, low_quality=is_low_quality(crop))


def _decode_and_embed(content: bytes) -> list[float] | None:
    # misma cadena que embedding_service: YOLO recorta y OpenCLIP embebe
    crop = detect_and_crop(_decode(content))
    return None if crop is None else generate_embedding(crop)


async def analyze_image(image_url: str) -> ImageAnalysis:
    """Return whether the image at `image_url` contains any animal and, if so,
    whether the pet looks blurry.

    Raises ImageUnavailableError if the image cannot be fetched or decoded,
    or exceeds MAX_IMAGE_BYTES.
    """
    content = await _download(image_url)
    # Off the event loop: decoding and YOLO inference would otherwise block
    # every other request this service is handling.
    return await asyncio.to_thread(_decode_and_analyze, content)


async def embed_image(image_url: str) -> list[float] | None:
    """Return the OpenCLIP embedding of the pet in the image, or None if there is none.

    Raises ImageUnavailableError like analyze_image.
    """
    content = await _download(image_url)
    return await asyncio.to_thread(_decode_and_embed, content)
