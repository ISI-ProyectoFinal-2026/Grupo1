"""Screens an uploaded image before a report is created.

Downloads the image and asks YOLO whether it shows any animal. Nothing is
persisted: this only answers "is this plausibly a pet photo?" so the main
backend can reject spam uploads up front.
"""

import asyncio
import io

import httpx
from PIL import Image, UnidentifiedImageError

from app.ml.pipeline import contains_animal

# Short on purpose: the user is waiting on this answer while filling the form.
_DOWNLOAD_TIMEOUT_SECONDS = 10.0

# Same cap as MAX_FILE_SIZE in backend/src/validators/uploads.validator.ts:
# nothing larger can be uploaded legitimately, so reading more is only a DoS.
MAX_IMAGE_BYTES = 10_000_000


class ImageUnavailableError(Exception):
    """The image could not be downloaded or decoded."""


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


def _decode_and_detect(content: bytes) -> bool:
    """CPU-bound: decode the bytes and run YOLO. Runs in a worker thread."""
    try:
        image = Image.open(io.BytesIO(content)).convert("RGB")
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
        raise ImageUnavailableError(f"could not decode image: {exc}") from exc
    return contains_animal(image)


async def image_has_animal(image_url: str) -> bool:
    """Return whether the image at `image_url` contains any animal.

    Raises ImageUnavailableError if the image cannot be fetched or decoded,
    or exceeds MAX_IMAGE_BYTES.
    """
    content = await _download(image_url)
    # Off the event loop: decoding and YOLO inference would otherwise block
    # every other request this service is handling.
    return await asyncio.to_thread(_decode_and_detect, content)
