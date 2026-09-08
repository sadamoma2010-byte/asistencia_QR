"""Rutas de asistencia. Traducción de `modules/attendance/attendance.controller.ts`."""

from __future__ import annotations

from flask import Blueprint, request

from ...comun import excel as hoja
from ...comun.excel import Columna
from ...comun.peticion import contexto
from ...comun.respuestas import responder
from ...comun.seguridad import exigir_usuario, requiere_permisos, requiere_roles
from ...modelos.acceso import ROL_CONTROL_TOTAL
from ...comun.tiempo import clave_hora, formato_fecha
from . import servicio
from .esquemas import BorrarPorDocente, BorrarSeleccionadas, RegistrarMarcacion

bp = Blueprint("asistencia", __name__)


@bp.post("/attendance/register")
@requiere_permisos("attendance.self", "attendance.create")
def registrar():
    """Registra una entrada o salida aplicando las reglas RN001 a RN009."""
    datos = RegistrarMarcacion.model_validate(request.get_json(silent=True) or {})
    return responder(
        servicio.registrar(
            datos.type, datos.teacherId, datos.notes, exigir_usuario(), contexto(),
            latitude=datos.latitude,
            longitude=datos.longitude,
            location_accuracy=datos.locationAccuracy,
            location_source=datos.locationSource,
        ),
        201,
    )


@bp.get("/attendance/me/status")
@requiere_permisos("attendance.self", "attendance.read")
def estado_propio():
    """Qué puede registrar ahora mismo el docente autenticado."""
    return responder(servicio.estado_propio(exigir_usuario()))


@bp.get("/attendance/me/history")
@requiere_permisos("attendance.self", "attendance.read")
def historial_propio():
    return responder(servicio.historial_propio(exigir_usuario()))


@bp.get("/attendance")
@requiere_permisos("attendance.read")
def listar():
    return responder(servicio.listar())


@bp.get("/attendance/export")
@requiere_permisos("attendance.export")
def exportar():
    filas = servicio.para_exportar()
    contenido = hoja.construir(
        hoja="Asistencia",
        titulo="Registro de asistencia",
        subtitulo=hoja.subtitulo_estandar(len(filas)),
        columnas=[
            Columna("Fecha", 14, valor=lambda f: formato_fecha(f.date)),
            Columna("Hora", 10, valor=lambda f: clave_hora(f.registered_at)),
            Columna("Código", 14, valor=lambda f: f.docente.code),
            Columna(
                "Docente",
                30,
                valor=lambda f: f"{f.docente.first_name} {f.docente.last_name}",
            ),
            Columna("Documento", 18, valor=lambda f: f.docente.document),
            Columna("Tipo", 12, valor=lambda f: servicio.etiqueta_tipo(f.type.value)),
            Columna("Estado", 18, valor=lambda f: servicio.etiqueta_estado(f.status.value)),
            Columna("Hora esperada", 14, valor=lambda f: f.expected_time or "—"),
            Columna("Diferencia", 12, valor=lambda f: f"{f.minutes_diff} min"),
            Columna(
                "Jornada",
                18,
                valor=lambda f: f.horario.jornada.name if f.horario else "—",
            ),
            Columna("Dispositivo", 30, valor=lambda f: f.device or "—"),
        ],
        filas=filas,
    )
    return hoja.descargar(contenido, "asistencia")


# El borrado exige las dos barreras: el permiso y además el rol. Un permiso
# concedido por error a otro rol no basta para llegar aquí.
@bp.post("/attendance/bulk-delete")
@requiere_roles(ROL_CONTROL_TOTAL)
@requiere_permisos("attendance.delete")
def borrar_seleccionadas():
    datos = BorrarSeleccionadas.model_validate(request.get_json(silent=True) or {})
    return responder(
        servicio.borrar_seleccionadas(
            datos.ids, datos.reason, exigir_usuario(), contexto()
        )
    )


@bp.post("/attendance/delete-by-teacher")
@requiere_roles(ROL_CONTROL_TOTAL)
@requiere_permisos("attendance.delete")
def borrar_por_docente():
    datos = BorrarPorDocente.model_validate(request.get_json(silent=True) or {})
    return responder(
        servicio.borrar_por_docente(
            datos.teacherIds,
            datos.dateFrom,
            datos.dateTo,
            datos.reason,
            exigir_usuario(),
            contexto(),
        )
    )


@bp.get("/attendance/<identificador>")
@requiere_permisos("attendance.read")
def detalle(identificador: str):
    return responder(servicio.obtener(identificador))
