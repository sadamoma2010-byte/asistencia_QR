"""Rutas de permisos. Traducción de `modules/permissions/permissions.controller.ts`."""

from __future__ import annotations

from flask import Blueprint

from ...comun.excel import Columna
from ...comun.respuestas import responder
from ...comun.rutas_crud import Exportacion, registrar_crud
from ...comun.seguridad import requiere_permisos
from ...comun.tiempo import formato_fecha_hora
from .esquemas import ActualizarPermiso, CrearPermiso
from .servicio import ServicioPermisos, _contar_roles

bp = Blueprint("permisos", __name__)


# Ambas deben ir antes que `/permissions/<identificador>`
@bp.get("/permissions/grouped")
@requiere_permisos("permissions.read", "roles.read")
def agrupados():
    """Permisos organizados por módulo, para el árbol de casillas de roles."""
    return responder(ServicioPermisos.agrupados())


@bp.get("/permissions/modules")
@requiere_permisos("permissions.read")
def modulos():
    """Módulos distintos presentes en el catálogo."""
    return responder(ServicioPermisos.modulos())


registrar_crud(
    bp,
    ruta="permissions",
    servicio=ServicioPermisos,
    permiso="permissions",
    esquema_crear=CrearPermiso,
    esquema_actualizar=ActualizarPermiso,
    exportacion=Exportacion(
        nombre_hoja="Permisos",
        titulo="Catálogo de permisos",
        archivo="permisos",
        columnas=[
            Columna("Código", 26, valor=lambda f: f.code),
            Columna("Permiso", 30, valor=lambda f: f.name),
            Columna("Módulo", 20, valor=lambda f: f.module),
            Columna("Descripción", 42, valor=lambda f: f.description or "—"),
            Columna("Roles", 10, valor=lambda f: _contar_roles(f.id)),
            Columna("Del sistema", 14, valor=lambda f: "Sí" if f.is_system else "No"),
            Columna(
                "Estado", 14, valor=lambda f: "Activo" if f.status.value == "ACTIVE" else "Inactivo"
            ),
            Columna("Creado", 20, valor=lambda f: formato_fecha_hora(f.created_at)),
        ],
    ),
)
