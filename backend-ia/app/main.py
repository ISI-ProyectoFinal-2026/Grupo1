from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import check_connection, get_db
from app.services import embedding_service

app = FastAPI(title="PATITAS - Backend IA")


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
) -> dict[str, str]:
    """Genera y guarda el embedding de la imagen de un reporte.

    201 si se detectó una mascota y se guardó el embedding, 422 si no se
    detectó ninguna en la imagen.
    """
    saved = await embedding_service.process_report_image(report_id, body.image_url, session)
    if not saved:
        raise HTTPException(status_code=422, detail="No se detectó una mascota en la imagen")

    return {"status": "ok"}
