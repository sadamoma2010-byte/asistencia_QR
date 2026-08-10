"""
Registro de auditoría (RN009).

Sustituye a `AuditService.log`. Toda acción del sistema deja constancia de
quién la hizo, desde dónde y con qué detalle.

Un fallo al auditar nunca interrumpe la operación de negocio: se anota en el
registro del servidor y la petición continúa, igual que en el sistema anterior.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from ..extensiones import bd
from ..modelos import AccionAuditoria, Auditoria, nuevo_id
from .peticion import ContextoPeticion, contexto
from .seguridad import UsuarioAutenticado

registro = logging.getLogger("asistencia")


def anotar(
    accion: AccionAuditoria,
    modulo: str,
    descripcion: str,
    *,
    entidad_id: str | None = None,
    detalle: dict[str, Any] | None = None,
    usuario: UsuarioAutenticado | None = None,
    ctx: ContextoPeticion | None = None,
    confirmar: bool = False,
) -> None:
    """
    Escribe una entrada en la bitácora.

    `detalle` viaja a la columna JSONB. Si no hay detalle se deja la columna
    vacía: escribir el valor JSON `null` haría indistinguible un evento sin
    detalle de uno que sí lo tiene.
    """
    try:
        pista = ctx or contexto()

        bd.session.add(
            Auditoria(
                id=nuevo_id(),
                action=accion,
                module=modulo,
                description=descripcion[:500],
                entity_id=entidad_id,
                user_id=usuario.id if usuario else None,
                user_email=usuario.email if usuario else None,
                user_name=usuario.nombre_completo if usuario else None,
                ip_address=pista.ip,
                user_agent=pista.agente,
                device=pista.dispositivo,
                metadata_=detalle or None,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
        )
        if confirmar:
            bd.session.commit()

    except Exception as error:  # noqa: BLE001 - auditar nunca debe romper la operación
        registro.error("No fue posible registrar la auditoría (%s/%s)", modulo, accion, exc_info=error)
        try:
            bd.session.rollback()
        except Exception:  # noqa: BLE001
            pass
