"""Config del Backend IA: servicio de inferencia sin base de datos (ADR-0029)."""

import pytest

from app.config import Settings


@pytest.mark.parametrize(
    "field",
    [
        "database_url",
        "sql_echo",
        "node_backend_url",
        "match_threshold",
        "notify_threshold",
        "match_radius_meters",
        "match_window_days",
        "match_top_k",
    ],
)
def test_no_tiene_configuracion_de_base_ni_de_matching(field):
    assert field not in Settings.model_fields
