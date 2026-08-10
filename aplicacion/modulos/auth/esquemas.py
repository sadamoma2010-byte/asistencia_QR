"""
Validación de los datos de autenticación.

Sustituye a `modules/auth/dto/auth.dto.ts` y a `class-validator`.
`extra="forbid"` reproduce `forbidNonWhitelisted`: un campo no declarado
hace que la petición se rechace, no que se ignore en silencio.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ...comun.validaciones import Correo


class EntradaLogin(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: Correo = Field(description="Correo institucional")
    password: str = Field(min_length=1, max_length=128, description="Contraseña")


class EntradaRefresco(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refreshToken: str = Field(min_length=10)


class EntradaCambioClave(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currentPassword: str = Field(min_length=1, max_length=128)
    newPassword: str = Field(min_length=8, max_length=128)

    @field_validator("newPassword")
    @classmethod
    def _robustez(cls, valor: str) -> str:
        """Misma exigencia que el sistema anterior: mayúscula, minúscula y dígito."""
        if not any(c.isupper() for c in valor):
            raise ValueError("debe incluir al menos una letra mayúscula")
        if not any(c.islower() for c in valor):
            raise ValueError("debe incluir al menos una letra minúscula")
        if not any(c.isdigit() for c in valor):
            raise ValueError("debe incluir al menos un número")
        return valor
