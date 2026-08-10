"""Modelos SQLAlchemy — mirror de solo lectura/escritura puntual sobre tablas
propiedad del Backend Principal (Prisma). No se generan migraciones desde
aquí: `Base.metadata` no se usa con `create_all`, solo para mapear columnas
existentes al hacer queries/inserts vía ORM.
"""

import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Report(Base):
    """Subconjunto de columnas de `reports` que el Backend IA necesita leer."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_type: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    image_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class ReportEmbedding(Base):
    """Embeddings (OpenCLIP) generados por este servicio tras procesar la imagen."""

    __tablename__ = "report_embeddings"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id"), unique=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
