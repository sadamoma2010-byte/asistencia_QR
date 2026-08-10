"""Validación de permisos. Sustituye a `dto/permissions.dto.ts`."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from ...modelos import EstadoRegistro


class CrearPermiso(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    code: str = Field(min_length=3, max_length=80, pattern=r"^[a-z0-9\-]+\.[a-z0-9\-]+$")
    name: str = Field(min_length=2, max_length=120)
    module: str = Field(min_length=2, max_length=60)
    description: str | None = Field(default=None, max_length=300)
    status: EstadoRegistro | None = None


class ActualizarPermiso(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    code: str | None = Field(default=None, min_length=3, max_length=80, pattern=r"^[a-z0-9\-]+\.[a-z0-9\-]+$")
    name: str | None = Field(default=None, min_length=2, max_length=120)
    module: str | None = Field(default=None, min_length=2, max_length=60)
    description: str | None = Field(default=None, max_length=300)
    status: EstadoRegistro | None = None
