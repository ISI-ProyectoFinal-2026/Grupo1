"""Tests para verificar conexión de base de datos en Backend IA."""

import pytest
from sqlalchemy import text

from app.db import check_connection, engine, get_db


@pytest.mark.asyncio
async def test_connection_to_database():
    """Verifica que la conexión a PostgreSQL sea exitosa."""
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT 1"))
        assert result.scalar_one() == 1


@pytest.mark.asyncio
async def test_postgis_extension_active():
    """Verifica que PostGIS esté activo."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT extname FROM pg_extension WHERE extname = 'postgis'")
        )
        rows = result.fetchall()
        assert len(rows) > 0
        assert rows[0][0] == "postgis"


@pytest.mark.asyncio
async def test_pgvector_extension_active():
    """Verifica que pgvector esté activo."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT extname FROM pg_extension WHERE extname = 'vector'")
        )
        rows = result.fetchall()
        assert len(rows) > 0
        assert rows[0][0] == "vector"


@pytest.mark.asyncio
async def test_check_connection_function():
    """Verifica que la función check_connection valide extensiones correctamente."""
    is_ok = await check_connection()
    assert is_ok is True


@pytest.mark.asyncio
async def test_reports_table_exists():
    """Verifica que la tabla reports existe con columnas correctas."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'reports'
            """)
        )
        columns = {row[0]: row[1] for row in result.fetchall()}
        assert "id" in columns
        assert "user_id" in columns
        assert "report_type" in columns
        assert "status" in columns
        assert "location" in columns


@pytest.mark.asyncio
async def test_report_embeddings_table_exists():
    """Verifica que la tabla report_embeddings existe con pgvector."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                SELECT column_name, udt_name
                FROM information_schema.columns
                WHERE table_name = 'report_embeddings'
            """)
        )
        columns = {row[0]: row[1] for row in result.fetchall()}
        assert "embedding" in columns
        assert columns["embedding"] == "vector"


@pytest.mark.asyncio
async def test_users_table_exists():
    """Verifica que la tabla users existe."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_name = 'users'
            """)
        )
        count = result.scalar()
        assert count > 0


@pytest.mark.asyncio
async def test_get_db_dependency():
    """Verifica que el dependency inyector de sesión DB funciona."""
    async for session in get_db():
        assert session is not None
        break


@pytest.mark.asyncio
async def test_foreign_keys_constraint():
    """Verifica que las restricciones de foreign keys estén configuradas."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                SELECT COUNT(*)
                FROM information_schema.table_constraints
                WHERE constraint_type = 'FOREIGN KEY'
            """)
        )
        count = result.scalar()
        assert count > 0


@pytest.mark.asyncio
async def test_vector_index_hnsw():
    """Verifica que el índice HNSW esté creado en report_embeddings."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = 'report_embeddings'
                AND indexname LIKE '%embedding%'
            """)
        )
        indices = [row[0] for row in result.fetchall()]
        assert len(indices) > 0
