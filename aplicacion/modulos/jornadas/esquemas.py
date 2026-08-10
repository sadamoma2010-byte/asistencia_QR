"""Validación de jornadas. Sustituye a `dto/shifts.dto.ts`."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from ...modelos import EstadoRegistro


class CrearJornada(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=300)
    status: EstadoRegistro | None = None


class ActualizarJornada(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=300)
    status: EstadoRegistro | None = None
