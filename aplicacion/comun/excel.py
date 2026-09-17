"""
Generación de libros de Excel.

Sustituye a `common/utils/excel.util.ts` y a la librería ExcelJS.
El resultado debe verse igual que el del sistema anterior: mismo encabezado
corporativo, mismos colores, filas alternas, panel congelado y autofiltro.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Callable, Sequence

from flask import Response
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from .tiempo import formato_fecha_hora

# Misma paleta que el sistema anterior. openpyxl usa RGB sin canal alfa.
PRIMARIO = "4F46E5"
TEXTO_CABECERA = "FFFFFF"
FRANJA = "F8FAFC"
BORDE = "E2E8F0"
TITULO = "0F172A"
SECUNDARIO = "64748B"


@dataclass
class Columna:
    """Una columna del informe."""

    encabezado: str
    ancho: int = 22
    valor: Callable[[Any], Any] | None = None
    clave: str | None = None

    def leer(self, fila: Any) -> Any:
        if self.valor is not None:
            return self.valor(fila)
        if self.clave is None:
            return ""
        if isinstance(fila, dict):
            return fila.get(self.clave, "")
        return getattr(fila, self.clave, "")


def construir(
    *,
    hoja: str,
    titulo: str,
    subtitulo: str | None,
    columnas: Sequence[Columna],
    filas: Sequence[Any],
) -> bytes:
    """Genera el libro y lo devuelve en memoria."""
    libro = Workbook()
    libro.properties.creator = "Sistema de Asistencia Docente por QR"
    libro.properties.created = datetime.now()

    pagina: Worksheet = libro.active
    pagina.title = hoja[:31]  # Excel no admite nombres de hoja más largos
    pagina.page_setup.orientation = "landscape"
    pagina.page_setup.fitToPage = True

    ultima = get_column_letter(len(columnas))

    # ── Título ───────────────────────────────────────────────────────
    pagina.merge_cells(f"A1:{ultima}1")
    celda = pagina["A1"]
    celda.value = titulo
    celda.font = Font(size=15, bold=True, color=TITULO)
    celda.alignment = Alignment(vertical="center")
    pagina.row_dimensions[1].height = 28

    fila_cabecera = 3
    if subtitulo:
        pagina.merge_cells(f"A2:{ultima}2")
        celda = pagina["A2"]
        celda.value = subtitulo
        celda.font = Font(size=10, color=SECUNDARIO)
        fila_cabecera = 4

    # ── Encabezado de columnas ───────────────────────────────────────
    borde_fino = Side(style="thin", color=BORDE)
    relleno_cabecera = PatternFill("solid", fgColor=PRIMARIO)

    for indice, columna in enumerate(columnas, start=1):
        celda = pagina.cell(row=fila_cabecera, column=indice, value=columna.encabezado)
        celda.font = Font(bold=True, color=TEXTO_CABECERA, size=11)
        celda.fill = relleno_cabecera
        celda.alignment = Alignment(vertical="center", horizontal="left")
        celda.border = Border(top=borde_fino, bottom=borde_fino, left=borde_fino, right=borde_fino)
        pagina.column_dimensions[get_column_letter(indice)].width = columna.ancho

    pagina.row_dimensions[fila_cabecera].height = 22

    # ── Datos ────────────────────────────────────────────────────────
    borde_suave = Border(bottom=Side(style="hair", color=BORDE))
    relleno_franja = PatternFill("solid", fgColor=FRANJA)

    for desplazamiento, fila in enumerate(filas):
        numero = fila_cabecera + 1 + desplazamiento
        for indice, columna in enumerate(columnas, start=1):
            valor = columna.leer(fila)
            # Excel no sabe escribir objetos: se pasan como texto
            if not isinstance(valor, (str, int, float, date, datetime, type(None))):
                valor = str(valor)
            celda = pagina.cell(row=numero, column=indice, value=valor)
            celda.alignment = Alignment(vertical="center", wrap_text=False)
            celda.border = borde_suave
            if desplazamiento % 2 == 1:
                celda.fill = relleno_franja

    # ── Panel congelado y autofiltro ─────────────────────────────────
    pagina.freeze_panes = f"A{fila_cabecera + 1}"
    pagina.auto_filter.ref = f"A{fila_cabecera}:{ultima}{fila_cabecera}"

    memoria = io.BytesIO()
    libro.save(memoria)
    return memoria.getvalue()


def descargar(contenido: bytes, nombre: str) -> Response:
    """Envía el libro como descarga, con el mismo nombre que antes."""
    marcado = f"{nombre}_{date.today().isoformat()}.xlsx"
    return Response(
        contenido,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{marcado}"',
            "Content-Length": str(len(contenido)),
        },
    )


def subtitulo_estandar(cantidad: int) -> str:
    """Línea de contexto que llevan todos los informes."""
    return f"Generado el {formato_fecha_hora(datetime.now())} · {cantidad} registro(s)"
