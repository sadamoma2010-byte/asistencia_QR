"""
Servicio de configuración.

Traducción de `modules/settings/settings.service.ts`. Guarda los parámetros
que pueden cambiarse sin tocar el código: la dirección del QR, el nombre
institucional, la tolerancia por defecto y la zona horaria.
"""

from __future__ import annotations

import json

from sqlalchemy import select

from ...comun import auditoria
from ...comun.errores import NoEncontrado, SolicitudInvalida
from ...comun.peticion import ContextoPeticion
from ...comun.seguridad import UsuarioAutenticado
from ...comun.tiempo import iso
from ...extensiones import bd
from ...modelos import AccionAuditoria, Ajuste, Auditoria, TipoAjuste

MODULO = "Configuración"

CLAVES = {
    "QR_URL": "qr.public_url",
    "QR_INSTITUCION": "qr.institution_name",
    "TOLERANCIA": "attendance.default_tolerance_minutes",
    "VENTANA": "attendance.window_minutes",
    "ZONA_HORARIA": "app.timezone",
    "NOMBRE_CORTO": "app.institution_short_name",
}


def _buscar(clave: str) -> Ajuste | None:
    return bd.session.execute(
        select(Ajuste).where(Ajuste.key == clave, Ajuste.deleted_at.is_(None))
    ).scalar_one_or_none()


def texto(clave: str, defecto: str = "") -> str:
    ajuste = _buscar(clave)
    return ajuste.value if ajuste and ajuste.value is not None else defecto


def numero(clave: str, defecto: int) -> int:
    try:
        return int(texto(clave, str(defecto)))
    except (TypeError, ValueError):
        return defecto


def serializar(ajuste: Ajuste) -> dict:
    return {
        "id": ajuste.id,
        "key": ajuste.key,
        "value": ajuste.value,
        "type": ajuste.type.value,
        "group": ajuste.group,
        "label": ajuste.label,
        "description": ajuste.description,
        "isPublic": ajuste.is_public,
        "isSystem": ajuste.is_system,
        "createdAt": iso(ajuste.created_at),
        "updatedAt": iso(ajuste.updated_at),
        "deletedAt": iso(ajuste.deleted_at),
    }


def listar() -> list[dict]:
    """Ajustes organizados por grupo, que es como los pinta la interfaz."""
    filas = bd.session.execute(
        select(Ajuste)
        .where(Ajuste.deleted_at.is_(None))
        .order_by(Ajuste.group.asc(), Ajuste.label.asc())
    ).scalars()

    grupos: dict[str, list[dict]] = {}
    for fila in filas:
        grupos.setdefault(fila.group, []).append(serializar(fila))

    return [{"group": grupo, "settings": ajustes} for grupo, ajustes in grupos.items()]


def publicos() -> dict:
    """Ajustes accesibles sin autenticación: los usa la pantalla de acceso."""
    filas = bd.session.execute(
        select(Ajuste).where(Ajuste.deleted_at.is_(None), Ajuste.is_public.is_(True))
    ).scalars()
    return {f.key: f.value for f in filas}


def obtener(clave: str) -> dict:
    ajuste = _buscar(clave)
    if ajuste is None:
        raise NoEncontrado("El parámetro de configuración no existe")
    return serializar(ajuste)


def _validar(ajuste: Ajuste, valor: str) -> str:
    """Comprueba que el valor case con el tipo declarado."""
    if ajuste.type == TipoAjuste.NUMERO:
        try:
            int(valor)
        except (TypeError, ValueError):
            raise SolicitudInvalida(f"«{ajuste.label}» debe ser un número") from None
    elif ajuste.type == TipoAjuste.BOOLEANO:
        if valor.lower() not in ("true", "false"):
            raise SolicitudInvalida(f"«{ajuste.label}» debe ser verdadero o falso")
    elif ajuste.type == TipoAjuste.JSON:
        try:
            json.loads(valor)
        except (TypeError, ValueError):
            raise SolicitudInvalida(f"«{ajuste.label}» debe ser un JSON válido") from None
    return valor


def actualizar(
    clave: str, valor: str, actor: UsuarioAutenticado, ctx: ContextoPeticion
) -> dict:
    ajuste = _buscar(clave)
    if ajuste is None:
        raise NoEncontrado("El parámetro de configuración no existe")

    anterior = ajuste.value
    ajuste.value = _validar(ajuste, valor)

    auditoria.anotar(
        AccionAuditoria.ACTUALIZAR,
        MODULO,
        f"Actualizó «{ajuste.label}»",
        entidad_id=ajuste.id,
        detalle={"key": clave, "anterior": anterior, "nuevo": ajuste.value},
        usuario=actor,
        ctx=ctx,
    )
    bd.session.commit()
    return serializar(ajuste)


# ── Código QR institucional ──────────────────────────────────────────


def qr() -> dict:
    """Datos del QR: dirección pública y nombre de la institución."""
    url = _buscar(CLAVES["QR_URL"])
    institucion = _buscar(CLAVES["QR_INSTITUCION"])

    if url is None or institucion is None:
        raise NoEncontrado("La configuración del QR no está completa")

    # La fecha que se muestra es la del último de los dos que se haya tocado
    ultima = max(url.updated_at, institucion.updated_at)

    return {
        "publicUrl": url.value,
        "institutionName": institucion.value,
        "updatedAt": iso(ultima),
    }


def actualizar_qr(
    url: str | None,
    institucion: str | None,
    actor: UsuarioAutenticado,
    ctx: ContextoPeticion,
) -> dict:
    cambios: list[str] = []

    if url is not None:
        if "/marcar" not in url:
            raise SolicitudInvalida(
                "La dirección debe apuntar a la ruta /marcar del dominio público del sistema"
            )
        ajuste = _buscar(CLAVES["QR_URL"])
        if ajuste is not None:
            ajuste.value = url
            cambios.append("la dirección del QR")

    if institucion is not None:
        ajuste = _buscar(CLAVES["QR_INSTITUCION"])
        if ajuste is not None:
            ajuste.value = institucion
            cambios.append("el nombre institucional del QR")

    if cambios:
        auditoria.anotar(
            AccionAuditoria.ACTUALIZAR,
            MODULO,
            f"Actualizó {' y '.join(cambios)}",
            detalle={"url": url, "institutionName": institucion},
            usuario=actor,
            ctx=ctx,
        )
        bd.session.commit()

    return qr()


def historial_qr() -> list[dict]:
    """Cambios registrados sobre el QR, tomados de la auditoría."""
    filas = bd.session.execute(
        select(Auditoria)
        .where(
            Auditoria.module == MODULO,
            Auditoria.deleted_at.is_(None),
            Auditoria.description.ilike("%QR%"),
        )
        .order_by(Auditoria.created_at.desc())
        .limit(20)
    ).scalars()

    return [
        {
            "id": f.id,
            "description": f.description,
            "userName": f.user_name,
            "userEmail": f.user_email,
            "ipAddress": f.ip_address,
            "device": f.device,
            "createdAt": iso(f.created_at),
        }
        for f in filas
    ]
