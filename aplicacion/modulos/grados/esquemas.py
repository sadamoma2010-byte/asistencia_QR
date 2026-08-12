"""Validación de grados."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from ...modelos import EstadoRegistro, NivelEducativo


class CrearGrado(BaseModel):
    """
    Alta de un grado.

    Los catorce de la Ley 115 vienen cargados; esto queda para los casos que
    la propia ley contempla aparte, como los ciclos de educación de adultos.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    code: str = Field(min_length=1, max_length=10)
    name: str = Field(min_length=2, max_length=60)
    level: NivelEducativo
    position: int = Field(ge=1, le=30)
    description: str | None = Field(default=None, max_length=300)
    status: EstadoRegistro | None = None


class ActualizarGrado(BaseModel):
    """
    Modificación de un grado.

    Solo se puede cambiar el nombre visible, la descripción y si la
    institución lo ofrece. El código, el nivel y el lugar en la escalera los
    fija la ley.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=2, max_length=60)
    description: str | None = Field(default=None, max_length=300)
    status: EstadoRegistro | None = None
