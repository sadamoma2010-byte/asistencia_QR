"""
Construcción de consultas: paginación, búsqueda y ordenación.

Sustituye a `common/utils/query.util.ts` y a `common/dto/pagination.dto.ts`.
Reproduce el mismo comportamiento, incluida la lista blanca de campos
ordenables: el cliente no puede ordenar por una columna arbitraria.
"""

from __future__ import annotations

from typing import Any, Sequence

from flask import request
from sqlalchemy import Select, asc, desc, func, or_
from sqlalchemy.orm import InstrumentedAttribute

from ..extensiones import bd

LIMITE_MAXIMO = 100
LIMITE_DEFECTO = 10


class Paginacion:
    """
    Parámetros de listado leídos de la cadena de consulta.

    Equivale a `BasePaginationDto`, con los mismos nombres de parámetro para
    que las direcciones que ya usa la interfaz sigan funcionando igual.
    """

    def __init__(self, defecto_orden: str = "created_at"):
        self.pagina = self._entero("page", 1, minimo=1)
        self.limite = self._entero("limit", LIMITE_DEFECTO, minimo=1, maximo=LIMITE_MAXIMO)
        self.busqueda = (request.args.get("search") or "").strip()[:120] or None
        # El DTO original traía `sortBy = 'createdAt'` por defecto, así que ese
        # es el orden real de los listados cuando el cliente no pide otro.
        self.ordenar_por = (request.args.get("sortBy") or "").strip()[:60] or "createdAt"
        self.orden = "asc" if (request.args.get("sortOrder") or "").lower() == "asc" else "desc"
        # Orden al que se cae si el campo pedido no está permitido
        self.defecto_orden = defecto_orden
        self.estado = request.args.get("status") or None

    @staticmethod
    def _entero(nombre: str, defecto: int, minimo: int = 1, maximo: int | None = None) -> int:
        try:
            valor = int(request.args.get(nombre, ""))
        except (TypeError, ValueError):
            return defecto
        valor = max(minimo, valor)
        return min(valor, maximo) if maximo else valor

    @property
    def desplazamiento(self) -> int:
        return (self.pagina - 1) * self.limite


def aplicar_orden(
    consulta: Select,
    paginacion: Paginacion,
    permitidos: dict[str, InstrumentedAttribute | Any],
) -> Select:
    """
    Ordena validando el campo contra una lista blanca.

    `permitidos` traduce el nombre público (el que usa la interfaz, en estilo
    JavaScript) a la columna real. Si el campo no está en la lista, se cae al
    orden por defecto en lugar de fallar.
    """
    campo = permitidos.get(paginacion.ordenar_por or "")
    if campo is None:
        campo = permitidos.get(paginacion.defecto_orden)
    if campo is None:
        return consulta
    return consulta.order_by(asc(campo) if paginacion.orden == "asc" else desc(campo))


def aplicar_busqueda(
    consulta: Select,
    termino: str | None,
    campos: Sequence[InstrumentedAttribute | Any],
) -> Select:
    """
    Filtro de texto insensible a mayúsculas sobre varios campos.

    Usa `ILIKE`, que es exactamente lo que Prisma generaba con
    `mode: 'insensitive'`. Funciona igual con vocales acentuadas.
    """
    if not termino or not campos:
        return consulta
    patron = f"%{termino}%"
    return consulta.where(or_(*[campo.ilike(patron) for campo in campos]))


def contar(consulta: Select) -> int:
    """Total de filas que devolvería la consulta, sin traerlas."""
    sin_orden = consulta.order_by(None).subquery()
    return bd.session.execute(func.count().select().select_from(sin_orden)).scalar_one()


def paginar(consulta: Select, paginacion: Paginacion) -> tuple[list[Any], int]:
    """Ejecuta la consulta paginada y devuelve (elementos, total)."""
    total = contar(consulta)
    elementos = (
        bd.session.execute(consulta.offset(paginacion.desplazamiento).limit(paginacion.limite))
        .scalars()
        .unique()
        .all()
    )
    return list(elementos), total
