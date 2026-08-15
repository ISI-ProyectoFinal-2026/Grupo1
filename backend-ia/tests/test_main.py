"""Tests del endpoint POST /reports/{report_id}/embedding.

Usa TestClient de FastAPI y mockea embedding_service.process_report_image:
el foco acá es el wiring HTTP (201/422), no la lógica de ML ni la DB.
"""

from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.db import get_db
from app.main import app
from app.services import embedding_service


async def _fake_get_db():
    yield None


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = _fake_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_db, None)


def test_devuelve_201_si_se_detecto_y_guardo_el_embedding(monkeypatch, client):
    monkeypatch.setattr(embedding_service, "process_report_image", AsyncMock(return_value=True))

    response = client.post("/reports/1/embedding", json={"image_url": "https://example.com/foto.jpg"})

    assert response.status_code == 201


def test_devuelve_422_si_no_se_detecto_una_mascota(monkeypatch, client):
    monkeypatch.setattr(embedding_service, "process_report_image", AsyncMock(return_value=False))

    response = client.post("/reports/2/embedding", json={"image_url": "https://example.com/foto.jpg"})

    assert response.status_code == 422
