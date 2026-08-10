"""Rutas de auditoría. Traducción de `modules/audit/audit.controller.ts`."""

from __future__ import annotations

from flask import Blueprint

from ...comun import excel as hoja
from ...comun.excel import Columna
from ...comun.respuestas import responder
from ...comun.seguridad import requiere_permisos
from ...comun.tiempo import formato_fecha_hora
from ...modelos import ETIQUETA_ACCION_AUDITORIA
from . import servicio

bp = Blueprint("auditoria", __name__)


@bp.get("/audit")
@requiere_permisos("audit.read")
def listar():
    return responder(servicio.listar())


@bp.get("/audit/modules")
@requiere_permisos("audit.read")
def modulos():
    """Módulos distintos presentes en la bitácora."""
    return responder(servicio.modulos())


@bp.get("/audit/export")
@requiere_permisos("audit.export")
def exportar():
    filas = servicio.para_exportar()
    contenido = hoja.construir(
        hoja="Auditoría",
        titulo="Bitácora de auditoría",
        subtitulo=hoja.subtitulo_estandar(len(filas)),
        columnas=[
            Columna("Fecha y hora", 20, valor=lambda f: formato_fecha_hora(f.created_at)),
            Columna("Usuario", 28, valor=lambda f: f.user_name or "—"),
            Columna("Correo", 30, valor=lambda f: f.user_email or "—"),
            Columna(
                "Acción",
                18,
                valor=lambda f: ETIQUETA_ACCION_AUDITORIA.get(f.action.value, f.action.value),
            ),
            Columna("Módulo", 20, valor=lambda f: f.module),
            Columna("Descripción", 60, valor=lambda f: f.description),
            Columna("IP", 18, valor=lambda f: f.ip_address or "—"),
            Columna("Dispositivo", 32, valor=lambda f: f.device or "—"),
        ],
        filas=filas,
    )
    return hoja.descargar(contenido, "auditoria")


@bp.get("/audit/<identificador>")
@requiere_permisos("audit.read")
def detalle(identificador: str):
    return responder(servicio.obtener(identificador))
