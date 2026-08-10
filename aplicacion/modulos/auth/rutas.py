"""
Rutas de autenticación.

Traducción de `modules/auth/auth.controller.ts`. Las direcciones son las
mismas, para que nada de lo que ya consume la API tenga que cambiar.

El blueprint no declara prefijo propio: lo aporta la fábrica al registrarlo
(`/api/v1`). Cada ruta lleva por tanto su camino completo a partir de ahí.
"""

from __future__ import annotations

from flask import Blueprint, current_app, request, session

from ...comun.peticion import contexto
from ...comun.respuestas import responder
from ...comun.seguridad import exigir_usuario, requiere_sesion
from ...extensiones import limitador
from . import servicio
from .esquemas import EntradaCambioClave, EntradaLogin, EntradaRefresco

bp = Blueprint("auth", __name__)


def _limite_login() -> str:
    """Intentos permitidos por ventana, según la configuración."""
    return (
        f"{current_app.config['LOGIN_LIMITE']} per "
        f"{current_app.config['LOGIN_VENTANA']} seconds"
    )


@bp.post("/auth/login")
@limitador.limit(_limite_login)
def login():
    """Abre sesión. Limitado en intentos, como en el sistema anterior."""
    datos = EntradaLogin.model_validate(request.get_json(silent=True) or {})
    resultado = servicio.entrar(datos.email, datos.password, contexto())

    # Las páginas HTML se apoyan en la sesión del navegador para no tener que
    # adjuntar el token en cada enlace.
    session["token_acceso"] = resultado["accessToken"]
    session["token_refresco"] = resultado["refreshToken"]
    session.permanent = True

    return responder(resultado)


@bp.post("/auth/refresh")
def refrescar():
    """Renueva la sesión rotando el token de refresco."""
    cuerpo = request.get_json(silent=True) or {}
    if not cuerpo.get("refreshToken") and session.get("token_refresco"):
        cuerpo["refreshToken"] = session["token_refresco"]

    datos = EntradaRefresco.model_validate(cuerpo)
    resultado = servicio.refrescar(datos.refreshToken, contexto())

    session["token_acceso"] = resultado["accessToken"]
    session["token_refresco"] = resultado["refreshToken"]

    return responder(resultado)


@bp.post("/auth/logout")
@requiere_sesion
def logout():
    """Cierra la sesión y revoca los tokens activos."""
    resultado = servicio.salir(exigir_usuario(), contexto())
    session.clear()
    return responder(resultado)


@bp.get("/auth/me")
@requiere_sesion
def perfil():
    """Perfil del usuario autenticado, con sus permisos."""
    return responder(servicio.perfil_por_id(exigir_usuario().id))


@bp.post("/auth/change-password")
@requiere_sesion
def cambiar_contrasena():
    """Cambia la contraseña e invalida las sesiones abiertas."""
    datos = EntradaCambioClave.model_validate(request.get_json(silent=True) or {})
    resultado = servicio.cambiar_contrasena(
        exigir_usuario(), datos.currentPassword, datos.newPassword, contexto()
    )
    session.clear()
    return responder(resultado)
