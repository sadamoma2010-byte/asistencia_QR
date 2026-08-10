"""Rutas de roles. Traducción de `modules/roles/roles.controller.ts`."""

from __future__ import annotations

from flask import Blueprint, request

from ...comun.excel import Columna
from ...comun.peticion import contexto
from ...comun.respuestas import responder
from ...comun.rutas_crud import Exportacion, registrar_crud
from ...comun.seguridad import exigir_usuario, requiere_permisos
from ...comun.tiempo import formato_fecha_hora
from .esquemas import ActualizarRol, AsignarPermisos, CrearRol
from .servicio import ServicioRoles, _contar_permisos, _contar_usuarios

bp = Blueprint("roles", __name__)


@bp.patch("/roles/<identificador>/permissions")
@requiere_permisos("roles.update")
def asignar_permisos(identificador: str):
    """Reemplaza el conjunto de permisos concedidos al rol."""
    datos = AsignarPermisos.model_validate(request.get_json(silent=True) or {})
    return responder(
        ServicioRoles.asignar_permisos(
            identificador, datos.permissionIds, exigir_usuario(), contexto()
        )
    )


registrar_crud(
    bp,
    ruta="roles",
    servicio=ServicioRoles,
    permiso="roles",
    esquema_crear=CrearRol,
    esquema_actualizar=ActualizarRol,
    opciones=ServicioRoles.opciones,
    permisos_opciones=("roles.read", "users.create", "users.update"),
    exportacion=Exportacion(
        nombre_hoja="Roles",
        titulo="Listado de roles",
        archivo="roles",
        columnas=[
            Columna("Rol", 24, valor=lambda f: f.name),
            Columna("Descripción", 48, valor=lambda f: f.description or "—"),
            Columna("Usuarios", 12, valor=lambda f: _contar_usuarios(f.id, solo_vigentes=False)),
            Columna("Permisos", 12, valor=lambda f: _contar_permisos(f.id)),
            Columna("Del sistema", 14, valor=lambda f: "Sí" if f.is_system else "No"),
            Columna(
                "Estado", 14, valor=lambda f: "Activo" if f.status.value == "ACTIVE" else "Inactivo"
            ),
            Columna("Creado", 20, valor=lambda f: formato_fecha_hora(f.created_at)),
        ],
    ),
)
