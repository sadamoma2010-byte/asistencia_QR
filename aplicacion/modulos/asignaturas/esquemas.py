"""Validación de asignaturas. Sustituye a `dto/subjects.dto.ts`."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from ...comun.validaciones import Color
from ...modelos import EstadoRegistro


class CrearAsignatura(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=300)
    weeklyHours: int | None = Field(default=None, ge=1, le=60)
    color: Color | None = None
    status: EstadoRegistro | None = None


class ActualizarAsignatura(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    code: str | None = Field(default=None, min_length=2, max_length=40)
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=300)
    weeklyHours: int | None = Field(default=None, ge=1, le=60)
    color: Color | None = None
    status: EstadoRegistro | None = None


class AsignarDocentes(BaseModel):
    model_config = ConfigDict(extra="forbid")

    teacherIds: list[str] = Field(default_factory=list, max_length=200)
