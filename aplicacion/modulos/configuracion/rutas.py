"""Rutas de configuración. Traducción de `modules/settings/settings.controller.ts`."""

from __future__ import annotations

from flask import Blueprint, request
from pydantic import BaseModel, ConfigDict, Field

from ...comun.peticion import contexto
from ...comun.respuestas import responder
from ...comun.seguridad import exigir_usuario, requiere_permisos
from . import servicio

bp = Blueprint("configuracion", __name__)


class ActualizarValor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: str = Field(max_length=2000)


class ActualizarQR(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    publicUrl: str | None = Field(default=None, max_length=500)
    institutionName: str | None = Field(default=None, max_length=160)


@bp.get("/settings/public")
def publicos():
    """Ajustes accesibles sin sesión: los usa la pantalla de acceso."""
    return responder(servicio.publicos())


@bp.get("/settings")
@requiere_permisos("settings.read")
def listar():
    return responder(servicio.listar())


@bp.get("/settings/qr")
@requiere_permisos("settings.read")
def obtener_qr():
    return responder(servicio.qr())


@bp.patch("/settings/qr")
@requiere_permisos("settings.update")
def actualizar_qr():
    datos = ActualizarQR.model_validate(request.get_json(silent=True) or {})
    return responder(
        servicio.actualizar_qr(
            datos.publicUrl, datos.institutionName, exigir_usuario(), contexto()
        )
    )


@bp.get("/settings/qr/history")
@requiere_permisos("settings.read")
def historial_qr():
    return responder(servicio.historial_qr())


@bp.get("/settings/<clave>")
@requiere_permisos("settings.read")
def obtener(clave: str):
    return responder(servicio.obtener(clave))


@bp.patch("/settings/<clave>")
@requiere_permisos("settings.update")
def actualizar(clave: str):
    datos = ActualizarValor.model_validate(request.get_json(silent=True) or {})
    return responder(servicio.actualizar(clave, datos.value, exigir_usuario(), contexto()))
