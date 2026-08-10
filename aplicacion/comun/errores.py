"""
Errores de la aplicación y su traducción a respuestas HTTP.

Sustituye a `AllExceptionsFilter` y a las excepciones de `@nestjs/common`.
Los mensajes y los códigos son los mismos que devolvía el sistema anterior.
"""

from __future__ import annotations

import logging

from flask import Flask, request
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

from .respuestas import responder_error

registro = logging.getLogger("asistencia")


class ErrorAplicacion(Exception):
    """Error controlado, con su código HTTP. Equivale a `HttpException`."""

    codigo = 400

    def __init__(self, mensaje: str, codigo: int | None = None, errores: list[str] | None = None):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.errores = errores
        if codigo is not None:
            self.codigo = codigo


class SolicitudInvalida(ErrorAplicacion):
    """400 — equivale a `BadRequestException`."""

    codigo = 400


class NoAutorizado(ErrorAplicacion):
    """401 — equivale a `UnauthorizedException`."""

    codigo = 401


class Prohibido(ErrorAplicacion):
    """403 — equivale a `ForbiddenException`."""

    codigo = 403


class NoEncontrado(ErrorAplicacion):
    """404 — equivale a `NotFoundException`."""

    codigo = 404


class Conflicto(ErrorAplicacion):
    """409 — equivale a `ConflictException`."""

    codigo = 409


def _traducir_integridad(error: IntegrityError) -> tuple[int, str]:
    """
    Traduce los errores de PostgreSQL a los mismos mensajes que daba Prisma.

    Los códigos son los de PostgreSQL, que es lo que Prisma envolvía en P2002,
    P2003 y compañía.
    """
    codigo_sql = getattr(getattr(error.orig, "pgcode", None), "strip", lambda: None)()
    detalle = str(getattr(error.orig, "diag", None) and error.orig.diag.constraint_name or "")

    if codigo_sql == "23505":  # unique_violation → P2002
        campo = f" en: {detalle}" if detalle else ""
        return 409, f"Ya existe un registro con ese valor{campo}"
    if codigo_sql == "23503":  # foreign_key_violation → P2003
        return 409, "La operación afecta registros relacionados y no puede completarse"
    if codigo_sql == "23514":  # check_violation
        return 400, "Los datos enviados no cumplen una restricción de la base de datos"
    if codigo_sql == "23502":  # not_null_violation
        return 400, "Falta un dato obligatorio"

    return 400, "No fue posible completar la operación en la base de datos"


def _mensajes_de_validacion(error: ValidationError) -> list[str]:
    """
    Convierte los errores de pydantic al formato de `class-validator`:
    una lista de frases legibles, una por campo.
    """
    mensajes: list[str] = []
    for fallo in error.errors():
        campo = ".".join(str(p) for p in fallo["loc"]) or "cuerpo"
        mensajes.append(f"{campo}: {fallo['msg']}")
    return mensajes


def registrar_manejadores(app: Flask) -> None:
    """Engancha los manejadores globales. Equivale a `useGlobalFilters`."""

    def _ruta() -> str:
        return request.full_path.rstrip("?") if request else ""

    @app.errorhandler(ErrorAplicacion)
    def _controlado(error: ErrorAplicacion):
        registro.warning("%s %s → %s: %s", request.method, request.path, error.codigo, error.mensaje)
        return responder_error(error.mensaje, error.codigo, error.errores, _ruta())

    @app.errorhandler(ValidationError)
    def _validacion(error: ValidationError):
        return responder_error(
            "Los datos enviados no son válidos", 400, _mensajes_de_validacion(error), _ruta()
        )

    @app.errorhandler(RequestEntityTooLarge)
    def _demasiado_grande(_error: RequestEntityTooLarge):
        return responder_error("El archivo supera el tamaño máximo permitido (5 MB)", 413, None, _ruta())

    @app.errorhandler(IntegrityError)
    def _integridad(error: IntegrityError):
        from ..extensiones import bd

        bd.session.rollback()
        codigo, mensaje = _traducir_integridad(error)
        registro.warning("%s %s → %s: %s", request.method, request.path, codigo, mensaje)
        return responder_error(mensaje, codigo, None, _ruta())

    @app.errorhandler(SQLAlchemyError)
    def _base_datos(error: SQLAlchemyError):
        from ..extensiones import bd

        bd.session.rollback()
        registro.error("Error de base de datos en %s %s", request.method, request.path, exc_info=error)
        return responder_error("No fue posible completar la operación en la base de datos", 500, None, _ruta())

    @app.errorhandler(HTTPException)
    def _http(error: HTTPException):
        # Las páginas HTML no deben responder JSON: se dejan pasar
        if not request.path.startswith(app.config["PREFIJO_API"]):
            return error
        return responder_error(error.description or error.name, error.code or 500, None, _ruta())

    @app.errorhandler(Exception)
    def _inesperado(error: Exception):
        from ..extensiones import bd

        bd.session.rollback()
        registro.error("%s %s → 500", request.method, request.path, exc_info=error)
        return responder_error("Ha ocurrido un error inesperado", 500, None, _ruta())
