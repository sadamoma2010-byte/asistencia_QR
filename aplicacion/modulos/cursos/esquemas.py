"""Validación de cursos."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ...modelos import EstadoRegistro


def _letra(valor: str) -> str:
    """
    La denominación del grupo: normalmente una letra, a veces dos caracteres.

    Se guarda en mayúsculas para que «6a» y «6A» sean el mismo curso.
    """
    limpio = valor.strip().upper()
    if not limpio.isalnum():
        raise ValueError("solo puede contener letras o números, sin espacios ni signos")
    return limpio


class CrearCurso(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    gradeId: str
    letter: str = Field(min_length=1, max_length=10)
    shiftId: str | None = None
    homeroomTeacherId: str | None = None
    capacity: int | None = Field(default=None, ge=1, le=100)
    status: EstadoRegistro | None = None
    teacherIds: list[str] | None = None

    _normalizar = field_validator("letter")(_letra)


class ActualizarCurso(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    gradeId: str | None = None
    letter: str | None = Field(default=None, min_length=1, max_length=10)
    shiftId: str | None = None
    homeroomTeacherId: str | None = None
    capacity: int | None = Field(default=None, ge=1, le=100)
    status: EstadoRegistro | None = None

    _normalizar = field_validator("letter")(_letra)


class AsignarDocentes(BaseModel):
    model_config = ConfigDict(extra="forbid")

    teacherIds: list[str] = Field(default_factory=list, max_length=200)
