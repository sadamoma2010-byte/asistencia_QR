"""
Tipos de validación reutilizables.

Sustituye a los decoradores de `class-validator`. Cada tipo lleva su
comprobación, de modo que los esquemas de los módulos solo declaran campos.
"""

from __future__ import annotations

import re
from typing import Annotated

from pydantic import AfterValidator, Field

# Patrón práctico de correo, equivalente al de `@IsEmail()` de class-validator.
#
# No se usa `EmailStr`: su validador rechaza los dominios reservados como
# `.local`, y el correo del administrador del sistema es `admin@datly.local`.
# Aplicar esa restricción aquí dejaría fuera cuentas que ya existen.
PATRON_CORREO = re.compile(
    r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?"
    r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?)+$"
)

PATRON_HORA = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
PATRON_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
PATRON_FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _correo(valor: str) -> str:
    limpio = valor.strip().lower()
    if len(limpio) > 180 or not PATRON_CORREO.match(limpio):
        raise ValueError("debe ser un correo electrónico válido")
    return limpio


def _hora(valor: str) -> str:
    if not PATRON_HORA.match(valor.strip()):
        raise ValueError("debe tener el formato HH:MM en 24 horas")
    return valor.strip()


def _color(valor: str) -> str:
    if not PATRON_COLOR.match(valor.strip()):
        raise ValueError("debe ser un color hexadecimal, por ejemplo #4F46E5")
    return valor.strip()


def _fecha(valor: str) -> str:
    if not PATRON_FECHA.match(valor.strip()):
        raise ValueError("debe tener el formato AAAA-MM-DD")
    return valor.strip()


Correo = Annotated[str, AfterValidator(_correo)]
Hora = Annotated[str, AfterValidator(_hora)]
Color = Annotated[str, AfterValidator(_color)]
FechaTexto = Annotated[str, AfterValidator(_fecha)]

# Identificador UUID en texto, tal como los devuelve la API
Identificador = Annotated[str, Field(min_length=36, max_length=36)]

PATRON_UUID = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def exigir_identificador(valor: str) -> str:
    """
    Comprueba que el identificador de la dirección sea un UUID.

    Sustituye a `ParseUUIDPipe`. Sin esta comprobación, un identificador con
    otro formato llega hasta PostgreSQL, que rechaza la conversión y provoca un
    error 500: la petición es inválida, no un fallo del servidor, y además ese
    500 devolvía el mensaje del motor.
    """
    from .errores import SolicitudInvalida

    if not PATRON_UUID.match(valor or ""):
        raise SolicitudInvalida("El identificador indicado no es válido")
    return valor
