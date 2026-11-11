"""Busca y persiste matches por similitud (pgvector) entre reportes de tipo
opuesto (lost↔found), cerca en el tiempo y el espacio.

Se ejecuta luego de guardar el embedding de un reporte (ver
`embedding_service.process_report_image`). La query cruda sigue el mismo
criterio que `reports.service.ts` en Node para SQL crudo sobre columnas
PostGIS/pgvector — ver docs/ARQUITECTURA.md sección 4.3.
"""

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

# Umbrales calibrados con el benchmark de identidad sobre el pipeline de
# producción (DINOv2 @224px, 596 fotos de 92 perros y gatos, foto de consulta
# degradada a 480px + JPEG q50): misma mascota ≈ 0.63 de media, mascotas
# distintas ≈ 0.09. Calibrados a ciegas con validación cruzada por animal, el
# 3% y el 0.3% de falsos positivos caen en 0.42 y 0.61. Ninguna similitud
# global es infalible (misma raza + mismo color se confunden), así que hay dos
# niveles:
#
# - MATCH_THRESHOLD (0.45): se persiste como "posible coincidencia" para que
#   los dueños la revisen y la confirmen o rechacen. Con 20 reportes cercanos
#   y el umbral calibrado (0.42), la mascota correcta se encontró en el 88% de
#   los casos.
# - NOTIFY_THRESHOLD (0.63): además se notifica activamente a los dueños (con
#   el umbral calibrado, 0.61, hubo 0.06 notificaciones falsas por reporte).
#
# Dependen de pipeline.DINO_INPUT_SIZE: cambiar la resolución mueve la escala.
#
# Valores provisionales: el benchmark usa fotos prolijas de animales famosos;
# recalibrar con matches confirmados/rechazados reales.
#
# Los valores viven en app.config.Settings (MATCH_THRESHOLD, NOTIFY_THRESHOLD,
# MATCH_RADIUS_METERS, MATCH_WINDOW_DAYS, MATCH_TOP_K) y se leen en cada
# llamada.

# autor sin suspensión vigente (mismo criterio que activeAuthorSql en Node)
_AUTHOR_NOT_SUSPENDED_SQL = """
    NOT EXISTS (
        SELECT 1 FROM account_sanctions s
        WHERE s.user_id = r.user_id AND s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at > :now)
    )
"""


# ahora en UTC sin tz: account_sanctions usa timestamp(3) en UTC (Prisma)
def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _notify_match(lost_id: int, found_id: int, similarity: float) -> None:
    """Avisa al Backend Principal que se creó/actualizó un match para que
    dispare las notificaciones a los dueños de ambos reportes (ver
    notifications.service.ts, notifyMatch, y el endpoint interno
    POST /api/notifications/internal/match en notifications.routes.ts).

    Best-effort: no debe romper ni retrasar el flujo de matching. Si
    NODE_BACKEND_URL no está configurada, no hace nada (mismo criterio que
    AI_SERVICE_URL del lado Node en matching.service.ts).
    """
    if not settings.node_backend_url:
        return

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.node_backend_url}/api/notifications/internal/match",
                headers={"X-Internal-Key": settings.internal_api_key},
                json={
                    "lostReportId": lost_id,
                    "foundReportId": found_id,
                    "similarityScore": similarity,
                },
            )
    except Exception:  # noqa: BLE001 - best-effort, nunca debe romper el flujo de matching
        logger.exception(
            "fallo al notificar match al Backend Principal (lost_id=%s, found_id=%s)", lost_id, found_id
        )


async def find_and_store_matches(report_id: int, session: AsyncSession) -> int:
    """Busca candidatos a match para `report_id` (recién procesado) y
    persiste los que superen `settings.match_threshold` en `report_matches`.
    Solo los que además superen `settings.notify_threshold` disparan la
    notificación.

    Devuelve la cantidad de matches creados/actualizados.
    """
    now = _utc_now()
    source_result = await session.execute(
        text(
            f"""
            SELECT r.report_type, r.location, re.embedding
            FROM reports r
            JOIN report_embeddings re ON re.report_id = r.id
            WHERE r.id = :report_id
              AND {_AUTHOR_NOT_SUSPENDED_SQL}
            """
        ),
        {"report_id": report_id, "now": now},
    )
    source = source_result.mappings().first()
    if source is None:
        return 0

    candidates_result = await session.execute(
        text(
            f"""
            -- `<=>` es distancia COSENO en pgvector, así que `1 - (a <=> b)` es
            -- la similitud coseno con la que se calibraron MATCH_THRESHOLD y
            -- NOTIFY_THRESHOLD. NO usar `<->`: ese es distancia L2 y, aun con
            -- embeddings normalizados, `1 - L2` no es la similitud coseno
            -- (dos fotos de la misma mascota con coseno 0.70 dan L2 0.77, o sea
            -- 0.23 "similitud", debajo de ambos umbrales: no matchearía nunca).
            -- `<=>` es además el operador que puede usar el índice HNSW, creado
            -- con `vector_cosine_ops` (ver backend/prisma/migrations/
            -- 20260813000000_fix_report_embedding_dimension).
            --
            -- ST_DWithin recibe metros cuando ambos operandos son `geography`.
            -- `r.location` es `geometry(Point, 4326)` (grados WGS84): sin el
            -- cast a geography, "5000" se interpretaría como 5000 GRADOS (todo
            -- el planeta), no 5000 metros.
            SELECT r.id, r.report_type, 1 - (re.embedding <=> :embedding) AS similarity
            FROM reports r
            JOIN report_embeddings re ON re.report_id = r.id
            WHERE r.status = 'published'
              AND r.report_type != :report_type
              AND r.id != :report_id
              AND ST_DWithin(r.location::geography, CAST(:location AS geography), :radius_meters)
              AND r.created_at > NOW() - make_interval(days => :window_days)
              AND {_AUTHOR_NOT_SUSPENDED_SQL}
            ORDER BY re.embedding <=> :embedding ASC
            LIMIT :top_k
            """
        ),
        {
            "embedding": source["embedding"],
            "report_type": source["report_type"],
            "report_id": report_id,
            "location": source["location"],
            "now": now,
            "radius_meters": settings.match_radius_meters,
            "window_days": settings.match_window_days,
            "top_k": settings.match_top_k,
        },
    )

    matches_created = 0
    for candidate in candidates_result.mappings():
        if candidate["similarity"] < settings.match_threshold:
            continue

        if source["report_type"] == "lost":
            lost_id, found_id = report_id, candidate["id"]
        else:
            lost_id, found_id = candidate["id"], report_id

        upsert_result = await session.execute(
            text(
                """
                INSERT INTO report_matches (report_lost_id, report_found_id, similarity_score, created_at)
                VALUES (:lost_id, :found_id, :similarity, now())
                ON CONFLICT (report_lost_id, report_found_id)
                DO UPDATE SET similarity_score = EXCLUDED.similarity_score
                WHERE report_matches.status = 'pending'
                RETURNING id
                """
            ),
            {"lost_id": lost_id, "found_id": found_id, "similarity": candidate["similarity"]},
        )
        if upsert_result.first() is not None:
            matches_created += 1
            if candidate["similarity"] >= settings.notify_threshold:
                await _notify_match(lost_id, found_id, candidate["similarity"])

    await session.commit()
    return matches_created
