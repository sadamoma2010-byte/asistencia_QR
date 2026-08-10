"""Rutas de reportes. Traducción de `modules/reports/reports.controller.ts`."""

from __future__ import annotations

from flask import Blueprint

from ...comun import excel as hoja
from ...comun.excel import Columna
from ...comun.respuestas import responder
from ...comun.seguridad import requiere_permisos
from ...comun.tiempo import clave_hora, formato_fecha
from ..asistencia import servicio as asistencia
from . import servicio

bp = Blueprint("reportes", __name__)


@bp.get("/reports/dashboard")
@requiere_permisos("dashboard.read", "reports.read")
def panel():
    """Indicadores del día y tendencia de la última semana."""
    return responder(servicio.panel())


@bp.get("/reports/attendance")
@requiere_permisos("reports.read")
def informe():
    """Informe agregado por docente."""
    return responder(servicio.informe_por_docente())


@bp.get("/reports/export")
@requiere_permisos("reports.export")
def exportar_resumen():
    filas = servicio.filas_para_exportar()
    contenido = hoja.construir(
        hoja="Resumen",
        titulo="Reporte consolidado de asistencia",
        subtitulo=hoja.subtitulo_estandar(len(filas)),
        columnas=[
            Columna("Código", 14, valor=lambda f: f["code"]),
            Columna("Docente", 30, valor=lambda f: f["fullName"]),
            Columna("Documento", 18, valor=lambda f: f["document"]),
            Columna("Jornadas", 24, valor=lambda f: f["shifts"]),
            Columna("Marcaciones", 14, valor=lambda f: f["totalRecords"]),
            Columna("Entradas", 12, valor=lambda f: f["checkIns"]),
            Columna("Salidas", 12, valor=lambda f: f["checkOuts"]),
            Columna("Puntuales", 12, valor=lambda f: f["onTime"]),
            Columna("Tardanzas", 12, valor=lambda f: f["late"]),
            Columna("Salidas anticipadas", 20, valor=lambda f: f["earlyDeparture"]),
            Columna("Minutos de retraso", 20, valor=lambda f: f["totalLateMinutes"]),
            Columna("Puntualidad", 14, valor=lambda f: f"{f['punctualityRate']}%"),
        ],
        filas=filas,
    )
    return hoja.descargar(contenido, "reporte_asistencia")


@bp.get("/reports/export/detail")
@requiere_permisos("reports.export")
def exportar_detalle():
    filas = servicio.detalle_para_exportar()
    contenido = hoja.construir(
        hoja="Detalle",
        titulo="Detalle de marcaciones",
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
            Columna("Tipo", 12, valor=lambda f: asistencia.etiqueta_tipo(f.type.value)),
            Columna("Estado", 18, valor=lambda f: asistencia.etiqueta_estado(f.status.value)),
            Columna("Hora esperada", 14, valor=lambda f: f.expected_time or "—"),
            Columna("Diferencia", 12, valor=lambda f: f"{f.minutes_diff} min"),
            Columna(
                "Jornada", 18, valor=lambda f: f.horario.jornada.name if f.horario else "—"
            ),
        ],
        filas=filas,
    )
    return hoja.descargar(contenido, "detalle_marcaciones")
