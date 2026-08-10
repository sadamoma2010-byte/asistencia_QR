"""
Extensiones compartidas.

Se declaran aquí, sin aplicación asociada, y se enlazan en la fábrica.
Es el equivalente a los módulos globales de NestJS: evita importaciones
circulares entre los módulos del sistema.
"""

from __future__ import annotations

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base declarativa de SQLAlchemy 2.0, con tipado real."""


# Sustituye a PrismaService
bd = SQLAlchemy(model_class=Base)

# Sustituye a @nestjs/throttler
limitador = Limiter(
    key_func=get_remote_address,
    storage_uri="memory://",
    strategy="fixed-window",
)
