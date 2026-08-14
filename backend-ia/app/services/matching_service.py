"""Busca y persiste matches por similitud (pgvector) entre reportes de tipo
opuesto (lost↔found), cerca en el tiempo y el espacio.

Se ejecuta luego de guardar el embedding de un reporte (ver
`embedding_service.process_report_image`). La query cruda sigue el mismo
criterio que `reports.service.ts` en Node para SQL crudo sobre columnas
PostGIS/pgvector — ver docs/ARQUITECTURA.md sección 4.3.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# El POC (docs/pocs/poc_similitudes.md) midió, con OpenCLIP+YOLO: misma
# mascota ≈ 85-89% similitud coseno, mascotas distintas ≈ 65%, dejando
# pendiente calibrar el umbral exacto dentro de ese rango. Se usa el punto
# medio del rango, 75% similitud (distancia coseno < 0.25), como constante
# documentada y fácil de ajustar — no es un valor definitivo.
SIMILARITY_THRESHOLD = 0.75


async def find_and_store_matches(report_id: int, session: AsyncSession) -> int:
    """Busca candidatos a match para `report_id` (recién procesado) y
    persiste los que superen SIMILARITY_THRESHOLD en `report_matches`.

    Devuelve la cantidad de matches creados/actualizados.
    """
    source_result = await session.execute(
        text(
            """
            SELECT r.report_type, r.location, re.embedding
            FROM reports r
            JOIN report_embeddings re ON re.report_id = r.id
            WHERE r.id = :report_id
            """
        ),
        {"report_id": report_id},
    )
    source = source_result.mappings().first()
    if source is None:
        return 0

    candidates_result = await session.execute(
        text(
            """
            -- ST_DWithin recibe metros cuando ambos operandos son `geography`.
            -- `r.location` es `geometry(Point, 4326)` (grados WGS84): sin el
            -- cast a geography, "5000" se interpretaría como 5000 GRADOS (todo
            -- el planeta), no 5000 metros.
            SELECT r.id, r.report_type, 1 - (re.embedding <-> :embedding) AS similarity
            FROM reports r
            JOIN report_embeddings re ON re.report_id = r.id
            WHERE r.status = 'published'
              AND r.report_type != :report_type
              AND r.id != :report_id
              AND ST_DWithin(r.location::geography, CAST(:location AS geography), 5000)
              AND r.created_at > NOW() - INTERVAL '30 days'
            ORDER BY re.embedding <-> :embedding ASC
            LIMIT 5
            """
        ),
        {
            "embedding": source["embedding"],
            "report_type": source["report_type"],
            "report_id": report_id,
            "location": source["location"],
        },
    )

    matches_created = 0
    for candidate in candidates_result.mappings():
        if candidate["similarity"] < SIMILARITY_THRESHOLD:
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

    await session.commit()
    return matches_created
