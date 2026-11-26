import logging
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel

from app.config import settings
from app.services import image_analysis_service
from app.services.image_analysis_service import ImageUnavailableError

logger = logging.getLogger(__name__)


def _unauthorized() -> HTTPException:
    """Una instancia nueva por rechazo: reusar siempre la misma le va
    acumulando el `__traceback__` de cada request que la levanto.
    """
    return HTTPException(status_code=401, detail="Unauthorized")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Avisa al arrancar si el servicio quedo mal configurado.

    Sin este aviso, una INTERNAL_API_KEY faltante se manifiesta recien mas
    tarde y de forma muy poco obvia: el Backend Principal recibe 401, lo
    trata como respuesta inconclusa y los reportes se quedan en `pending`
    sin ningun error visible en pantalla.
    """
    if settings.internal_api_key:
        yield
        return

    if settings.allow_insecure_internal:
        logger.warning(
            "INTERNAL_API_KEY no esta configurada y ALLOW_INSECURE_INTERNAL=true: "
            "los endpoints /images/* aceptan requests SIN autenticar. "
            "Usar solo en desarrollo local, nunca en un entorno desplegado."
        )
    else:
        logger.error(
            "INTERNAL_API_KEY no esta configurada: los endpoints /images/* van a "
            "rechazar TODO con 401 y los reportes con imagen se van a quedar en pending. "
            "Configurala con el mismo valor en backend/.env y backend-ia/.env "
            "(ver backend-ia/README.md)."
        )
    yield


app = FastAPI(title="PATITAS - Backend IA", lifespan=lifespan)

_internal_key_header = APIKeyHeader(name="X-Internal-Key", auto_error=False)


async def verify_internal_key(key: str | None = Security(_internal_key_header)) -> None:
    """Valida que la request venga del Backend Principal via INTERNAL_API_KEY.

    Falla CERRADO: si `INTERNAL_API_KEY` no esta configurada se rechaza todo,
    salvo que alguien haya pedido la excepcion a mano con
    ALLOW_INSECURE_INTERNAL=true.

    El default importa mas que el mecanismo. Estos endpoints disparan inferencia
    de ML (CPU cara) y descargan URLs arbitrarias, asi que dejarlos pasar ante
    una variable faltante deja el servicio abierto justo en la configuracion en
    la que nadie lo configuro — que fue exactamente el agujero de la issue #106:
    la guarda existia pero retornaba sin validar.
    """
    if not settings.internal_api_key:
        if settings.allow_insecure_internal:
            return
        raise _unauthorized()

    # compare_digest en vez de `!=` para no filtrar la clave por el tiempo que
    # tarda la comparacion. Se comparan bytes porque compare_digest rechaza
    # cadenas con caracteres no ASCII.
    if key is None or not secrets.compare_digest(key.encode(), settings.internal_api_key.encode()):
        raise _unauthorized()


class ImageAnalysisRequest(BaseModel):
    image_url: str


def _validar_url_de_r2(image_url: str) -> None:
    """Rechaza con 422 cualquier URL fuera del prefijo R2, antes de descargar (SSRF).

    El prefijo se normaliza con barra final: así "https://pub.r2.dev.evil.com/..."
    y "https://pub.r2.dev@evil.com/..." no pasan. Sin R2_PUBLIC_URL se rechaza todo.
    """
    base = settings.r2_public_url.rstrip("/")
    if not base.startswith(("https://", "http://")) or not image_url.startswith(base + "/"):
        raise HTTPException(status_code=422, detail="La imagen no pertenece al bucket de R2")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/images/analyze")
async def analyze_image(
    body: ImageAnalysisRequest,
    _: None = Depends(verify_internal_key),
) -> dict[str, bool]:
    """Tell whether an uploaded image contains any animal and whether it looks blurry.

    200 with `has_animal` and `low_quality` on success (low quality is only a
    warning, #212), 422 if the image cannot be downloaded or decoded.
    """
    _validar_url_de_r2(body.image_url)
    try:
        analysis = await image_analysis_service.analyze_image(body.image_url)
    except ImageUnavailableError as exc:
        raise HTTPException(status_code=422, detail="No se pudo procesar la imagen") from exc

    return {"has_animal": analysis.has_animal, "low_quality": analysis.low_quality}


class ImageEmbeddingResponse(BaseModel):
    has_animal: bool
    embedding: list[float] | None


@app.post("/images/embedding")
async def embed_image(
    body: ImageAnalysisRequest,
    _: None = Depends(verify_internal_key),
) -> ImageEmbeddingResponse:
    """Embedding of an image, not persisted (moderation, matching and similar reports).

    200 with `has_animal` false and no embedding if no pet is detected, 422 if
    the image cannot be downloaded or decoded.
    """
    _validar_url_de_r2(body.image_url)
    try:
        embedding = await image_analysis_service.embed_image(body.image_url)
    except ImageUnavailableError as exc:
        raise HTTPException(status_code=422, detail="No se pudo procesar la imagen") from exc

    return ImageEmbeddingResponse(has_animal=embedding is not None, embedding=embedding)
