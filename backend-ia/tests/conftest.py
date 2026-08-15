"""Setup de la sesión de tests.

`app.ml.pipeline` carga YOLO y OpenCLIP a nivel de módulo (igual que el
notebook del POC), así que hay que parchear los constructores ANTES de que
cualquier test importe ese módulo — si no, los tests intentarían descargar
~600MB de pesos reales en cada corrida. pytest importa este archivo antes de
colectar los test modules del directorio, así que el parche a nivel de
módulo (no dentro de un fixture) llega a tiempo.

`app.ml.pipeline` accede a estos constructores como atributos de módulo
(`ultralytics.YOLO(...)`, `open_clip.create_model_and_transforms(...)`), no
vía `from x import y`, así que parchear el atributo acá alcanza sin importar
el orden de import.
"""

from unittest.mock import MagicMock

import open_clip
import pytest_asyncio
import ultralytics

fake_yolo_instance = MagicMock(name="yolo_model")
ultralytics.YOLO = MagicMock(name="YOLO", return_value=fake_yolo_instance)

fake_clip_model = MagicMock(name="clip_model")
fake_clip_preprocess = MagicMock(name="clip_preprocess")
open_clip.create_model_and_transforms = MagicMock(
    name="create_model_and_transforms",
    return_value=(fake_clip_model, None, fake_clip_preprocess),
)


@pytest_asyncio.fixture(autouse=True)
async def _dispose_db_engine_pool():
    """pytest-asyncio crea un event loop nuevo por test (scope function). El
    engine de app.db es un singleton a nivel de módulo con un pool de
    conexiones asyncpg atado al loop en el que se crearon — si un test
    reutiliza una conexión pooleada de un loop ya cerrado, asyncpg explota
    con "Event loop is closed". Se dispone el pool al final de cada test
    para que el próximo arranque con conexiones nuevas en su propio loop.
    """
    yield
    from app.db import engine

    await engine.dispose()
