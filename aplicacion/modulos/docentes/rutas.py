"""Rutas de docentes. Traducción de `modules/teachers/teachers.controller.ts`."""

from __future__ import annotations

from flask import Blueprint, Response, request

from ...comun.excel import Columna
from ...comun.peticion import contexto
from ...comun.respuestas import responder
from ...comun.rutas_crud import Exportacion, registrar_crud
from ...comun.seguridad import exigir_usuario, requiere_permisos, requiere_sesion
from ...comun.tiempo import formato_fecha_hora
from .esquemas import ActualizarDocente, AsignarAsignaturas, AsignarCursos, CrearDocente
from .servicio import (
    ServicioDocentes,
    _asignaturas_de,
    _contar_horarios,
    _contar_marcaciones,
    _cursos_de,
)

bp = Blueprint("docentes", __name__)


@bp.get("/teachers/next-code")
@requiere_permisos("teachers.create")
def sugerir_codigo():
    """Siguiente código disponible con el formato DOC-0000."""
    return responder(ServicioDocentes.sugerir_codigo())


@bp.patch("/teachers/<identificador>/subjects")
@requiere_permisos("teachers.update")
def asignar_asignaturas(identificador: str):
    """Reemplaza el listado de asignaturas que dicta el docente."""
    datos = AsignarAsignaturas.model_validate(request.get_json(silent=True) or {})
    return responder(
        ServicioDocentes.asignar_asignaturas(
            identificador, datos.subjectIds, exigir_usuario(), contexto()
        )
    )


@bp.patch("/teachers/<identificador>/courses")
@requiere_permisos("teachers.update")
def asignar_cursos(identificador: str):
    """Reemplaza el listado de cursos que atiende el docente."""
    datos = AsignarCursos.model_validate(request.get_json(silent=True) or {})
    return responder(
        ServicioDocentes.asignar_cursos(
            identificador, datos.courseIds, exigir_usuario(), contexto()
        )
    )


@bp.get("/teachers/<identificador>/photo")
@requiere_sesion
def ver_foto(identificador: str):
    """
    Sirve la fotografía guardada en la base.

    Basta con tener sesión: la foto aparece en listados, en la ficha y en la
    pantalla de marcación, y no todos esos usuarios tienen permiso de lectura
    sobre el módulo de docentes.
    """
    imagen = ServicioDocentes.leer_foto(identificador)
    if imagen is None:
        return Response(status=404)

    contenido, tipo = imagen
    return Response(
        contenido,
        mimetype=tipo,
        headers={
            # La dirección lleva marca de tiempo: al cambiar la foto cambia la
            # dirección, así que el navegador puede guardarla sin miedo.
            "Cache-Control": "private, max-age=604800",
            "Content-Length": str(len(contenido)),
        },
    )


@bp.post("/teachers/<identificador>/photo")
@requiere_permisos("teachers.update")
def subir_foto(identificador: str):
    """Sube y normaliza la fotografía del docente."""
    return responder(
        ServicioDocentes.subir_foto(
            identificador, request.files.get("file"), exigir_usuario(), contexto()
        )
    )


@bp.delete("/teachers/<identificador>/photo")
@requiere_permisos("teachers.update")
def quitar_foto(identificador: str):
    """Quita la fotografía del docente."""
    return responder(
        ServicioDocentes.quitar_foto(identificador, exigir_usuario(), contexto())
    )


registrar_crud(
    bp,
    ruta="teachers",
    servicio=ServicioDocentes,
    permiso="teachers",
    esquema_crear=CrearDocente,
    esquema_actualizar=ActualizarDocente,
    opciones=ServicioDocentes.opciones,
    permisos_opciones=(
        "teachers.read",
        "schedules.create",
        "attendance.create",
        "reports.read",
    ),
    exportacion=Exportacion(
        nombre_hoja="Docentes",
        titulo="Listado de docentes",
        archivo="docentes",
        columnas=[
            Columna("Código", 14, valor=lambda f: f.code),
            Columna("Docente", 30, valor=lambda f: f"{f.first_name} {f.last_name}"),
            Columna("Documento", 18, valor=lambda f: f.document),
            Columna("Correo", 32, valor=lambda f: f.email),
            Columna("Teléfono", 16, valor=lambda f: f.phone or "—"),
            Columna(
                "Asignaturas",
                34,
                valor=lambda f: ", ".join(a["name"] for a in _asignaturas_de(f.id)) or "—",
            ),
            Columna(
                "Cursos",
                24,
                valor=lambda f: ", ".join(c["name"] for c in _cursos_de(f.id)) or "—",
            ),
            Columna("Horarios", 12, valor=lambda f: _contar_horarios(f.id)),
            Columna("Marcaciones", 14, valor=lambda f: _contar_marcaciones(f.id)),
            Columna(
                "Estado", 14, valor=lambda f: "Activo" if f.status.value == "ACTIVE" else "Inactivo"
            ),
            Columna("Creado", 20, valor=lambda f: formato_fecha_hora(f.created_at)),
        ],
    ),
)
