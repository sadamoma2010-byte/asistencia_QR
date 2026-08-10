"""Validación de horarios. Sustituye a `dto/schedules.dto.ts`."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from ...comun.validaciones import Hora
from ...modelos import EstadoRegistro


class CrearHorario(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    teacherId: str
    shiftId: str
    subjectId: str | None = None
    # 0 = domingo … 6 = sábado. Nulo aplica a todos los días.
    dayOfWeek: int | None = Field(default=None, ge=0, le=6)
    checkInTime: Hora
    checkOutTime: Hora
    toleranceMinutes: int | None = Field(default=None, ge=0, le=120)
    status: EstadoRegistro | None = None


class ActualizarHorario(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    teacherId: str | None = None
    shiftId: str | None = None
    subjectId: str | None = None
    dayOfWeek: int | None = Field(default=None, ge=0, le=6)
    checkInTime: Hora | None = None
    checkOutTime: Hora | None = None
    toleranceMinutes: int | None = Field(default=None, ge=0, le=120)
    status: EstadoRegistro | None = None
