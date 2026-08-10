"""Validación de docentes. Sustituye a `dto/teachers.dto.ts`."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from ...comun.validaciones import Correo
from ...modelos import EstadoRegistro


class CrearDocente(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    code: str = Field(min_length=2, max_length=40)
    firstName: str = Field(min_length=2, max_length=120)
    lastName: str = Field(min_length=2, max_length=120)
    document: str = Field(min_length=4, max_length=40)
    email: Correo
    phone: str | None = Field(default=None, max_length=30)
    userId: str | None = None
    status: EstadoRegistro | None = None
    subjectIds: list[str] | None = None


class ActualizarDocente(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    code: str | None = Field(default=None, min_length=2, max_length=40)
    firstName: str | None = Field(default=None, min_length=2, max_length=120)
    lastName: str | None = Field(default=None, min_length=2, max_length=120)
    document: str | None = Field(default=None, min_length=4, max_length=40)
    email: Correo | None = None
    phone: str | None = Field(default=None, max_length=30)
    userId: str | None = None
    status: EstadoRegistro | None = None


class AsignarAsignaturas(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subjectIds: list[str] = Field(default_factory=list, max_length=200)
