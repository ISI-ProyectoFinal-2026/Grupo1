"""Tests de app.services.matching_service contra la DB real de test (mismo
patrón que test_embedding_service.py). Siembra reportes/embeddings por SQL
crudo y verifica qué queda persistido en `report_matches`.
"""

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import text

from app.db import async_session_factory
from app.services import matching_service

NEAR_LAT, NEAR_LNG = -34.6037, -58.3816  # Plaza de Mayo, CABA
FAR_LAT, FAR_LNG = -34.6037, -57.9000  # ~40km al este, fuera del radio de 5km

EMBEDDING_A = [0.5] * 512
EMBEDDING_DISTINTO = [-0.5] * 512  # muy lejos de A en distancia, baja similitud


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(str(float(v)) for v in values) + "]"


async def _insert_user(session, email: str) -> int:
    result = await session.execute(
        text(
            """
            INSERT INTO users (email, password_hash, updated_at)
            VALUES (:email, 'test-hash', now())
            RETURNING id
            """
        ),
        {"email": email},
    )
    return result.scalar_one()


async def _insert_report(
    session,
    user_id: int,
    report_type: str,
    lat: float,
    lng: float,
    created_at_expr: str = "now()",
) -> int:
    result = await session.execute(
        text(
            f"""
            INSERT INTO reports (
                user_id, report_type, status, title, location, created_at, updated_at
            )
            VALUES (
                :user_id, :report_type, 'published'::report_status, 'Test report',
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), {created_at_expr}, now()
            )
            RETURNING id
            """
        ),
        {"user_id": user_id, "report_type": report_type, "lat": lat, "lng": lng},
    )
    return result.scalar_one()


async def _insert_embedding(session, report_id: int, embedding: list[float]) -> None:
    await session.execute(
        text(
            """
            INSERT INTO report_embeddings (report_id, embedding, created_at)
            VALUES (:report_id, :embedding, now())
            """
        ),
        {"report_id": report_id, "embedding": _vector_literal(embedding)},
    )


@pytest_asyncio.fixture
async def scenario():
    """Siembra: un 'found' con embedding A (el reporte "recién procesado"),
    y 5 candidatos alrededor:
      - lost_match: embedding == A, opuesto, cerca, reciente -> DEBE matchear.
      - lost_baja_similitud: embedding muy distinto, opuesto, cerca, reciente -> NO matchea (similitud < umbral).
      - found_mismo_tipo: embedding == A, MISMO tipo, cerca, reciente -> filtrado por tipo.
      - lost_fuera_de_radio: embedding == A, opuesto, LEJOS, reciente -> filtrado por radio.
      - lost_fuera_de_recencia: embedding == A, opuesto, cerca, VIEJO (>30 días) -> filtrado por recencia.
    """
    email = f"matching-service-test-{uuid.uuid4()}@example.com"
    async with async_session_factory() as session:
        user_id = await _insert_user(session, email)

        found_id = await _insert_report(session, user_id, "found", NEAR_LAT, NEAR_LNG)
        await _insert_embedding(session, found_id, EMBEDDING_A)

        lost_match_id = await _insert_report(session, user_id, "lost", NEAR_LAT, NEAR_LNG)
        await _insert_embedding(session, lost_match_id, EMBEDDING_A)

        lost_baja_similitud_id = await _insert_report(session, user_id, "lost", NEAR_LAT, NEAR_LNG)
        await _insert_embedding(session, lost_baja_similitud_id, EMBEDDING_DISTINTO)

        found_mismo_tipo_id = await _insert_report(session, user_id, "found", NEAR_LAT, NEAR_LNG)
        await _insert_embedding(session, found_mismo_tipo_id, EMBEDDING_A)

        lost_fuera_de_radio_id = await _insert_report(session, user_id, "lost", FAR_LAT, FAR_LNG)
        await _insert_embedding(session, lost_fuera_de_radio_id, EMBEDDING_A)

        lost_fuera_de_recencia_id = await _insert_report(
            session, user_id, "lost", NEAR_LAT, NEAR_LNG, created_at_expr="now() - interval '40 days'"
        )
        await _insert_embedding(session, lost_fuera_de_recencia_id, EMBEDDING_A)

        await session.commit()

    ids = {
        "user_id": user_id,
        "found_id": found_id,
        "lost_match_id": lost_match_id,
        "lost_baja_similitud_id": lost_baja_similitud_id,
        "found_mismo_tipo_id": found_mismo_tipo_id,
        "lost_fuera_de_radio_id": lost_fuera_de_radio_id,
        "lost_fuera_de_recencia_id": lost_fuera_de_recencia_id,
    }

    yield ids

    report_ids = [v for k, v in ids.items() if k != "user_id"]
    async with async_session_factory() as session:
        await session.execute(
            text(
                "DELETE FROM report_matches WHERE report_lost_id = ANY(:ids) OR report_found_id = ANY(:ids)"
            ),
            {"ids": report_ids},
        )
        await session.execute(text("DELETE FROM report_embeddings WHERE report_id = ANY(:ids)"), {"ids": report_ids})
        await session.execute(text("DELETE FROM reports WHERE id = ANY(:ids)"), {"ids": report_ids})
        await session.execute(text("DELETE FROM users WHERE id = :id"), {"id": ids["user_id"]})
        await session.commit()


@pytest.mark.asyncio
async def test_crea_match_solo_para_el_candidato_similar_opuesto_cerca_y_reciente(scenario):
    async with async_session_factory() as session:
        created = await matching_service.find_and_store_matches(scenario["found_id"], session)

    assert created == 1

    async with async_session_factory() as session:
        result = await session.execute(
            text("SELECT report_lost_id, report_found_id, similarity_score, status FROM report_matches")
        )
        rows = result.mappings().all()

    assert len(rows) == 1
    row = rows[0]
    assert row["report_lost_id"] == scenario["lost_match_id"]
    assert row["report_found_id"] == scenario["found_id"]
    assert row["similarity_score"] == pytest.approx(1.0, abs=1e-6)
    assert row["status"] == "pending"


@pytest.mark.asyncio
async def test_no_crea_match_para_decoys(scenario):
    async with async_session_factory() as session:
        await matching_service.find_and_store_matches(scenario["found_id"], session)

    decoy_ids = {
        scenario["lost_baja_similitud_id"],
        scenario["found_mismo_tipo_id"],
        scenario["lost_fuera_de_radio_id"],
        scenario["lost_fuera_de_recencia_id"],
    }

    async with async_session_factory() as session:
        result = await session.execute(
            text("SELECT report_lost_id, report_found_id FROM report_matches")
        )
        rows = result.mappings().all()

    involved_ids = {row["report_lost_id"] for row in rows} | {row["report_found_id"] for row in rows}
    assert involved_ids.isdisjoint(decoy_ids)


@pytest.mark.asyncio
async def test_correr_dos_veces_no_duplica(scenario):
    async with async_session_factory() as session:
        first = await matching_service.find_and_store_matches(scenario["found_id"], session)
    async with async_session_factory() as session:
        second = await matching_service.find_and_store_matches(scenario["found_id"], session)

    assert first == 1
    assert second == 1  # sigue "pending", se actualiza sin duplicar

    async with async_session_factory() as session:
        result = await session.execute(
            text(
                "SELECT COUNT(*) FROM report_matches WHERE report_lost_id = :lost_id AND report_found_id = :found_id"
            ),
            {"lost_id": scenario["lost_match_id"], "found_id": scenario["found_id"]},
        )
        assert result.scalar_one() == 1


@pytest.mark.asyncio
async def test_no_pisa_un_match_ya_confirmado(scenario):
    async with async_session_factory() as session:
        await matching_service.find_and_store_matches(scenario["found_id"], session)

    async with async_session_factory() as session:
        await session.execute(
            text(
                """
                UPDATE report_matches
                SET status = 'confirmed'::match_status, similarity_score = 0.42
                WHERE report_lost_id = :lost_id AND report_found_id = :found_id
                """
            ),
            {"lost_id": scenario["lost_match_id"], "found_id": scenario["found_id"]},
        )
        await session.commit()

    async with async_session_factory() as session:
        second_run_created = await matching_service.find_and_store_matches(scenario["found_id"], session)

    assert second_run_created == 0

    async with async_session_factory() as session:
        result = await session.execute(
            text(
                "SELECT similarity_score, status FROM report_matches WHERE report_lost_id = :lost_id AND report_found_id = :found_id"
            ),
            {"lost_id": scenario["lost_match_id"], "found_id": scenario["found_id"]},
        )
        row = result.mappings().first()

    assert row["status"] == "confirmed"
    assert row["similarity_score"] == pytest.approx(0.42, abs=1e-6)
