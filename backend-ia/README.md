# Backend IA — Conexión a base de datos

Setup de conexión a base de datos para la issue "Configurar la base de datos con sus respectivos modelos y esquemas". Este servicio comparte la base de datos con el Backend Principal; **no gestiona migraciones** (eso es responsabilidad de Prisma, ver `../backend/README.md`). Solo expone modelos SQLAlchemy de las tablas que necesita leer/escribir (`reports`, `report_embeddings`).

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

Devuelve `{"status": "ok"}` si la conexión funciona y la extensión `pgvector` está activa (criterio de aceptación de la issue).
