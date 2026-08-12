"""Rutas de horarios. Traducción de `modules/schedules/schedules.controller.ts`."""

from __future__ import annotations

from flask import Blueprint

from ...comun.excel import Columna
from ...comun.respuestas import responder
from ...comun.rutas_crud import Exportacion, registrar_crud
from ...comun.seguridad import requiere_permisos
from ...comun.tiempo import formato_fecha_hora
from .esquemas import ActualizarHorario, CrearHorario
from .servicio import ServicioHorarios, etiqueta_dia

bp = Blueprint("horarios", __name__)


@bp.get("/schedules/teacher/<docente_id>")
@requiere_permisos("schedules.read", "attendance.read")
def por_docente(docente_id: str):
    """Horarios activos de un docente."""
    return responder(ServicioHorarios.por_docente(docente_id))


registrar_crud(
    bp,
    ruta="schedules",
    servicio=ServicioHorarios,
    permiso="schedules",
    esquema_crear=CrearHorario,
    esquema_actualizar=ActualizarHorario,
    exportacion=Exportacion(
        nombre_hoja="Horarios",
        titulo="Listado de horarios",
        archivo="horarios",
        columnas=[
            Columna(
                "Docente",
                30,
                valor=lambda f: f"{f.docente.first_name} {f.docente.last_name}",
            ),
            Columna("Código", 14, valor=lambda f: f.docente.code),
            Columna("Jornada", 20, valor=lambda f: f.jornada.name),
            Columna("Asignatura", 26, valor=lambda f: f.asignatura.name if f.asignatura else "—"),
            Columna("Curso", 14, valor=lambda f: f.curso.name if f.curso else "—"),
            Columna("Día", 16, valor=lambda f: etiqueta_dia(f.day_of_week)),
            Columna("Entrada", 12, valor=lambda f: f.check_in_time),
            Columna("Salida", 12, valor=lambda f: f.check_out_time),
            Columna("Tolerancia", 12, valor=lambda f: f"{f.tolerance_minutes} min"),
            Columna(
                "Estado", 14, valor=lambda f: "Activo" if f.status.value == "ACTIVE" else "Inactivo"
            ),
            Columna("Creado", 20, valor=lambda f: formato_fecha_hora(f.created_at)),
        ],
    ),
)
