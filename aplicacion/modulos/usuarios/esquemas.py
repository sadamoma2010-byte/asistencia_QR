"""Validación de usuarios. Sustituye a `dto/users.dto.ts`."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ...comun.validaciones import Correo
from ...modelos import EstadoRegistro


def _clave_robusta(valor: str) -> str:
    """Misma exigencia que el sistema anterior."""
    if not any(c.isupper() for c in valor):
        raise ValueError("debe incluir al menos una letra mayúscula")
    if not any(c.islower() for c in valor):
        raise ValueError("debe incluir al menos una letra minúscula")
    if not any(c.isdigit() for c in valor):
        raise ValueError("debe incluir al menos un número")
    return valor


class CrearUsuario(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    firstName: str = Field(min_length=2, max_length=120)
    lastName: str = Field(min_length=2, max_length=120)
    document: str = Field(min_length=4, max_length=40)
    email: Correo
    phone: str | None = Field(default=None, max_length=30)
    password: str = Field(min_length=8, max_length=128)
    roleId: str
    status: EstadoRegistro | None = None
    mustChangePassword: bool | None = None

    _validar_clave = field_validator("password")(_clave_robusta)


class ActualizarUsuario(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    firstName: str | None = Field(default=None, min_length=2, max_length=120)
    lastName: str | None = Field(default=None, min_length=2, max_length=120)
    document: str | None = Field(default=None, min_length=4, max_length=40)
    email: Correo | None = None
    phone: str | None = Field(default=None, max_length=30)
    roleId: str | None = None
    status: EstadoRegistro | None = None
    mustChangePassword: bool | None = None


class ReiniciarClave(BaseModel):
    model_config = ConfigDict(extra="forbid")

    newPassword: str = Field(min_length=8, max_length=128)

    _validar_clave = field_validator("newPassword")(_clave_robusta)
