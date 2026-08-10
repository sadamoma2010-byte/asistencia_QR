"""Validación de roles. Sustituye a `dto/roles.dto.ts`."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from ...modelos import EstadoRegistro


class CrearRol(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=60)
    description: str | None = Field(default=None, max_length=300)
    status: EstadoRegistro | None = None
    permissionIds: list[str] | None = None


class ActualizarRol(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=2, max_length=60)
    description: str | None = Field(default=None, max_length=300)
    status: EstadoRegistro | None = None


class AsignarPermisos(BaseModel):
    model_config = ConfigDict(extra="forbid")

    permissionIds: list[str] = Field(default_factory=list, max_length=500)
