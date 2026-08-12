"""
Servicio de horarios.

Traducción de `modules/schedules/schedules.service.ts`. La pieza delicada es
la comprobación de cruces: dos franjas del mismo docente no pueden solaparse.
"""

from __future__ import annotations

from flask import request
from sqlalchemy import select

from ...comun.consultas import Paginacion
from ...comun.crud import ServicioCRUD
from ...comun.errores import Conflicto, SolicitudInvalida
from ...comun.tiempo import DIAS, hora_a_minutos
from ...extensiones import bd
from ...modelos import (
    Asignatura,
    Curso,
    Docente,
    DocenteAsignatura,
    DocenteCurso,
    EstadoRegistro,
    Horario,
    Jornada,
    nuevo_id,
)


def etiqueta_dia(dia: int | None) -> str:
    return "Todos los días" if dia is None else DIAS[dia]


class ServicioHorarios(ServicioCRUD):
    modelo = Horario
    modulo = "Horarios"
    articulo = "el"
    sustantivo = "horario"
    tope_exportacion = 5000

    ordenables = {
        "createdAt": Horario.created_at,
        "dayOfWeek": Horario.day_of_week,
        "checkInTime": Horario.check_in_time,
        "checkOutTime": Horario.check_out_time,
        "status": Horario.status,
    }
    buscables = (
        Docente.first_name,
        Docente.last_name,
        Docente.code,
        Jornada.name,
        Asignatura.name,
        Asignatura.code,
    )

    # ── Consultas ────────────────────────────────────────────────────

    @classmethod
    def consulta_base(cls):
        # Uniones necesarias para buscar por docente, jornada o asignatura
        return (
            select(Horario)
            .join(Docente, Docente.id == Horario.teacher_id)
            .join(Jornada, Jornada.id == Horario.shift_id)
            .outerjoin(Asignatura, Asignatura.id == Horario.subject_id)
            .where(Horario.deleted_at.is_(None))
        )

    @classmethod
    def aplicar_filtros(cls, consulta, paginacion: Paginacion):
        consulta = super().aplicar_filtros(consulta, paginacion)

        for parametro, columna in (
            ("teacherId", Horario.teacher_id),
            ("shiftId", Horario.shift_id),
            ("subjectId", Horario.subject_id),
            ("courseId", Horario.course_id),
        ):
            valor = request.args.get(parametro)
            if valor:
                consulta = consulta.where(columna == valor)

        dia = request.args.get("dayOfWeek")
        if dia not in (None, ""):
            try:
                consulta = consulta.where(Horario.day_of_week == int(dia))
            except ValueError:
                pass
        return consulta

    @classmethod
    def serializar(cls, fila: Horario) -> dict:
        docente, jornada, asignatura = fila.docente, fila.jornada, fila.asignatura
        curso = fila.curso
        return {
            **cls.campos_comunes(fila),
            "teacherId": fila.teacher_id,
            "shiftId": fila.shift_id,
            "subjectId": fila.subject_id,
            "courseId": fila.course_id,
            "dayOfWeek": fila.day_of_week,
            "dayName": etiqueta_dia(fila.day_of_week),
            "checkInTime": fila.check_in_time,
            "checkOutTime": fila.check_out_time,
            "toleranceMinutes": fila.tolerance_minutes,
            "teacher": {
                "id": docente.id,
                "code": docente.code,
                "firstName": docente.first_name,
                "lastName": docente.last_name,
                "status": docente.status.value,
            },
            "shift": {"id": jornada.id, "name": jornada.name, "status": jornada.status.value},
            "subject": (
                {
                    "id": asignatura.id,
                    "code": asignatura.code,
                    "name": asignatura.name,
                    "color": asignatura.color,
                }
                if asignatura
                else None
            ),
            "course": (
                {
                    "id": curso.id,
                    "name": curso.name,
                    "gradeId": curso.grade_id,
                    "gradeName": curso.grado.name,
                }
                if curso
                else None
            ),
        }

    @classmethod
    def por_docente(cls, docente_id: str) -> list[dict]:
        """Horarios activos de un docente, ordenados por día y hora."""
        filas = bd.session.execute(
            select(Horario)
            .where(
                Horario.teacher_id == docente_id,
                Horario.deleted_at.is_(None),
                Horario.status == EstadoRegistro.ACTIVO,
            )
            .order_by(Horario.day_of_week.asc(), Horario.check_in_time.asc())
        ).scalars()
        return [cls.serializar(f) for f in filas]

    # ── Mutaciones ───────────────────────────────────────────────────

    @classmethod
    def construir(cls, datos: dict) -> Horario:
        return Horario(
            id=nuevo_id(),
            teacher_id=datos["teacherId"],
            shift_id=datos["shiftId"],
            subject_id=datos.get("subjectId") or None,
            course_id=datos.get("courseId") or None,
            day_of_week=datos.get("dayOfWeek"),
            check_in_time=datos["checkInTime"],
            check_out_time=datos["checkOutTime"],
            tolerance_minutes=datos.get("toleranceMinutes") or 10,
            status=datos.get("status") or EstadoRegistro.ACTIVO,
        )

    @classmethod
    def aplicar_cambios(cls, fila: Horario, datos: dict) -> None:
        if datos.get("teacherId") is not None:
            fila.teacher_id = datos["teacherId"]
        if datos.get("shiftId") is not None:
            fila.shift_id = datos["shiftId"]
        if "subjectId" in datos:
            fila.subject_id = datos["subjectId"] or None
        if "courseId" in datos:
            fila.course_id = datos["courseId"] or None
        if "dayOfWeek" in datos:
            fila.day_of_week = datos["dayOfWeek"]
        if datos.get("checkInTime") is not None:
            fila.check_in_time = datos["checkInTime"]
        if datos.get("checkOutTime") is not None:
            fila.check_out_time = datos["checkOutTime"]
        if datos.get("toleranceMinutes") is not None:
            fila.tolerance_minutes = datos["toleranceMinutes"]
        if datos.get("status") is not None:
            fila.status = datos["status"]

    @classmethod
    def liberar_claves_unicas(cls, fila: Horario) -> None:
        """Los horarios no tienen columnas únicas que liberar."""

    @classmethod
    def _etiqueta(cls, fila: Horario) -> str:
        return (
            f"de {fila.docente.first_name} {fila.docente.last_name} "
            f"({fila.jornada.name}, {etiqueta_dia(fila.day_of_week)} "
            f"{fila.check_in_time}–{fila.check_out_time})"
        )

    # ── Validaciones ─────────────────────────────────────────────────

    @classmethod
    def _referencias(cls, docente_id: str, jornada_id: str) -> None:
        docente = bd.session.execute(
            select(Docente.id).where(Docente.id == docente_id, Docente.deleted_at.is_(None))
        ).scalar_one_or_none()
        if docente is None:
            raise SolicitudInvalida("El docente seleccionado no existe")

        jornada = bd.session.execute(
            select(Jornada.id).where(
                Jornada.id == jornada_id,
                Jornada.deleted_at.is_(None),
                Jornada.status == EstadoRegistro.ACTIVO,
            )
        ).scalar_one_or_none()
        if jornada is None:
            raise SolicitudInvalida("La jornada seleccionada no existe o está inactiva")

    @classmethod
    def _asignatura_del_docente(cls, docente_id: str, asignatura_id: str | None) -> None:
        """
        La asignatura del horario debe estar entre las que dicta el docente.

        Evita franjas que declaren una materia que ese docente no imparte.
        """
        if not asignatura_id:
            return

        asignatura = bd.session.execute(
            select(Asignatura).where(
                Asignatura.id == asignatura_id, Asignatura.deleted_at.is_(None)
            )
        ).scalar_one_or_none()
        if asignatura is None:
            raise SolicitudInvalida("La asignatura seleccionada no existe")
        if asignatura.status != EstadoRegistro.ACTIVO:
            raise SolicitudInvalida(f"La asignatura {asignatura.name} está inactiva")

        vinculo = bd.session.execute(
            select(DocenteAsignatura).where(
                DocenteAsignatura.teacher_id == docente_id,
                DocenteAsignatura.subject_id == asignatura_id,
            )
        ).scalar_one_or_none()
        if vinculo is None:
            raise SolicitudInvalida(
                f"El docente no dicta la asignatura {asignatura.name}. "
                "Asígnesela primero en su ficha."
            )

    @classmethod
    def _curso_del_docente(cls, docente_id: str, curso_id: str | None) -> None:
        """
        El curso del horario debe estar entre los que atiende el docente.

        Misma idea que con la asignatura: la franja no puede declarar un grupo
        al que ese docente no entra.
        """
        if not curso_id:
            return

        curso = bd.session.execute(
            select(Curso).where(Curso.id == curso_id, Curso.deleted_at.is_(None))
        ).scalar_one_or_none()
        if curso is None:
            raise SolicitudInvalida("El curso seleccionado no existe")
        if curso.status != EstadoRegistro.ACTIVO:
            raise SolicitudInvalida(f"El curso {curso.name} está inactivo")

        vinculo = bd.session.execute(
            select(DocenteCurso).where(
                DocenteCurso.teacher_id == docente_id,
                DocenteCurso.course_id == curso_id,
            )
        ).scalar_one_or_none()
        if vinculo is None:
            raise SolicitudInvalida(
                f"El docente no atiende el curso {curso.name}. "
                "Asígneselo primero en su ficha."
            )

    @classmethod
    def _rango_valido(cls, entrada: str, salida: str) -> None:
        if hora_a_minutos(salida) <= hora_a_minutos(entrada):
            raise SolicitudInvalida("La hora de salida debe ser posterior a la hora de entrada")

    @classmethod
    def _sin_cruces(
        cls,
        docente_id: str,
        dia: int | None,
        entrada: str,
        salida: str,
        excluir: str | None = None,
    ) -> None:
        """Un docente no puede tener dos horarios que se crucen el mismo día."""
        consulta = select(Horario).where(
            Horario.teacher_id == docente_id,
            Horario.deleted_at.is_(None),
            Horario.status == EstadoRegistro.ACTIVO,
        )
        # Un horario sin día aplica a todos, así que siempre entra a comparar
        if dia is not None:
            consulta = consulta.where(
                (Horario.day_of_week == dia) | (Horario.day_of_week.is_(None))
            )
        if excluir:
            consulta = consulta.where(Horario.id != excluir)

        inicio, fin = hora_a_minutos(entrada), hora_a_minutos(salida)

        for otro in bd.session.execute(consulta).scalars():
            otro_inicio = hora_a_minutos(otro.check_in_time)
            otro_fin = hora_a_minutos(otro.check_out_time)
            if inicio < otro_fin and otro_inicio < fin:
                raise Conflicto(
                    f"El docente ya tiene un horario que se cruza ({otro.jornada.name}, "
                    f"{etiqueta_dia(otro.day_of_week)} "
                    f"{otro.check_in_time}–{otro.check_out_time})"
                )

    @classmethod
    def gancho_antes_de_crear(cls, datos: dict) -> None:
        cls._referencias(datos["teacherId"], datos["shiftId"])
        cls._asignatura_del_docente(datos["teacherId"], datos.get("subjectId"))
        cls._curso_del_docente(datos["teacherId"], datos.get("courseId"))
        cls._rango_valido(datos["checkInTime"], datos["checkOutTime"])
        cls._sin_cruces(
            datos["teacherId"],
            datos.get("dayOfWeek"),
            datos["checkInTime"],
            datos["checkOutTime"],
        )

    @classmethod
    def gancho_antes_de_actualizar(cls, fila: Horario, datos: dict) -> None:
        # Los campos ausentes conservan su valor actual
        docente_id = datos.get("teacherId") or fila.teacher_id
        jornada_id = datos.get("shiftId") or fila.shift_id
        dia = datos["dayOfWeek"] if "dayOfWeek" in datos else fila.day_of_week
        entrada = datos.get("checkInTime") or fila.check_in_time
        salida = datos.get("checkOutTime") or fila.check_out_time
        asignatura_id = datos["subjectId"] if "subjectId" in datos else fila.subject_id
        curso_id = datos["courseId"] if "courseId" in datos else fila.course_id

        cls._referencias(docente_id, jornada_id)
        cls._asignatura_del_docente(docente_id, asignatura_id)
        cls._curso_del_docente(docente_id, curso_id)
        cls._rango_valido(entrada, salida)
        cls._sin_cruces(docente_id, dia, entrada, salida, excluir=fila.id)
