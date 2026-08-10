"""
Utilidades de fecha y hora.

Sustituye a `common/utils/time.util.ts` y a la librería `date-fns-tz`.
Se apoya en `zoneinfo`, que forma parte de la biblioteca estándar de Python.

Toda la aritmética horaria del sistema pasa por aquí: la puntualidad, las
ventanas de marcación y los rangos de fechas de los informes.
"""

from __future__ import annotations

import os
import re
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

ZONA_APP = os.getenv("APP_TIMEZONE", "America/Bogota")

DIAS = (
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
)


def _zona(nombre: str | None = None) -> ZoneInfo:
    return ZoneInfo(nombre or ZONA_APP)


def ahora() -> datetime:
    """Instante actual, siempre consciente de la zona horaria."""
    return datetime.now(timezone.utc)


def a_local(momento: datetime, zona: str | None = None) -> datetime:
    """Convierte un instante UTC a la hora local institucional."""
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return momento.astimezone(_zona(zona))


def clave_fecha(momento: datetime | date, zona: str | None = None) -> str:
    """`YYYY-MM-DD` en la zona horaria institucional."""
    if isinstance(momento, datetime):
        return a_local(momento, zona).strftime("%Y-%m-%d")
    return momento.strftime("%Y-%m-%d")


def clave_hora(momento: datetime, zona: str | None = None) -> str:
    """`HH:MM` en la zona horaria institucional."""
    return a_local(momento, zona).strftime("%H:%M")


def dia_semana(momento: datetime, zona: str | None = None) -> int:
    """
    Día de la semana local: 0 = domingo … 6 = sábado.

    Python numera con lunes = 0, así que se desplaza para conservar la
    numeración del sistema original y la de la columna `day_of_week`.
    """
    return (a_local(momento, zona).weekday() + 1) % 7


def hora_a_minutos(hora: str) -> int:
    """Convierte `HH:MM` a minutos desde medianoche."""
    h, m = (int(p) for p in hora.split(":")[:2])
    return h * 60 + m


def minutos_a_hora(minutos: int) -> str:
    """Convierte minutos desde medianoche a `HH:MM`, dando la vuelta al día."""
    normalizado = ((minutos % 1440) + 1440) % 1440
    return f"{normalizado // 60:02d}:{normalizado % 60:02d}"


def diferencia_minutos(real: str, esperada: str) -> int:
    """Minutos entre la hora real y la esperada. Positivo significa tarde."""
    return hora_a_minutos(real) - hora_a_minutos(esperada)


def solo_fecha(clave: str) -> date:
    """Convierte `YYYY-MM-DD` en una fecha almacenable en una columna DATE."""
    return date.fromisoformat(clave)


def rango_dias(desde: str | None, hasta: str | None) -> tuple[date | None, date | None]:
    """Rango [inicio, fin] para filtrar por la columna `date`."""
    return (
        solo_fecha(desde) if desde else None,
        solo_fecha(hasta) if hasta else None,
    )


def formato_fecha_hora(momento: datetime, zona: str | None = None) -> str:
    """Formato legible para informes: `07/08/2026 07:12`."""
    return a_local(momento, zona).strftime("%d/%m/%Y %H:%M")


def formato_fecha(momento: datetime | date, zona: str | None = None) -> str:
    """Formato legible de fecha: `07/08/2026`."""
    if isinstance(momento, datetime):
        return a_local(momento, zona).strftime("%d/%m/%Y")
    return momento.strftime("%d/%m/%Y")


def iso(momento: datetime | date | None) -> str | None:
    """
    Serializa una fecha al formato que producía JavaScript.

    `toISOString()` siempre devuelve UTC terminado en `Z` con milisegundos.
    Una columna DATE llegaba a JavaScript como fecha anclada a medianoche UTC,
    de modo que salía igual: `2026-08-08T00:00:00.000Z`. Se reproduce tal cual
    para que la interfaz no note el cambio.
    """
    if momento is None:
        return None
    if isinstance(momento, datetime):
        if momento.tzinfo is None:
            momento = momento.replace(tzinfo=timezone.utc)
    else:
        momento = datetime(momento.year, momento.month, momento.day, tzinfo=timezone.utc)

    return (
        momento.astimezone(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


PATRON_HORA = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def es_hora_valida(valor: str) -> bool:
    """Comprueba el formato `HH:MM` de 24 horas."""
    return bool(PATRON_HORA.match(valor or ""))
