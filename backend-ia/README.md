# Backend IA

Servicio de generación de embeddings y búsqueda de similitud por imagen (issue #18, "Matcheo"). Comparte la base de datos con el Backend Principal; **no gestiona migraciones** (eso es responsabilidad de Prisma, ver `../backend/README.md`). Solo expone modelos SQLAlchemy de las tablas que necesita leer/escribir (`reports`, `report_embeddings`, `report_matches`).

## Variables de entorno

Crear un archivo `.env` en esta carpeta (no versionado) con:

```
DATABASE_URL=postgresql+asyncpg://patitas:patitas@localhost:5433/patitas
```

## Setup

```bash
cd backend-ia
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Levantar el servicio

Requiere que la base de datos esté arriba y con las migraciones de `backend/` aplicadas primero.

```bash
uvicorn app.main:app --reload  # http://localhost:8000
```

## Verificar la conexión

```bash
curl http://localhost:8000/health/db
```

Devuelve `{"status": "ok"}` si la conexión funciona y la extensión `pgvector` está activa.

## Generación de embeddings y matching (issue #18)

El Backend Principal llama a este endpoint de forma fire-and-forget al crear un reporte con imagen (ver `../backend/README.md`, variable `AI_SERVICE_URL`):

```bash
POST /reports/{report_id}/embedding
{ "image_url": "https://..." }

→ 201  se detectó una mascota, se guardó el embedding y se calcularon matches
→ 422  no se detectó una mascota en la imagen (sin más efecto)
```

Internamente (`app/services/embedding_service.py` + `app/services/matching_service.py`), en la misma request:

1. Descarga la imagen y corre **YOLOv8n** (`app/ml/pipeline.py`) para detectar y recortar la mascota (clases `cat`/`dog`).
2. Genera el embedding con **OpenCLIP ViT-B-32** (pretrained `laion2b_s34b_b79k` — **no** `openai`, da otra dimensión) y lo guarda en `report_embeddings` (`vector(512)`).
3. Busca candidatos por similitud coseno (pgvector) entre reportes de tipo opuesto (lost↔found), dentro de 5km / 30 días / publicados, y guarda los que superen `SIMILARITY_THRESHOLD` (0.75, constante documentada en `matching_service.py` — valor provisional, ver `docs/pocs/poc_similitudes.md`) en `report_matches`.

La similitud se calcula con `1 - (a <=> b)`: **`<=>` es distancia coseno**, y es el único operador que puede usar el índice HNSW (creado con `vector_cosine_ops`). No cambiarlo por `<->` (distancia L2): aun con embeddings normalizados `1 - L2` no es la similitud coseno y el umbral deja de tener sentido — dos fotos de la misma mascota con coseno 0.87 dan L2 0.51, o sea 0.49 de "similitud", y no matchearían nunca.

Modelo y umbral están validados contra `docs/pocs/POC_Similitudes.ipynb` — no cambiar el checkpoint de OpenCLIP ni el modelo YOLO sin volver a correr esa validación, ya que la dimensión del embedding y los porcentajes de similitud dependen del checkpoint exacto.

**No implementado todavía:** cola Redis (hoy es síncrono dentro de la request), notificación al usuario cuando hay un match, y confirmar/rechazar un match desde el frontend (`GET /api/reports/:id/matches` en el Backend Principal es de solo lectura).

## Tests

```bash
python -m pytest
```

Corre contra la misma base de datos de desarrollo (real, sin mocks de DB); los modelos YOLO/OpenCLIP se mockean en los tests para no depender de pesos descargados ni de inferencia real (ver `tests/conftest.py`).
