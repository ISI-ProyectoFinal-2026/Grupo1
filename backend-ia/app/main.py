import logging
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import check_connection, get_db
from app.services import embedding_service

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
            "POST /reports/{id}/embedding acepta requests SIN autenticar. "
            "Usar solo en desarrollo local, nunca en un entorno desplegado."
        )
    else:
        logger.error(
            "INTERNAL_API_KEY no esta configurada: POST /reports/{id}/embedding va a "
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

    El default importa mas que el mecanismo. Este endpoint dispara inferencia
    de ML y escribe en `report_embeddings` / `report_matches`, asi que dejarlo
    pasar ante una variable faltante deja el servicio abierto justo en la
    configuracion en la que nadie lo configuro — que fue exactamente el agujero
    de la issue #106: la guarda existia pero retornaba sin validar.
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


class EmbeddingRequest(BaseModel):
    image_url: str


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
async def health_db() -> dict[str, str]:
    """Cumple el criterio de aceptación 'Conexión funcionando exitosamente'."""
    try:
        ok = await check_connection()
    except Exception as exc:  # noqa: BLE001 - se traduce a 503 para el caller
        raise HTTPException(status_code=503, detail=f"database unreachable: {exc}") from exc

    if not ok:
        raise HTTPException(status_code=503, detail="pgvector extension not found")

    return {"status": "ok"}


@app.post("/reports/{report_id}/embedding", status_code=201)
async def create_report_embedding(
    report_id: int,
    body: EmbeddingRequest,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(verify_internal_key),
) -> dict[str, str]:
    """Genera y guarda el embedding de la imagen de un reporte.

    201 si se detectó una mascota y se guardó el embedding, 422 si no se
    detectó ninguna en la imagen.
    """
    saved = await embedding_service.process_report_image(report_id, body.image_url, session)
    if not saved:
        raise HTTPException(status_code=422, detail="No se detectó una mascota en la imagen")

    return {"status": "ok"}
