"""
Servicio de jornadas.

Traducción de `modules/shifts/shifts.service.ts`.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select

from ...comun.crud import ServicioCRUD
from ...extensiones import bd
from ...modelos import EstadoRegistro, Horario, Jornada, nuevo_id


def _contar_horarios(jornada_id: str, solo_activos: bool = False) -> int:
    """
    Horarios vigentes de una jornada.

    El filtro por borrado lógico es imprescindible: sin él, una jornada cuyos
    horarios se hayan eliminado seguiría figurando como ocupada.
    """
    consulta = select(func.count()).select_from(Horario).where(
        Horario.shift_id == jornada_id, Horario.deleted_at.is_(None)
    )
    if solo_activos:
        consulta = consulta.where(Horario.status == EstadoRegistro.ACTIVO)
    return bd.session.execute(consulta).scalar_one()


class ServicioJornadas(ServicioCRUD):
    modelo = Jornada
    modulo = "Jornadas"
    articulo = "la"
    sustantivo = "jornada"
    campo_etiqueta = "name"
    orden_defecto = "createdAt"

    ordenables = {
        "createdAt": Jornada.created_at,
        "name": Jornada.name,
        "status": Jornada.status,
    }
    buscables = (Jornada.name, Jornada.description)

    # ── Serialización ────────────────────────────────────────────────

    @classmethod
    def serializar(cls, fila: Jornada) -> dict:
        return {
            **cls.campos_comunes(fila),
            "name": fila.name,
            "description": fila.description,
            "_count": {"schedules": _contar_horarios(fila.id)},
        }

    @classmethod
    def opciones(cls) -> list[dict]:
        """Catálogo de jornadas activas para los desplegables."""
        filas = bd.session.execute(
            select(Jornada)
            .where(Jornada.deleted_at.is_(None), Jornada.status == EstadoRegistro.ACTIVO)
            .order_by(Jornada.name.asc())
        ).scalars()
        return [{"id": f.id, "name": f.name, "description": f.description} for f in filas]

    # ── Mutaciones ───────────────────────────────────────────────────

    @classmethod
    def construir(cls, datos: dict) -> Jornada:
        return Jornada(
            id=nuevo_id(),
            name=datos["name"],
            description=datos.get("description") or None,
            status=datos.get("status") or EstadoRegistro.ACTIVO,
        )

    @classmethod
    def aplicar_cambios(cls, fila: Jornada, datos: dict) -> None:
        if "name" in datos and datos["name"] is not None:
            fila.name = datos["name"]
        if "description" in datos:
            fila.description = datos["description"] or None
        if "status" in datos and datos["status"] is not None:
            fila.status = datos["status"]

    # ── Reglas propias ───────────────────────────────────────────────

    @classmethod
    def gancho_antes_de_crear(cls, datos: dict) -> None:
        cls.exige_unico(Jornada.name, datos["name"], "Ya existe una jornada con ese nombre")

    @classmethod
    def gancho_antes_de_actualizar(cls, fila: Jornada, datos: dict) -> None:
        nombre = datos.get("name")
        if nombre and nombre.lower() != fila.name.lower():
            cls.exige_unico(
                Jornada.name, nombre, "Ya existe una jornada con ese nombre", excluir=fila.id
            )

    @classmethod
    def gancho_impide_inactivar(cls, fila: Jornada) -> str | None:
        activos = _contar_horarios(fila.id, solo_activos=True)
        if activos:
            return f"No es posible inactivar la jornada: tiene {activos} horario(s) activo(s)"
        return None

    @classmethod
    def gancho_impide_eliminar(cls, fila: Jornada) -> str | None:
        asociados = _contar_horarios(fila.id)
        if asociados:
            return f"No es posible eliminar la jornada: tiene {asociados} horario(s) asociado(s)"
        return None
