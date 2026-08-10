"""
Piezas compartidas por todos los modelos.

Sustituye a las convenciones que Prisma aplicaba por esquema: identificadores
UUID, marcas de tiempo automáticas y borrado lógico.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, Enum as EnumSQL, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .enumeraciones import EstadoRegistro


def columna_uuid(*args: Any, **extra: Any):
    """
    Identificador UUID.

    Se pide `as_uuid=False` para que el valor viaje como cadena, tal y como lo
    devolvía Prisma. Así la interfaz y la API no notan el cambio de motor.

    Los argumentos posicionales se pasan tal cual, para poder declarar la
    clave foránea: `columna_uuid(ForeignKey("users.id"), unique=True)`.
    """
    return mapped_column(UUID(as_uuid=False), *args, **extra)


def nuevo_id() -> str:
    """Genera el identificador desde la aplicación, como hacía `@default(uuid())`."""
    return str(uuid.uuid4())


def enum_sql(tipo: type, nombre: str, **extra: Any):
    """
    Enumeración nativa de PostgreSQL.

    `create_type=False` es esencial: los tipos ya existen porque los creó
    `database.sql`. Sin esa opción, SQLAlchemy intentaría crearlos de nuevo.
    """
    return mapped_column(
        EnumSQL(
            tipo,
            name=nombre,
            native_enum=True,
            create_type=False,
            values_callable=lambda e: [m.value for m in e],
        ),
        **extra,
    )


def _ahora_utc() -> datetime:
    return datetime.now(timezone.utc)


class MarcasTiempo:
    """
    Columnas `created_at` y `updated_at`.

    `onupdate` reproduce el comportamiento de `@updatedAt` de Prisma: la marca
    se refresca sola en cada modificación.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), default=_ahora_utc
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_ahora_utc, onupdate=_ahora_utc
    )


class BorradoLogico:
    """
    Columna `deleted_at`.

    Nula significa vigente. Ninguna consulta del sistema debe olvidar este
    filtro: por eso existe el ayudante `vigentes()` en `comun/consultas.py`.
    """

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def esta_eliminado(self) -> bool:
        return self.deleted_at is not None


class ConEstado:
    """Columna `status`, del tipo `record_status`."""

    status: Mapped[EstadoRegistro] = enum_sql(
        EstadoRegistro, "record_status", default=EstadoRegistro.ACTIVO, nullable=False
    )

    @property
    def esta_activo(self) -> bool:
        return self.status == EstadoRegistro.ACTIVO
