"""Conexión a PostgreSQL para el Backend IA.

Comparte la misma base de datos que el Backend Principal (Prisma). Este
servicio NO gestiona migraciones: el esquema (`reports`, `report_embeddings`,
etc.) es propiedad de Prisma (`backend/prisma/migrations`). Este módulo solo
abre la conexión async y expone una sesión de SQLAlchemy para leer/escribir
sobre esas tablas ya existentes.
"""

from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=settings.sql_echo,
    pool_pre_ping=True,
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependencia de FastAPI para inyectar una sesión de DB por request."""
    async with async_session_factory() as session:
        yield session


async def check_connection() -> bool:
    """Verifica la conexión y que la extensión pgvector esté activa."""
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT 1"))
        if result.scalar_one() != 1:
            return False

        ext_result = await conn.execute(
            text("SELECT extname FROM pg_extension WHERE extname = 'vector'")
        )
        return ext_result.first() is not None
