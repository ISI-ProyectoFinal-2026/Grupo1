from fastapi import FastAPI, HTTPException

from app.db import check_connection

app = FastAPI(title="PATITAS - Backend IA")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
async def health_db() -> dict[str, str]:
    """Cumple el criterio de aceptación 'Conexión funcionando exitosamente'."""
    try:
        ok = await check_connection()
    except Exception as exc:  # noqa: BLE001 - se traduce a 503 para el caller
        raise HTTPException(status_code=503, detail=f"database unreachable: {exc}") from exc

    if not ok:
        raise HTTPException(status_code=503, detail="pgvector extension not found")

    return {"status": "ok"}
