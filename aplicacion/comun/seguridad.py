"""
Autenticación y control de acceso.

Sustituye a `@nestjs/jwt`, `@nestjs/passport`, `JwtAuthGuard`,
`PermissionsGuard`, `RolesGuard` y a los decoradores de `common/decorators`.

Las contraseñas siguen usando bcrypt con el mismo formato de hash, así que las
que ya están registradas siguen siendo válidas: nadie tiene que cambiarla.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Callable

import bcrypt
import jwt
from flask import current_app, has_request_context, request, session
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..extensiones import bd
from ..modelos import Docente, EstadoRegistro, Permiso, RolPermiso, Usuario
from ..modelos.acceso import ROL_CONTROL_TOTAL
from .errores import NoAutorizado, Prohibido


# ─────────────────────────── Contraseñas ────────────────────────────


def cifrar_contrasena(clave: str) -> str:
    """Hash bcrypt con el número de rondas configurado."""
    rondas = current_app.config.get("BCRYPT_RONDAS", 12)
    return bcrypt.hashpw(clave.encode("utf-8"), bcrypt.gensalt(rondas)).decode("utf-8")


def verificar_contrasena(clave: str, hash_guardado: str) -> bool:
    """
    Comprueba una contraseña contra su hash.

    Acepta los hashes que generó Node (`$2b$`, `$2a$`): el algoritmo es el
    mismo y el formato también, así que no hay que migrar ninguna clave.
    """
    if not clave or not hash_guardado:
        return False
    try:
        return bcrypt.checkpw(clave.encode("utf-8"), hash_guardado.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def huella_token(token: str) -> str:
    """
    Huella de un token de refresco, para guardarlo sin dejarlo en claro.

    Se usa SHA-256 y no bcrypt a propósito. bcrypt trunca su entrada a 72
    bytes, y un JWT ocupa unos 276 cuyos primeros 72 son idénticos para todos
    los tokens de un mismo usuario: cabecera más el comienzo del identificador.
    Con bcrypt, un token revocado seguiría validando contra la sesión
    siguiente del mismo usuario y la rotación no serviría de nada.

    bcrypt tiene sentido en las contraseñas, que son cortas y de baja
    entropía. Un JWT firmado ya es impredecible, así que basta con un resumen
    que no trunque.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def coincide_huella(token: str, huella_guardada: str) -> bool:
    """Compara en tiempo constante, para no filtrar información por el tiempo de respuesta."""
    if not token or not huella_guardada:
        return False
    return hmac.compare_digest(huella_token(token), huella_guardada)


# ───────────────────────────── Tokens ───────────────────────────────


def _firmar(datos: dict, secreto: str, segundos: int) -> str:
    ahora = datetime.now(timezone.utc)
    carga = {
        **datos,
        "iat": int(ahora.timestamp()),
        "exp": int((ahora + timedelta(seconds=segundos)).timestamp()),
        # Identificador único del token. Sin él, dos tokens emitidos para el
        # mismo usuario dentro del mismo segundo salen idénticos —mismo
        # contenido, mismas marcas de tiempo— y la rotación no podría
        # distinguir el revocado del recién emitido.
        "jti": secrets.token_urlsafe(12),
    }
    return jwt.encode(carga, secreto, algorithm="HS256")


def emitir_acceso(usuario: Usuario) -> str:
    """Token de acceso, 15 minutos por defecto."""
    return _firmar(
        {"sub": usuario.id, "email": usuario.email, "role": usuario.rol.name, "type": "access"},
        current_app.config["JWT_ACCESO_SECRETO"],
        current_app.config["JWT_ACCESO_SEGUNDOS"],
    )


def emitir_refresco(usuario: Usuario) -> str:
    """Token de refresco, 7 días por defecto."""
    return _firmar(
        {"sub": usuario.id, "email": usuario.email, "role": usuario.rol.name, "type": "refresh"},
        current_app.config["JWT_REFRESCO_SECRETO"],
        current_app.config["JWT_REFRESCO_SEGUNDOS"],
    )


def leer_token(token: str, secreto: str, tipo: str) -> dict:
    """Valida firma, caducidad y tipo. Devuelve la carga útil."""
    try:
        carga = jwt.decode(token, secreto, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as error:
        raise NoAutorizado("Sesión expirada. Inicie sesión nuevamente.") from error
    except jwt.PyJWTError as error:
        raise NoAutorizado("Sesión no válida. Inicie sesión nuevamente.") from error

    if carga.get("type") != tipo:
        raise NoAutorizado("Token no válido para esta operación")
    return carga


# ──────────────────────── Usuario autenticado ───────────────────────


@dataclass
class UsuarioAutenticado:
    """
    Equivale a `AuthenticatedUser`.

    Lleva el rol por partida doble: `rol_codigo` es el identificador con el que
    se decide qué puede hacer, y `rol_nombre` es solo la etiqueta que se
    muestra. Nada del control de acceso mira el nombre.
    """

    id: str
    email: str
    nombre_completo: str
    rol_id: str
    rol_codigo: str
    rol_nombre: str
    permisos: list[str] = field(default_factory=list)
    docente_id: str | None = None

    @property
    def es_super_admin(self) -> bool:
        return self.rol_codigo == ROL_CONTROL_TOTAL

    def tiene(self, *permisos: str) -> bool:
        """Quien tiene control total siempre puede: misma regla que antes."""
        if self.es_super_admin:
            return True
        return any(p in self.permisos for p in permisos)


def _cargar_usuario(usuario_id: str) -> UsuarioAutenticado:
    """
    Carga el usuario y sus permisos. Réplica de `JwtStrategy.validate`.

    Se comprueba en cada petición, no solo al entrar: si a alguien se le
    desactiva la cuenta o el rol, su sesión deja de servir de inmediato.
    """
    usuario = bd.session.execute(
        select(Usuario)
        .where(Usuario.id == usuario_id, Usuario.deleted_at.is_(None))
        .options(selectinload(Usuario.rol))
    ).scalar_one_or_none()

    if usuario is None:
        raise NoAutorizado("La sesión ya no es válida")

    # RN002 — un usuario inactivo no puede operar en el sistema
    if usuario.status != EstadoRegistro.ACTIVO:
        raise NoAutorizado("El usuario se encuentra inactivo")
    if usuario.rol.status != EstadoRegistro.ACTIVO or usuario.rol.deleted_at is not None:
        raise NoAutorizado("El rol asignado se encuentra inactivo")

    permisos = list(
        bd.session.execute(
            select(Permiso.code)
            .join(RolPermiso, RolPermiso.permission_id == Permiso.id)
            .where(
                RolPermiso.role_id == usuario.role_id,
                Permiso.status == EstadoRegistro.ACTIVO,
                Permiso.deleted_at.is_(None),
            )
        ).scalars()
    )

    docente_id = bd.session.execute(
        select(Docente.id).where(Docente.user_id == usuario.id, Docente.deleted_at.is_(None))
    ).scalar_one_or_none()

    return UsuarioAutenticado(
        id=usuario.id,
        email=usuario.email,
        nombre_completo=usuario.nombre_completo,
        rol_id=usuario.role_id,
        rol_codigo=usuario.rol.code,
        rol_nombre=usuario.rol.name,
        permisos=permisos,
        docente_id=docente_id,
    )


def _token_de_la_peticion() -> str | None:
    """
    Busca el token, primero en la cabecera y después en la sesión del navegador.

    La API lo envía como `Authorization: Bearer …`. Las páginas HTML lo guardan
    en la sesión al entrar, para no tener que repetirlo en cada enlace.
    """
    cabecera = request.headers.get("Authorization", "")
    if cabecera.startswith("Bearer "):
        return cabecera[7:].strip() or None
    return session.get("token_acceso")


_SIN_RESOLVER = object()


def usuario_actual() -> UsuarioAutenticado | None:
    """
    Usuario de la petición en curso, o None si no hay sesión válida.

    El resultado se guarda en el propio objeto `request`, no en `g`. Es
    deliberado: `g` pertenece al contexto de aplicación, que puede sobrevivir a
    varias peticiones cuando alguien lo abre a mano —guiones, pruebas, ciertos
    despliegues—. En ese caso el usuario de una petición se filtraría a la
    siguiente, y alguien podría heredar los permisos de quien pasó antes.
    """
    if not has_request_context():
        return None

    cacheado = getattr(request, "_usuario_autenticado", _SIN_RESOLVER)
    if cacheado is not _SIN_RESOLVER:
        return cacheado

    token = _token_de_la_peticion()
    usuario: UsuarioAutenticado | None = None

    if token:
        try:
            carga = leer_token(token, current_app.config["JWT_ACCESO_SECRETO"], "access")
            usuario = _cargar_usuario(carga["sub"])
        except NoAutorizado:
            usuario = None

    request._usuario_autenticado = usuario
    return usuario


def exigir_usuario() -> UsuarioAutenticado:
    """Usuario de la petición, o error 401."""
    usuario = usuario_actual()
    if usuario is None:
        raise NoAutorizado("Debe iniciar sesión para continuar")
    return usuario


# ─────────────────────────── Decoradores ────────────────────────────


def requiere_sesion(funcion: Callable) -> Callable:
    """Exige una sesión válida. Equivale a `JwtAuthGuard`."""

    @wraps(funcion)
    def envoltura(*args, **kwargs):
        exigir_usuario()
        return funcion(*args, **kwargs)

    return envoltura


def requiere_permisos(*requeridos: str) -> Callable:
    """
    Exige al menos uno de los permisos indicados.

    Equivale a `@RequirePermissions` con `PermissionsGuard`: el SUPER_ADMIN
    pasa siempre, sin necesidad de tener el permiso concreto.
    """

    def decorador(funcion: Callable) -> Callable:
        @wraps(funcion)
        def envoltura(*args, **kwargs):
            usuario = exigir_usuario()
            if not usuario.tiene(*requeridos):
                raise Prohibido(
                    "No cuenta con los permisos necesarios para esta acción "
                    f"({' o '.join(requeridos)})"
                )
            return funcion(*args, **kwargs)

        return envoltura

    return decorador


def requiere_roles(*codigos: str) -> Callable:
    """
    Exige pertenecer a uno de los roles indicados, por su código.

    Equivale a `@RequireRoles` con `RolesGuard`. A diferencia del control por
    permisos, aquí el rol de control total **no** pasa automáticamente: debe
    figurar en la lista. Es la segunda barrera que impide que un permiso
    concedido por error abra una acción reservada.

    Se comparan códigos y no nombres: si mañana el rol pasa a llamarse
    «Rector(a)», esta comprobación sigue valiendo.
    """

    def decorador(funcion: Callable) -> Callable:
        @wraps(funcion)
        def envoltura(*args, **kwargs):
            usuario = exigir_usuario()
            if usuario.rol_codigo not in codigos:
                raise Prohibido(
                    f"Esta acción está reservada a otro rol. El suyo es «{usuario.rol_nombre}»."
                )
            return funcion(*args, **kwargs)

        return envoltura

    return decorador
