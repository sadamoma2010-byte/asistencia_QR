"""
Rutas de jornadas.

Traducción de `modules/shifts/shifts.controller.ts`.
"""

from __future__ import annotations

from flask import Blueprint

from ...comun.excel import Columna
from ...comun.rutas_crud import Exportacion, registrar_crud
from ...comun.tiempo import formato_fecha_hora
from .esquemas import ActualizarJornada, CrearJornada
from .servicio import ServicioJornadas, _contar_horarios

bp = Blueprint("jornadas", __name__)

registrar_crud(
    bp,
    ruta="shifts",
    servicio=ServicioJornadas,
    permiso="shifts",
    esquema_crear=CrearJornada,
    esquema_actualizar=ActualizarJornada,
    opciones=ServicioJornadas.opciones,
    permisos_opciones=("shifts.read", "schedules.create", "reports.read"),
    exportacion=Exportacion(
        nombre_hoja="Jornadas",
        titulo="Listado de jornadas",
        archivo="jornadas",
        columnas=[
            Columna("Jornada", 24, valor=lambda f: f.name),
            Columna("Descripción", 48, valor=lambda f: f.description or "—"),
            Columna("Horarios", 12, valor=lambda f: _contar_horarios(f.id)),
            Columna(
                "Estado", 14, valor=lambda f: "Activa" if f.status.value == "ACTIVE" else "Inactiva"
            ),
            Columna("Creada", 20, valor=lambda f: formato_fecha_hora(f.created_at)),
        ],
    ),
)
