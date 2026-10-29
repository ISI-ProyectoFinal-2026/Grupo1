# Backend IA

Servicio de generación de embeddings y búsqueda de similitud por imagen (issue #18, "Matcheo"). Comparte la base de datos con el Backend Principal; **no gestiona migraciones** (eso es responsabilidad de Prisma, ver `../backend/README.md`). Solo expone modelos SQLAlchemy de las tablas que necesita leer/escribir (`reports`, `report_embeddings`, `report_matches`).

## Variables de entorno

Copiar `.env.example` a `.env` (no versionado) y ajustar:

```bash
cp .env.example .env
```

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | sí | Misma base que el Backend Principal. Puerto `5433` en el host, ver `../docker/ENV_VARS.md` |
| `INTERNAL_API_KEY` | **sí** | Clave compartida con el Backend Principal. **Mismo valor que en `../backend/.env`** |
| `NODE_BACKEND_URL` | no | URL del Backend Principal, para avisarle cuando se persiste un match y dispare las notificaciones |
| `ALLOW_INSECURE_INTERNAL` | no | Escotilla solo para desarrollo local, ver abajo |
| `SQL_ECHO` | no | Loguea todo el SQL de SQLAlchemy |

### `INTERNAL_API_KEY` y por qué el servicio falla cerrado

`POST /reports/{report_id}/embedding` se llama servicio a servicio, sin usuario logueado, así que no hay JWT: se autentica con una clave compartida que viaja en el header `X-Internal-Key`. **Tiene que ser el mismo valor que `INTERNAL_API_KEY` en `../backend/.env`**; si no coincide, el Backend IA responde `401` y los reportes con imagen se quedan en `pending`.

Si la variable no está configurada, el endpoint **rechaza todo con `401`**. Es deliberado: este endpoint descarga imágenes, corre dos modelos de ML y escribe en `report_embeddings` / `report_matches`, así que una configuración ausente tiene que dejarlo cerrado. La versión anterior hacía lo contrario —retornaba sin validar cuando la clave estaba vacía— y eso dejó el endpoint público en todos los entornos (issue #106).

Para desarrollo local, si necesitás levantarlo sin configurar la clave, hay que pedirlo a mano:

```
ALLOW_INSECURE_INTERNAL=true
```

El servicio atiende sin autenticar y loguea un warning en cada arranque. **Nunca en un entorno desplegado.**

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

1. Descarga la imagen y corre **YOLOv8n** (`app/ml/pipeline.py`) para detectar y recortar el animal (cualquier clase animal de COCO: `bird`, `cat`, `dog`, `horse`, etc.).
2. Genera el embedding con **DINOv2 ViT-B/14** (`vit_base_patch14_dinov2.lvd142m` vía `timm`, entrada a 224px) y lo guarda en `report_embeddings` (`vector(768)`). La inferencia corre en un thread (`asyncio.to_thread`) para no bloquear el event loop.
3. Busca candidatos por similitud coseno (pgvector) entre reportes de tipo opuesto (lost↔found), dentro de 5km / 30 días / publicados, **los 5 más parecidos** (`LIMIT 5`), y guarda en `report_matches` los que superen `MATCH_THRESHOLD` (0.45). Los que además superen `NOTIFY_THRESHOLD` (0.63) disparan la notificación a los dueños (ver `NODE_BACKEND_URL`). Ambas constantes están documentadas en `matching_service.py` y calibradas con un benchmark propio (FPR 3% / 0.3%).

La similitud se calcula con `1 - (a <=> b)`: **`<=>` es distancia coseno**, y es el único operador que puede usar el índice HNSW (creado con `vector_cosine_ops`). No cambiarlo por `<->` (distancia L2): aun con embeddings normalizados `1 - L2` no es la similitud coseno y el umbral deja de tener sentido — dos fotos de la misma mascota con coseno 0.87 dan L2 0.51, o sea 0.49 de "similitud", y no matchearían nunca.

Modelo y umbrales dependen del checkpoint exacto: no cambiar el modelo de embeddings ni YOLO sin volver a validar contra un set etiquetado, porque cambian la dimensión del vector y la escala de los porcentajes.

**Límites conocidos:**

- Perros de la misma raza pueden puntuar por encima de otra foto del mismo perro (en la validación, ~0.52–0.62 contra ~0.39–0.47). Es un límite del modelo con estos umbrales, no un bug.
- Con `LIMIT 5` los matches visibles dependen del orden de carga: un reporte con más de 5 candidatos sobre el umbral solo guarda los 5 mejores; el resto aparece cuando se recalcula desde el otro lado (por ejemplo con el script de re-embedding).
- `NODE_BACKEND_URL` vacío desactiva las notificaciones de match sin avisar, y la respuesta HTTP del Backend Principal no se verifica (una `INTERNAL_API_KEY` distinta devuelve 401 y se ignora).

**No implementado todavía:** cola Redis (hoy es síncrono dentro de la request).

## Cambiar de modelo de embeddings (migración a DINOv2)

Los vectores de modelos distintos viven en espacios distintos: no se pueden convertir ni comparar. Por eso la migración `20261014000000_dinov2_embedding_dimension` cambia la columna a `vector(768)` y **vacía `report_embeddings`** (no guarda copia: los vectores viejos no sirven con el modelo nuevo y se regeneran desde las imágenes). Hasta regenerarlos, ningún reporte matchea.

Pasos al actualizar un entorno (en este orden):

```bash
# 1. dependencias (sale open_clip_torch, entra timm)
cd backend-ia && pip install -r requirements.txt

# 2. migrar la base (borra los embeddings)
cd ../backend && npx prisma migrate deploy

# 3. regenerar embeddings y matches con el modelo nuevo
cd ../backend-ia && python -m scripts.reembed_reports        # solo publicados
python -m scripts.reembed_reports --all                      # todos los que tienen imagen
```

- El primer arranque descarga los pesos de DINOv2 (necesita internet).
- Si actualizás el código sin migrar, los inserts fallan: la columna sigue en 512 dimensiones y el vector nuevo tiene 768.
- Borrá los matches `pending` viejos antes del paso 3 si querés descartar los calculados con el modelo anterior: el upsert no elimina los que ahora quedan bajo el umbral.
## Tests

```bash
python -m pytest
```

Corre contra la misma base de datos de desarrollo (real, sin mocks de DB); los modelos YOLO/DINOv2 se mockean en los tests para no depender de pesos descargados ni de inferencia real (ver `tests/conftest.py`).
