"""
Códigos que el sistema asigna solo.

Docentes y asignaturas llevan un código correlativo —DOC-0001, ASG-001— que
el formulario rellena por su cuenta. Calcularlo tiene una trampa: al eliminar
un registro su código se renombra a `DOC-0007.DEL.1786553016812` para dejar
libre el original, así que el mayor código no se puede leer entero como
número. Aquí se extrae solo la parte que cuenta.

Los códigos liberados sí entran en el cálculo: se busca el siguiente número
nunca usado, no el primer hueco. Reutilizar el número de un registro
eliminado haría que dos fichas distintas compartieran código en el histórico
de la auditoría.
"""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import InstrumentedAttribute

from ..extensiones import bd


def _numero(codigo: str, prefijo: str) -> int | None:
    """Los dígitos que siguen al prefijo, ignorando lo que venga detrás."""
    resto = codigo[len(prefijo) :]
    coincidencia = re.match(r"\d+", resto)
    return int(coincidencia.group()) if coincidencia else None


def siguiente(columna: InstrumentedAttribute, prefijo: str, digitos: int) -> str:
    """
    Siguiente código libre con el formato `<prefijo><número>`.

    Recorre los que ya existen —vigentes y eliminados— y devuelve el que sigue
    al mayor. Si no hay ninguno, empieza por el uno.
    """
    codigos = bd.session.execute(
        select(columna).where(columna.startswith(prefijo))
    ).scalars()

    numeros = [n for n in (_numero(c, prefijo) for c in codigos) if n is not None]
    siguiente_numero = max(numeros) + 1 if numeros else 1

    return f"{prefijo}{siguiente_numero:0{digitos}d}"
