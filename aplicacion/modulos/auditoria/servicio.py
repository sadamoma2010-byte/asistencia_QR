"""
Servicio de auditoría.

Traducción de `modules/audit/audit.service.ts`. Solo consulta: la escritura
vive en `comun/auditoria.py`, porque la usan todos los módulos.
"""

from __future__ import annotations

from datetime import timedelta

from flask import request
from sqlalchemy import select

from ...comun.consultas import Paginacion, aplicar_busqueda, aplicar_orden, paginar
from ...comun.errores import NoEncontrado
from ...comun.respuestas import resultado_paginado
from ...comun.tiempo import iso, rango_dias
from ...comun.validaciones import exigir_identificador
from ...extensiones import bd
from ...modelos import AccionAuditoria, Auditoria

TOPE_EXPORTACION = 5000

ORDENABLES = {
    "createdAt": Auditoria.created_at,
    "action": Auditoria.action,
    "module": Auditoria.module,
    "userEmail": Auditoria.user_email,
}

BUSCABLES = (
    Auditoria.description,
    Auditoria.user_email,
    Auditoria.user_name,
    Auditoria.module,
    Auditoria.entity_id,
)


def serializar(fila: Auditoria) -> dict:
    return {
        "id": fila.id,
        "userId": fila.user_id,
        "userEmail": fila.user_email,
        "userName": fila.user_name,
        "action": fila.action.value,
        "module": fila.module,
        "entityId": fila.entity_id,
        "description": fila.description,
        "ipAddress": fila.ip_address,
        "userAgent": fila.user_agent,
        "device": fila.device,
        "metadata": fila.metadata_,
        "createdAt": iso(fila.created_at),
        "updatedAt": iso(fila.updated_at),
        "deletedAt": iso(fila.deleted_at),
    }


def _consulta(paginacion: Paginacion):
    consulta = select(Auditoria).where(Auditoria.deleted_at.is_(None))

    accion = request.args.get("action")
    if accion:
        try:
            consulta = consulta.where(Auditoria.action == AccionAuditoria(accion))
        except ValueError:
            pass

    modulo = request.args.get("module")
    if modulo:
        consulta = consulta.where(Auditoria.module.ilike(modulo))

    usuario_id = request.args.get("userId")
    if usuario_id:
        consulta = consulta.where(Auditoria.user_id == usuario_id)

    desde, hasta = rango_dias(request.args.get("dateFrom"), request.args.get("dateTo"))
    if desde:
        consulta = consulta.where(Auditoria.created_at >= desde)
    if hasta:
        # El filtro «hasta» incluye el día completo, no solo su medianoche
        consulta = consulta.where(Auditoria.created_at < hasta + timedelta(days=1))

    consulta = aplicar_busqueda(consulta, paginacion.busqueda, BUSCABLES)
    return aplicar_orden(consulta, paginacion, ORDENABLES)


def listar() -> dict:
    paginacion = Paginacion("createdAt")
    elementos, total = paginar(_consulta(paginacion), paginacion)
    return resultado_paginado(
        [serializar(e) for e in elementos], total, paginacion.pagina, paginacion.limite
    )


def obtener(identificador: str) -> dict:
    exigir_identificador(identificador)
    fila = bd.session.execute(
        select(Auditoria).where(
            Auditoria.id == identificador, Auditoria.deleted_at.is_(None)
        )
    ).scalar_one_or_none()
    if fila is None:
        raise NoEncontrado("El registro de auditoría no existe")
    return serializar(fila)


def para_exportar() -> list[Auditoria]:
    paginacion = Paginacion("createdAt")
    return list(bd.session.execute(_consulta(paginacion).limit(TOPE_EXPORTACION)).scalars())


def modulos() -> list[str]:
    """Módulos distintos presentes en la bitácora, para el filtro de la interfaz."""
    return list(
        bd.session.execute(
            select(Auditoria.module)
            .where(Auditoria.deleted_at.is_(None))
            .distinct()
            .order_by(Auditoria.module.asc())
        ).scalars()
    )
