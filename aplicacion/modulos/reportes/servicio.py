"""
Servicio de reportes.

Traducción de `modules/reports/reports.service.ts`: el panel de indicadores y
el informe consolidado por docente.
"""

from __future__ import annotations

from datetime import timedelta

from flask import request
from sqlalchemy import case, func, select

from ...comun.consultas import Paginacion
from ...comun.respuestas import resultado_paginado
from ...comun.tiempo import ahora, clave_fecha, iso, rango_dias, solo_fecha
from ...extensiones import bd
from ...modelos import (
    Docente,
    EstadoMarcacion,
    EstadoRegistro,
    Horario,
    Marcacion,
    TipoMarcacion,
)
from ..configuracion import servicio as configuracion

TOPE_INFORME = 10000


def _zona() -> str:
    return configuracion.texto(configuracion.CLAVES["ZONA_HORARIA"], "America/Bogota")


def _contar(*condiciones) -> int:
    return bd.session.execute(
        select(func.count()).select_from(Marcacion).where(*condiciones)
    ).scalar_one()


def panel() -> dict:
    """Indicadores del día y tendencia de la última semana."""
    zona = _zona()
    hoy = solo_fecha(clave_fecha(ahora(), zona))
    inicio_semana = hoy - timedelta(days=6)

    vigentes = Marcacion.deleted_at.is_(None)

    total_docentes = bd.session.execute(
        select(func.count()).select_from(Docente).where(Docente.deleted_at.is_(None))
    ).scalar_one()
    docentes_activos = bd.session.execute(
        select(func.count())
        .select_from(Docente)
        .where(Docente.deleted_at.is_(None), Docente.status == EstadoRegistro.ACTIVO)
    ).scalar_one()

    registros_hoy = _contar(Marcacion.date == hoy, vigentes)
    tardanzas_hoy = _contar(
        Marcacion.date == hoy, vigentes, Marcacion.status == EstadoMarcacion.TARDE
    )
    salidas_hoy = _contar(
        Marcacion.date == hoy, vigentes, Marcacion.type == TipoMarcacion.SALIDA
    )

    # Docentes distintos que marcaron entrada hoy
    entradas_hoy = bd.session.execute(
        select(func.count(func.distinct(Marcacion.teacher_id))).where(
            Marcacion.date == hoy, vigentes, Marcacion.type == TipoMarcacion.ENTRADA
        )
    ).scalar_one()

    puntuales_hoy = registros_hoy - tardanzas_hoy

    # ── Tendencia de los últimos 7 días ──────────────────────────────
    agrupado = bd.session.execute(
        select(
            Marcacion.date,
            func.count().label("total"),
            func.count(case((Marcacion.status == EstadoMarcacion.TARDE, 1))).label("tarde"),
        )
        .where(Marcacion.date >= inicio_semana, Marcacion.date <= hoy, vigentes)
        .group_by(Marcacion.date)
    ).all()
    por_dia = {fila.date: (fila.total, fila.tarde) for fila in agrupado}

    tendencia = []
    for atras in range(6, -1, -1):
        dia = hoy - timedelta(days=atras)
        total, tarde = por_dia.get(dia, (0, 0))
        tendencia.append(
            {
                "date": dia.isoformat(),
                "onTime": total - tarde,
                "late": tarde,
                "total": total,
            }
        )

    # ── Actividad reciente ───────────────────────────────────────────
    recientes = list(
        bd.session.execute(
            select(Marcacion)
            .where(vigentes)
            .order_by(Marcacion.registered_at.desc())
            .limit(8)
        ).scalars().unique()
    )

    # ── Docentes con más tardanzas de la semana ──────────────────────
    top = bd.session.execute(
        select(Marcacion.teacher_id, func.count().label("tardanzas"))
        .where(
            Marcacion.date >= inicio_semana,
            Marcacion.date <= hoy,
            vigentes,
            Marcacion.status == EstadoMarcacion.TARDE,
        )
        .group_by(Marcacion.teacher_id)
        .order_by(func.count().desc())
        .limit(5)
    ).all()

    docentes_top = {
        d.id: d
        for d in bd.session.execute(
            select(Docente).where(Docente.id.in_([f.teacher_id for f in top]))
        ).scalars()
    } if top else {}

    con_tardanzas = [
        {
            "teacherId": fila.teacher_id,
            "code": docentes_top[fila.teacher_id].code if fila.teacher_id in docentes_top else "—",
            "fullName": (
                f"{docentes_top[fila.teacher_id].first_name} "
                f"{docentes_top[fila.teacher_id].last_name}"
                if fila.teacher_id in docentes_top
                else "Docente eliminado"
            ),
            "lateCount": fila.tardanzas,
        }
        for fila in top
    ]

    return {
        "date": clave_fecha(ahora(), zona),
        "kpis": {
            "totalTeachers": total_docentes,
            "activeTeachers": docentes_activos,
            "attendancesToday": entradas_hoy,
            "lateToday": tardanzas_hoy,
            "recordsToday": registros_hoy,
            "onTimeToday": puntuales_hoy,
            "checkInsToday": entradas_hoy,
            "checkOutsToday": salidas_hoy,
            "punctualityRate": (
                round(puntuales_hoy / registros_hoy * 100) if registros_hoy else 100
            ),
            "coverageRate": (
                round(entradas_hoy / docentes_activos * 100) if docentes_activos else 0
            ),
            "pendingCheckOut": max(0, entradas_hoy - salidas_hoy),
        },
        "trend": tendencia,
        "recent": [_reciente(m) for m in recientes],
        "topLateTeachers": con_tardanzas,
    }


def _reciente(fila: Marcacion) -> dict:
    """
    Marcación tal como la muestra la actividad reciente del panel.

    Lleva menos datos que el listado de asistencia: solo lo que se pinta en la
    tarjeta, sin el documento del docente ni el horario completo.
    """
    docente = fila.docente
    return {
        "id": fila.id,
        "teacherId": fila.teacher_id,
        "scheduleId": fila.schedule_id,
        "type": fila.type.value,
        "status": fila.status.value,
        "date": iso(fila.date),
        "registeredAt": iso(fila.registered_at),
        "expectedTime": fila.expected_time,
        "minutesDiff": fila.minutes_diff,
        "ipAddress": fila.ip_address,
        "userAgent": fila.user_agent,
        "device": fila.device,
        "notes": fila.notes,
        "registeredById": fila.registered_by_id,
        "createdAt": iso(fila.created_at),
        "updatedAt": iso(fila.updated_at),
        "deletedAt": iso(fila.deleted_at),
        "teacher": {
            "id": docente.id,
            "code": docente.code,
            "firstName": docente.first_name,
            "lastName": docente.last_name,
        },
        "schedule": (
            {"shift": {"name": fila.horario.jornada.name}} if fila.horario else None
        ),
    }


# ────────────────────── Informe consolidado ──────────────────────────


def _filtros():
    condiciones = [Marcacion.deleted_at.is_(None)]

    docente_id = request.args.get("teacherId")
    if docente_id:
        condiciones.append(Marcacion.teacher_id == docente_id)

    estado = request.args.get("status")
    if estado in ("ON_TIME", "LATE", "EARLY_DEPARTURE"):
        condiciones.append(Marcacion.status == EstadoMarcacion(estado))

    tipo = request.args.get("type")
    if tipo in ("CHECK_IN", "CHECK_OUT"):
        condiciones.append(Marcacion.type == TipoMarcacion(tipo))

    jornada_id = request.args.get("shiftId")
    if jornada_id:
        condiciones.append(
            Marcacion.schedule_id.in_(
                select(Horario.id).where(Horario.shift_id == jornada_id)
            )
        )

    desde, hasta = rango_dias(request.args.get("dateFrom"), request.args.get("dateTo"))
    if desde:
        condiciones.append(Marcacion.date >= desde)
    if hasta:
        condiciones.append(Marcacion.date <= hasta)

    return condiciones


def _filas_por_docente() -> list[dict]:
    """
    Agregado por docente.

    Se recorren las marcaciones en lugar de agrupar en SQL porque el informe
    incluye el listado de jornadas distintas en que marcó cada docente, y eso
    exige ver los registros uno a uno.
    """
    registros = list(
        bd.session.execute(
            select(Marcacion).where(*_filtros()).limit(TOPE_INFORME)
        ).scalars().unique()
    )

    agrupado: dict[str, dict] = {}
    jornadas: dict[str, set[str]] = {}

    for registro in registros:
        clave = registro.teacher_id
        docente = registro.docente

        fila = agrupado.get(clave)
        if fila is None:
            fila = {
                "teacherId": clave,
                "code": docente.code,
                "fullName": f"{docente.first_name} {docente.last_name}",
                "document": docente.document,
                "shifts": "",
                "totalRecords": 0,
                "checkIns": 0,
                "checkOuts": 0,
                "onTime": 0,
                "late": 0,
                "earlyDeparture": 0,
                "totalLateMinutes": 0,
                "punctualityRate": 0,
            }
            agrupado[clave] = fila
            jornadas[clave] = set()

        fila["totalRecords"] += 1
        if registro.type == TipoMarcacion.ENTRADA:
            fila["checkIns"] += 1
        else:
            fila["checkOuts"] += 1

        if registro.status == EstadoMarcacion.TARDE:
            fila["late"] += 1
            fila["totalLateMinutes"] += max(0, registro.minutes_diff)
        elif registro.status == EstadoMarcacion.SALIDA_ANTICIPADA:
            fila["earlyDeparture"] += 1
        else:
            fila["onTime"] += 1

        if registro.horario and registro.horario.jornada.name:
            jornadas[clave].add(registro.horario.jornada.name)

    filas = []
    for clave, fila in agrupado.items():
        fila["shifts"] = ", ".join(sorted(jornadas[clave])) or "—"
        fila["punctualityRate"] = (
            round(fila["onTime"] / fila["totalRecords"] * 100) if fila["totalRecords"] else 0
        )
        filas.append(fila)

    # Orden alfabético por nombre, como en el sistema original
    filas.sort(key=lambda f: _clave_alfabetica(f["fullName"]))
    return filas


def _clave_alfabetica(texto: str) -> str:
    """
    Clave de ordenación equivalente a `localeCompare(…, 'es')`.

    Sin normalizar, «Álvarez» quedaría después de «Zapata» porque su código de
    carácter es mayor. Se comparan las letras sin tildes.
    """
    import unicodedata

    sin_tildes = "".join(
        c
        for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )
    return sin_tildes.casefold()


def informe_por_docente() -> dict:
    """Informe agregado, paginado sobre el resultado ya agrupado."""
    paginacion = Paginacion("createdAt")
    filas = _filas_por_docente()
    inicio = paginacion.desplazamiento
    return resultado_paginado(
        filas[inicio : inicio + paginacion.limite],
        len(filas),
        paginacion.pagina,
        paginacion.limite,
    )


def filas_para_exportar() -> list[dict]:
    return _filas_por_docente()


def detalle_para_exportar() -> list[Marcacion]:
    return list(
        bd.session.execute(
            select(Marcacion)
            .where(*_filtros())
            .order_by(Marcacion.date.desc(), Marcacion.registered_at.desc())
            .limit(10000)
        ).scalars().unique()
    )
