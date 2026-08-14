"""Tests de app.services.embedding_service contra la DB real de test (mismo
patrón que test_db_connection.py). Mockea detect_and_crop/generate_embedding
para no depender de los modelos reales; el foco acá es la persistencia
(insert/upsert) en report_embeddings.
"""

import io
import uuid

import pytest
import pytest_asyncio
from PIL import Image
from sqlalchemy import text

from app.db import async_session_factory
from app.services import embedding_service


def _fake_image_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), color="red").save(buf, format="PNG")
    return buf.getvalue()


class FakeResponse:
    def __init__(self, content: bytes):
        self.content = content

    def raise_for_status(self) -> None:
        return None


class FakeAsyncClient:
    """Reemplaza httpx.AsyncClient para no depender de red en los tests."""

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    async def get(self, url: str):
        return FakeResponse(_fake_image_bytes())


@pytest.fixture(autouse=True)
def fake_http_download(monkeypatch):
    monkeypatch.setattr(embedding_service.httpx, "AsyncClient", FakeAsyncClient)


@pytest_asyncio.fixture
async def report_id():
    email = f"embedding-service-test-{uuid.uuid4()}@example.com"
    async with async_session_factory() as session:
        user_result = await session.execute(
            text(
                """
                INSERT INTO users (email, password_hash, updated_at)
                VALUES (:email, 'test-hash', now())
                RETURNING id
                """
            ),
            {"email": email},
        )
        user_id = user_result.scalar_one()

        report_result = await session.execute(
            text(
                """
                INSERT INTO reports (user_id, report_type, status, title, updated_at)
                VALUES (:user_id, 'found'::report_type, 'published'::report_status, 'Test report', now())
                RETURNING id
                """
            ),
            {"user_id": user_id},
        )
        rid = report_result.scalar_one()
        await session.commit()

    yield rid

    async with async_session_factory() as session:
        await session.execute(text("DELETE FROM report_embeddings WHERE report_id = :id"), {"id": rid})
        await session.execute(text("DELETE FROM reports WHERE id = :id"), {"id": rid})
        await session.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
        await session.commit()


@pytest.mark.asyncio
async def test_process_report_image_devuelve_false_si_no_se_detecta_mascota(monkeypatch, report_id):
    monkeypatch.setattr(embedding_service, "detect_and_crop", lambda image: None)

    async with async_session_factory() as session:
        saved = await embedding_service.process_report_image(report_id, "https://example.com/foto.jpg", session)

    assert saved is False

    async with async_session_factory() as session:
        result = await session.execute(
            text("SELECT COUNT(*) FROM report_embeddings WHERE report_id = :id"), {"id": report_id}
        )
        assert result.scalar_one() == 0


@pytest.mark.asyncio
async def test_process_report_image_inserta_el_embedding(monkeypatch, report_id):
    fake_embedding = [0.001 * i for i in range(512)]
    monkeypatch.setattr(embedding_service, "detect_and_crop", lambda image: image)
    monkeypatch.setattr(embedding_service, "generate_embedding", lambda crop: fake_embedding)

    async with async_session_factory() as session:
        saved = await embedding_service.process_report_image(report_id, "https://example.com/foto.jpg", session)

    assert saved is True

    async with async_session_factory() as session:
        result = await session.execute(
            text("SELECT embedding FROM report_embeddings WHERE report_id = :id"), {"id": report_id}
        )
        row = result.fetchone()
        assert row is not None


@pytest.mark.asyncio
async def test_process_report_image_llamado_dos_veces_actualiza_en_vez_de_fallar(monkeypatch, report_id):
    first_embedding = [0.001 * i for i in range(512)]
    second_embedding = [0.002 * i for i in range(512)]

    monkeypatch.setattr(embedding_service, "detect_and_crop", lambda image: image)

    monkeypatch.setattr(embedding_service, "generate_embedding", lambda crop: first_embedding)
    async with async_session_factory() as session:
        first_saved = await embedding_service.process_report_image(
            report_id, "https://example.com/foto.jpg", session
        )

    monkeypatch.setattr(embedding_service, "generate_embedding", lambda crop: second_embedding)
    async with async_session_factory() as session:
        second_saved = await embedding_service.process_report_image(
            report_id, "https://example.com/foto.jpg", session
        )

    assert first_saved is True
    assert second_saved is True

    async with async_session_factory() as session:
        result = await session.execute(
            text("SELECT COUNT(*) FROM report_embeddings WHERE report_id = :id"), {"id": report_id}
        )
        assert result.scalar_one() == 1
