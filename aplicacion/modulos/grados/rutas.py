"""Rutas de grados."""

from __future__ import annotations

from flask import Blueprint

from ...comun.excel import Columna
from ...comun.respuestas import responder
from ...comun.rutas_crud import Exportacion, registrar_crud
from ...comun.seguridad import requiere_permisos
from ...comun.tiempo import formato_fecha_hora
from ...modelos import ETIQUETA_NIVEL_EDUCATIVO
from .esquemas import ActualizarGrado, CrearGrado
from .servicio import ServicioGrados, _contar_cursos

bp = Blueprint("grados", __name__)


# Debe declararse antes que `/grades/<identificador>`
@bp.get("/grades/by-level")
@requiere_permisos("grades.read")
def por_nivel():
    """Los grados agrupados por nivel, como los presenta la ley."""
    return responder(ServicioGrados.por_nivel())


registrar_crud(
    bp,
    ruta="grades",
    servicio=ServicioGrados,
    permiso="grades",
    esquema_crear=CrearGrado,
    esquema_actualizar=ActualizarGrado,
    orden_defecto="position",
    opciones=ServicioGrados.opciones,
    permisos_opciones=("grades.read", "courses.create", "courses.update", "teachers.read"),
    exportacion=Exportacion(
        nombre_hoja="Grados",
        titulo="Grados del sistema educativo (Ley 115 de 1994)",
        archivo="grados",
        columnas=[
            Columna("Orden", 10, valor=lambda f: f.position),
            Columna("Código", 12, valor=lambda f: f.code),
            Columna("Grado", 22, valor=lambda f: f.name),
            Columna(
                "Nivel",
                24,
                valor=lambda f: ETIQUETA_NIVEL_EDUCATIVO.get(f.level.value, f.level.value),
            ),
            Columna("Cursos", 12, valor=lambda f: _contar_cursos(f.id)),
            Columna("Descripción", 46, valor=lambda f: f.description or "—"),
            Columna(
                "Estado", 14, valor=lambda f: "Activo" if f.status.value == "ACTIVE" else "Inactivo"
            ),
            Columna("Creado", 20, valor=lambda f: formato_fecha_hora(f.created_at)),
        ],
    ),
)
