"""Genera y persiste el embedding de un reporte a partir de su imagen.

Descarga la imagen, detecta la mascota (YOLO) y genera el embedding
(OpenCLIP), luego hace upsert en `report_embeddings`. Sin colas ni
reintentos — ver "Fuera de alcance" del slice.
"""

import io

import httpx
from PIL import Image
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.pipeline import detect_and_crop, generate_embedding
from app.models import ReportEmbedding
from app.services import matching_service


async def process_report_image(report_id: int, image_url: str, session: AsyncSession) -> bool:
    """Descarga `image_url`, detecta la mascota y guarda su embedding.

    Devuelve True si se detectó una mascota y se guardó el embedding, False
    si no se detectó ninguna (sin más efectos secundarios: el flujo de
    "rechazar reporte" queda fuera de este slice).
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(image_url)
        response.raise_for_status()

    image = Image.open(io.BytesIO(response.content)).convert("RGB")

    crop = detect_and_crop(image)
    if crop is None:
        return False

    embedding = generate_embedding(crop)

    stmt = insert(ReportEmbedding).values(report_id=report_id, embedding=embedding)
    stmt = stmt.on_conflict_do_update(
        index_elements=[ReportEmbedding.report_id],
        set_={"embedding": stmt.excluded.embedding},
    )
    await session.execute(stmt)
    await session.commit()

    # Best-effort: si la búsqueda de matches falla, el embedding ya guardado
    # no debe deshacerse ni la request fallar por esto.
    try:
        await matching_service.find_and_store_matches(report_id, session)
    except Exception:  # noqa: BLE001 - no debe propagar, el embedding ya se guardó
        await session.rollback()

    return True
