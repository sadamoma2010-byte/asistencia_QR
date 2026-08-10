"""
Rutas de asignaturas.

Traducción de `modules/subjects/subjects.controller.ts`.
"""

from __future__ import annotations

from flask import Blueprint, request

from ...comun.excel import Columna
from ...comun.peticion import contexto
from ...comun.respuestas import responder
from ...comun.rutas_crud import Exportacion, registrar_crud
from ...comun.seguridad import exigir_usuario, requiere_permisos
from ...comun.tiempo import formato_fecha_hora
from .esquemas import ActualizarAsignatura, AsignarDocentes, CrearAsignatura
from .servicio import ServicioAsignaturas, _contar_docentes, _contar_horarios

bp = Blueprint("asignaturas", __name__)


# Debe declararse antes que `/subjects/<identificador>`, o el enrutador
# interpretaría «next-code» como un identificador.
@bp.get("/subjects/next-code")
@requiere_permisos("subjects.create")
def sugerir_codigo():
    """Siguiente código disponible con el formato ASG-000."""
    return responder(ServicioAsignaturas.sugerir_codigo())


@bp.patch("/subjects/<identificador>/teachers")
@requiere_permisos("subjects.update")
def asignar_docentes(identificador: str):
    """Reemplaza el listado de docentes que dictan la asignatura."""
    datos = AsignarDocentes.model_validate(request.get_json(silent=True) or {})
    return responder(
        ServicioAsignaturas.asignar_docentes(
            identificador, datos.teacherIds, exigir_usuario(), contexto()
        )
    )


registrar_crud(
    bp,
    ruta="subjects",
    servicio=ServicioAsignaturas,
    permiso="subjects",
    esquema_crear=CrearAsignatura,
    esquema_actualizar=ActualizarAsignatura,
    orden_defecto="name",
    opciones=ServicioAsignaturas.opciones,
    permisos_opciones=("subjects.read", "schedules.create", "teachers.update"),
    exportacion=Exportacion(
        nombre_hoja="Asignaturas",
        titulo="Listado de asignaturas",
        archivo="asignaturas",
        columnas=[
            Columna("Código", 16, valor=lambda f: f.code),
            Columna("Asignatura", 30, valor=lambda f: f.name),
            Columna("Descripción", 42, valor=lambda f: f.description or "—"),
            Columna("Horas/semana", 14, valor=lambda f: f.weekly_hours or "—"),
            Columna("Docentes", 12, valor=lambda f: _contar_docentes(f.id)),
            Columna("Horarios", 12, valor=lambda f: _contar_horarios(f.id)),
            Columna(
                "Estado", 14, valor=lambda f: "Activa" if f.status.value == "ACTIVE" else "Inactiva"
            ),
            Columna("Creada", 20, valor=lambda f: formato_fecha_hora(f.created_at)),
        ],
    ),
)
