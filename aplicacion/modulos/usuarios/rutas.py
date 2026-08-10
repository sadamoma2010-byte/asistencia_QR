"""Rutas de usuarios. Traducción de `modules/users/users.controller.ts`."""

from __future__ import annotations

from flask import Blueprint, request

from ...comun.excel import Columna
from ...comun.peticion import contexto
from ...comun.respuestas import responder
from ...comun.rutas_crud import Exportacion, registrar_crud
from ...comun.seguridad import exigir_usuario, requiere_permisos
from ...comun.tiempo import formato_fecha_hora
from .esquemas import ActualizarUsuario, CrearUsuario, ReiniciarClave
from .servicio import ServicioUsuarios

bp = Blueprint("usuarios", __name__)


@bp.patch("/users/<identificador>/reset-password")
@requiere_permisos("users.reset-password")
def reiniciar_clave(identificador: str):
    """Asigna una contraseña nueva y obliga al usuario a cambiarla."""
    datos = ReiniciarClave.model_validate(request.get_json(silent=True) or {})
    return responder(
        ServicioUsuarios.reiniciar_clave(
            identificador, datos.newPassword, exigir_usuario(), contexto()
        )
    )


registrar_crud(
    bp,
    ruta="users",
    servicio=ServicioUsuarios,
    permiso="users",
    esquema_crear=CrearUsuario,
    esquema_actualizar=ActualizarUsuario,
    exportacion=Exportacion(
        nombre_hoja="Usuarios",
        titulo="Listado de usuarios",
        archivo="usuarios",
        columnas=[
            Columna("Nombre", 28, valor=lambda f: f.nombre_completo),
            Columna("Documento", 18, valor=lambda f: f.document),
            Columna("Correo", 32, valor=lambda f: f.email),
            Columna("Teléfono", 16, valor=lambda f: f.phone or "—"),
            Columna("Rol", 20, valor=lambda f: f.rol.name),
            Columna(
                "Estado", 14, valor=lambda f: "Activo" if f.status.value == "ACTIVE" else "Inactivo"
            ),
            Columna(
                "Último acceso",
                20,
                valor=lambda f: formato_fecha_hora(f.last_login_at) if f.last_login_at else "—",
            ),
            Columna("Creado", 20, valor=lambda f: formato_fecha_hora(f.created_at)),
        ],
    ),
)
