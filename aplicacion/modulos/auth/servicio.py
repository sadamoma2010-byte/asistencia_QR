"""
Servicio de autenticación.

Traducción de `modules/auth/auth.service.ts`. Conserva el mismo
comportamiento: respuesta uniforme ante credenciales incorrectas, bloqueo por
intentos fallidos, tokens de acceso y refresco, y rotación del token de
refresco al usarlo.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

from flask import current_app
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ...comun import auditoria
from ...comun.errores import NoAutorizado, Prohibido, SolicitudInvalida
from ...comun.peticion import ContextoPeticion
from ...comun.seguridad import (
    UsuarioAutenticado,
    cifrar_contrasena,
    coincide_huella,
    emitir_acceso,
    emitir_refresco,
    huella_token,
    leer_token,
    verificar_contrasena,
)
from ...comun.tiempo import iso
from ...extensiones import bd
from ...modelos import (
    AccionAuditoria,
    Docente,
    EstadoRegistro,
    Permiso,
    RolPermiso,
    SesionRefresco,
    Usuario,
    nuevo_id,
)

MODULO = "Autenticación"
ERROR_GENERICO = "Credenciales incorrectas"


# ─────────────────────────────── Login ──────────────────────────────


def entrar(email: str, clave: str, ctx: ContextoPeticion) -> dict:
    """Valida las credenciales y abre sesión."""
    usuario = bd.session.execute(
        select(Usuario)
        .where(Usuario.email == email, Usuario.deleted_at.is_(None))
        .options(selectinload(Usuario.rol))
    ).scalar_one_or_none()

    # Respuesta uniforme: no se revela si el correo existe.
    if usuario is None:
        raise NoAutorizado(ERROR_GENERICO)

    ahora = datetime.now(timezone.utc)
    if usuario.locked_until and usuario.locked_until > ahora:
        minutos = math.ceil((usuario.locked_until - ahora).total_seconds() / 60)
        raise Prohibido(
            f"Cuenta bloqueada temporalmente por intentos fallidos. Intente en {minutos} minuto(s)."
        )

    if not verificar_contrasena(clave, usuario.password):
        _anotar_intento_fallido(usuario)
        raise NoAutorizado(ERROR_GENERICO)

    # RN001 / RN002 — solo un usuario activo puede operar
    if usuario.status != EstadoRegistro.ACTIVO:
        raise Prohibido("El usuario se encuentra inactivo. Contacte al administrador.")
    if usuario.rol.status != EstadoRegistro.ACTIVO or usuario.rol.deleted_at is not None:
        raise Prohibido("El rol asignado se encuentra inactivo.")

    usuario.failed_login_attempts = 0
    usuario.locked_until = None
    usuario.last_login_at = ahora

    permisos = _permisos_de(usuario.role_id)
    tokens = _emitir(usuario, ctx)

    auditoria.anotar(
        AccionAuditoria.ENTRAR,
        MODULO,
        f"Inicio de sesión de {usuario.nombre_completo}",
        entidad_id=usuario.id,
        usuario=UsuarioAutenticado(
            id=usuario.id,
            email=usuario.email,
            nombre_completo=usuario.nombre_completo,
            rol_id=usuario.role_id,
            rol_nombre=usuario.rol.name,
        ),
        ctx=ctx,
    )

    bd.session.commit()
    return {**tokens, "user": perfil(usuario, permisos)}


def _anotar_intento_fallido(usuario: Usuario) -> None:
    """Suma un intento y bloquea la cuenta al llegar al máximo."""
    maximo = current_app.config["LOGIN_INTENTOS_MAXIMOS"]
    minutos = current_app.config["LOGIN_BLOQUEO_MINUTOS"]

    intentos = (usuario.failed_login_attempts or 0) + 1
    usuario.failed_login_attempts = intentos
    usuario.locked_until = (
        datetime.now(timezone.utc) + timedelta(minutes=minutos) if intentos >= maximo else None
    )
    bd.session.commit()


# ─────────────────────────────── Tokens ─────────────────────────────


def _emitir(usuario: Usuario, ctx: ContextoPeticion) -> dict:
    """Emite el par de tokens y guarda el de refresco hasheado."""
    acceso = emitir_acceso(usuario)
    refresco = emitir_refresco(usuario)

    caducidad = datetime.now(timezone.utc) + timedelta(
        seconds=current_app.config["JWT_REFRESCO_SEGUNDOS"]
    )

    # El token de refresco se persiste con su huella; nunca en claro.
    bd.session.add(
        SesionRefresco(
            id=nuevo_id(),
            user_id=usuario.id,
            token_hash=huella_token(refresco),
            expires_at=caducidad,
            ip_address=ctx.ip,
            user_agent=ctx.agente,
            created_at=datetime.now(timezone.utc),
        )
    )

    return {
        "accessToken": acceso,
        "refreshToken": refresco,
        "expiresIn": current_app.config["JWT_ACCESO_TEXTO"],
    }


def refrescar(token: str, ctx: ContextoPeticion) -> dict:
    """Renueva la sesión y revoca el token usado."""
    carga = leer_token(token, current_app.config["JWT_REFRESCO_SECRETO"], "refresh")

    guardados = list(
        bd.session.execute(
            select(SesionRefresco)
            .where(
                SesionRefresco.user_id == carga["sub"],
                SesionRefresco.revoked_at.is_(None),
                SesionRefresco.expires_at > datetime.now(timezone.utc),
            )
            .order_by(SesionRefresco.created_at.desc())
            .limit(10)
        ).scalars()
    )

    coincide = next((s for s in guardados if coincide_huella(token, s.token_hash)), None)
    if coincide is None:
        raise NoAutorizado("Sesión no válida. Inicie sesión nuevamente.")

    usuario = bd.session.execute(
        select(Usuario)
        .where(
            Usuario.id == carga["sub"],
            Usuario.deleted_at.is_(None),
            Usuario.status == EstadoRegistro.ACTIVO,
        )
        .options(selectinload(Usuario.rol))
    ).scalar_one_or_none()
    if usuario is None:
        raise NoAutorizado("El usuario ya no está habilitado")

    # Rotación: el token usado se revoca de inmediato.
    coincide.revoked_at = datetime.now(timezone.utc)

    permisos = _permisos_de(usuario.role_id)
    tokens = _emitir(usuario, ctx)

    bd.session.commit()
    return {**tokens, "user": perfil(usuario, permisos)}


def salir(usuario: UsuarioAutenticado, ctx: ContextoPeticion) -> dict:
    """Cierra la sesión revocando todos los tokens activos."""
    ahora = datetime.now(timezone.utc)
    for sesion in bd.session.execute(
        select(SesionRefresco).where(
            SesionRefresco.user_id == usuario.id, SesionRefresco.revoked_at.is_(None)
        )
    ).scalars():
        sesion.revoked_at = ahora

    auditoria.anotar(
        AccionAuditoria.SALIR,
        MODULO,
        f"Cierre de sesión de {usuario.nombre_completo}",
        entidad_id=usuario.id,
        usuario=usuario,
        ctx=ctx,
    )

    bd.session.commit()
    return {"message": "Sesión cerrada correctamente"}


# ─────────────────────────────── Perfil ─────────────────────────────


def _permisos_de(rol_id: str) -> list[str]:
    """Códigos de permiso vigentes de un rol."""
    return list(
        bd.session.execute(
            select(Permiso.code)
            .join(RolPermiso, RolPermiso.permission_id == Permiso.id)
            .where(
                RolPermiso.role_id == rol_id,
                Permiso.status == EstadoRegistro.ACTIVO,
                Permiso.deleted_at.is_(None),
            )
        ).scalars()
    )


def perfil(usuario: Usuario, permisos: list[str]) -> dict:
    """Perfil público del usuario. Misma forma que devolvía `toProfile`."""
    docente = bd.session.execute(
        select(Docente).where(Docente.user_id == usuario.id, Docente.deleted_at.is_(None))
    ).scalar_one_or_none()

    return {
        "id": usuario.id,
        "firstName": usuario.first_name,
        "lastName": usuario.last_name,
        "fullName": usuario.nombre_completo,
        "email": usuario.email,
        "document": usuario.document,
        "phone": usuario.phone,
        "status": usuario.status.value,
        "mustChangePassword": usuario.must_change_password,
        "lastLoginAt": iso(usuario.last_login_at),
        "role": {
            "id": usuario.rol.id,
            "name": usuario.rol.name,
            "description": usuario.rol.description,
        },
        "permissions": permisos,
        "teacher": (
            {"id": docente.id, "code": docente.code, "status": docente.status.value}
            if docente
            else None
        ),
    }


def perfil_por_id(usuario_id: str) -> dict:
    """Perfil del usuario autenticado."""
    usuario = bd.session.execute(
        select(Usuario)
        .where(Usuario.id == usuario_id, Usuario.deleted_at.is_(None))
        .options(selectinload(Usuario.rol))
    ).scalar_one_or_none()
    if usuario is None:
        raise NoAutorizado("La sesión ya no es válida")
    return perfil(usuario, _permisos_de(usuario.role_id))


def cambiar_contrasena(
    usuario_actual: UsuarioAutenticado, actual: str, nueva: str, ctx: ContextoPeticion
) -> dict:
    """Cambia la contraseña e invalida todas las sesiones abiertas."""
    usuario = bd.session.execute(
        select(Usuario).where(Usuario.id == usuario_actual.id, Usuario.deleted_at.is_(None))
    ).scalar_one_or_none()
    if usuario is None:
        raise NoAutorizado("La sesión ya no es válida")

    if not verificar_contrasena(actual, usuario.password):
        raise SolicitudInvalida("La contraseña actual no es correcta")

    if verificar_contrasena(nueva, usuario.password):
        raise SolicitudInvalida("La nueva contraseña debe ser diferente a la actual")

    usuario.password = cifrar_contrasena(nueva)
    usuario.must_change_password = False

    # Se invalidan todas las sesiones activas por seguridad.
    ahora = datetime.now(timezone.utc)
    for sesion in bd.session.execute(
        select(SesionRefresco).where(
            SesionRefresco.user_id == usuario.id, SesionRefresco.revoked_at.is_(None)
        )
    ).scalars():
        sesion.revoked_at = ahora

    auditoria.anotar(
        AccionAuditoria.ACTUALIZAR,
        MODULO,
        f"{usuario_actual.nombre_completo} actualizó su contraseña",
        entidad_id=usuario.id,
        usuario=usuario_actual,
        ctx=ctx,
    )

    bd.session.commit()
    return {"message": "Contraseña actualizada correctamente. Inicie sesión nuevamente."}
