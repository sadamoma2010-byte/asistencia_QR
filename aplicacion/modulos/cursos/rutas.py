"""Rutas de cursos."""

from __future__ import annotations

from flask import Blueprint, request

from ...comun.excel import Columna
from ...comun.peticion import contexto
from ...comun.respuestas import responder
from ...comun.rutas_crud import Exportacion, registrar_crud
from ...comun.seguridad import exigir_usuario, requiere_permisos
from ...comun.tiempo import formato_fecha_hora
from ...modelos import ETIQUETA_NIVEL_EDUCATIVO
from .esquemas import ActualizarCurso, AsignarDocentes, CrearCurso
from .servicio import ServicioCursos, _contar_docentes, _contar_horarios

bp = Blueprint("cursos", __name__)


@bp.patch("/courses/<identificador>/teachers")
@requiere_permisos("courses.update")
def asignar_docentes(identificador: str):
    """Reemplaza el listado de docentes que atienden el curso."""
    datos = AsignarDocentes.model_validate(request.get_json(silent=True) or {})
    return responder(
        ServicioCursos.asignar_docentes(
            identificador, datos.teacherIds, exigir_usuario(), contexto()
        )
    )


registrar_crud(
    bp,
    ruta="courses",
    servicio=ServicioCursos,
    permiso="courses",
    esquema_crear=CrearCurso,
    esquema_actualizar=ActualizarCurso,
    orden_defecto="name",
    opciones=ServicioCursos.opciones,
    permisos_opciones=(
        "courses.read",
        "schedules.read",
        "schedules.create",
        "teachers.read",
        "teachers.update",
    ),
    exportacion=Exportacion(
        nombre_hoja="Cursos",
        titulo="Cursos por grado",
        archivo="cursos",
        columnas=[
            Columna("Curso", 14, valor=lambda f: f.name),
            Columna("Grado", 20, valor=lambda f: f.grado.name),
            Columna(
                "Nivel",
                24,
                valor=lambda f: ETIQUETA_NIVEL_EDUCATIVO.get(
                    f.grado.level.value, f.grado.level.value
                ),
            ),
            Columna("Jornada", 18, valor=lambda f: f.jornada.name if f.jornada else "—"),
            Columna(
                "Director de grupo",
                30,
                valor=lambda f: (
                    f"{f.director.first_name} {f.director.last_name}" if f.director else "—"
                ),
            ),
            Columna("Cupo", 10, valor=lambda f: f.capacity or "—"),
            Columna("Docentes", 12, valor=lambda f: _contar_docentes(f.id)),
            Columna("Horarios", 12, valor=lambda f: _contar_horarios(f.id)),
            Columna(
                "Estado", 14, valor=lambda f: "Activo" if f.status.value == "ACTIVE" else "Inactivo"
            ),
            Columna("Creado", 20, valor=lambda f: formato_fecha_hora(f.created_at)),
        ],
    ),
)
