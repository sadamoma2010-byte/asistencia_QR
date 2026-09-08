"""Validación de asistencia. Sustituye a `dto/attendance.dto.ts`."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from ...modelos import TipoMarcacion


class RegistrarMarcacion(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    type: TipoMarcacion
    teacherId: str | None = None
    notes: str | None = Field(default=None, max_length=400)

    # Geolocalización del docente
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    locationAccuracy: float | None = Field(default=None, ge=0)
    locationSource: str | None = Field(default=None, max_length=30)


class BorrarSeleccionadas(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    ids: list[str] = Field(min_length=1, max_length=500)
    reason: str | None = Field(default=None, max_length=300)


class BorrarPorDocente(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    teacherIds: list[str] = Field(min_length=1, max_length=200)
    dateFrom: str | None = None
    dateTo: str | None = None
    reason: str | None = Field(default=None, max_length=300)
