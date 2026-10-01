"""Tests del endpoint POST /reports/{report_id}/embedding.

Usa TestClient de FastAPI y mockea embedding_service.process_report_image:
el foco acá es el wiring HTTP (201/422) y la autenticación interna, no la
lógica de ML ni la DB.
"""

from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.db import get_db
from app.main import app
from app.services import embedding_service, image_analysis_service
from app.services.image_analysis_service import ImageUnavailableError

VALID_KEY = "test-internal-key"
AUTH_HEADERS = {"X-Internal-Key": VALID_KEY}


async def _fake_get_db():
    yield None


@pytest.fixture(autouse=True)
def _internal_key_configurada(monkeypatch):
    """Fija la config de auth para todos los tests del módulo.

    Sin esto los tests dependerían de lo que haya en el `.env` de la máquina
    que los corre: con INTERNAL_API_KEY seteada esperarían 401 y sin ella
    esperarían 201, que es justo la ambigüedad que dejó pasar la issue #106.
    """
    monkeypatch.setattr(settings, "internal_api_key", VALID_KEY)
    monkeypatch.setattr(settings, "allow_insecure_internal", False)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = _fake_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def process_mock(monkeypatch):
    mock = AsyncMock(return_value=True)
    monkeypatch.setattr(embedding_service, "process_report_image", mock)
    return mock


def test_devuelve_201_si_se_detecto_y_guardo_el_embedding(process_mock, client):
    response = client.post(
        "/reports/1/embedding",
        json={"image_url": "https://example.com/foto.jpg"},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 201


def test_devuelve_422_si_no_se_detecto_una_mascota(process_mock, client):
    process_mock.return_value = False

    response = client.post(
        "/reports/2/embedding",
        json={"image_url": "https://example.com/foto.jpg"},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 422


def test_rechaza_con_401_si_no_viene_el_header(process_mock, client):
    response = client.post("/reports/3/embedding", json={"image_url": "https://example.com/foto.jpg"})

    assert response.status_code == 401
    # El rechazo tiene que ocurrir ANTES de disparar la inferencia: si no, un
    # atacante igual consigue quemar CPU aunque le devuelvan 401.
    process_mock.assert_not_awaited()


def test_rechaza_con_401_si_la_key_es_incorrecta(process_mock, client):
    response = client.post(
        "/reports/4/embedding",
        json={"image_url": "https://example.com/foto.jpg"},
        headers={"X-Internal-Key": "clave-equivocada"},
    )

    assert response.status_code == 401
    process_mock.assert_not_awaited()


def test_sin_internal_api_key_configurada_rechaza_todo(monkeypatch, process_mock, client):
    """Regresión de la issue #106: la guarda existía pero retornaba sin validar
    cuando INTERNAL_API_KEY estaba vacía, que es la configuración con la que
    corría todo el equipo. Sin opt-in explícito, ahora falla cerrado.
    """
    monkeypatch.setattr(settings, "internal_api_key", "")

    response = client.post("/reports/5/embedding", json={"image_url": "https://example.com/foto.jpg"})

    assert response.status_code == 401
    process_mock.assert_not_awaited()


def test_allow_insecure_internal_habilita_el_endpoint_sin_key(monkeypatch, process_mock, client):
    """La escotilla de desarrollo local sigue disponible, pero hay que pedirla
    a mano: es lo que separa "no configuré nada" de "quiero esto abierto".
    """
    monkeypatch.setattr(settings, "internal_api_key", "")
    monkeypatch.setattr(settings, "allow_insecure_internal", True)

    response = client.post(
        "/reports/6/embedding",
        json={"image_url": "https://example.com/foto.jpg"},
    )

    assert response.status_code == 201


def test_health_no_requiere_autenticacion(client):
    """El healthcheck queda público a propósito: lo consumen los orquestadores
    y no dispara ningún trabajo ni toca la base.
    """
    assert client.get("/health").status_code == 200


# --- POST /images/analyze ---------------------------------------------------


@pytest.fixture
def analyze_mock(monkeypatch):
    mock = AsyncMock(return_value=True)
    monkeypatch.setattr(image_analysis_service, "image_has_animal", mock)
    return mock


def test_analyze_returns_has_animal_true_for_an_animal_image(analyze_mock, client):
    response = client.post(
        "/images/analyze",
        json={"image_url": "https://example.com/dog.jpg"},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 200
    assert response.json() == {"has_animal": True}
    analyze_mock.assert_awaited_once_with("https://example.com/dog.jpg")


def test_analyze_returns_has_animal_false_for_a_non_animal_image(analyze_mock, client):
    analyze_mock.return_value = False

    response = client.post(
        "/images/analyze",
        json={"image_url": "https://example.com/landscape.jpg"},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 200
    assert response.json() == {"has_animal": False}


def test_analyze_returns_422_when_the_image_cannot_be_processed(analyze_mock, client):
    analyze_mock.side_effect = ImageUnavailableError("download failed")

    response = client.post(
        "/images/analyze",
        json={"image_url": "https://example.com/broken.jpg"},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 422


def test_analyze_rejects_with_401_without_the_internal_key(analyze_mock, client):
    response = client.post("/images/analyze", json={"image_url": "https://example.com/dog.jpg"})

    assert response.status_code == 401
    analyze_mock.assert_not_awaited()
