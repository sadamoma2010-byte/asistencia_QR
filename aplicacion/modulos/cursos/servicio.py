"""
Servicio de cursos.

Un curso es un grupo dentro de un grado: 6A, 6B, 6C. La institución abre los
que necesite según su matrícula.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

from flask import request
from sqlalchemy import delete, func, select

from ...comun import auditoria
from ...comun.consultas import Paginacion
from ...comun.crud import ServicioCRUD
from ...comun.errores import Conflicto, SolicitudInvalida
from ...comun.peticion import ContextoPeticion
from ...comun.seguridad import UsuarioAutenticado
from ...extensiones import bd
from ...modelos import (
    ETIQUETA_NIVEL_EDUCATIVO,
    AccionAuditoria,
    Curso,
    Docente,
    DocenteCurso,
    EstadoRegistro,
    Grado,
    Horario,
    Jornada,
    nuevo_id,
)


def _contar_docentes(curso_id: str) -> int:
    return bd.session.execute(
        select(func.count()).select_from(DocenteCurso).where(DocenteCurso.course_id == curso_id)
    ).scalar_one()


def _contar_horarios(curso_id: str) -> int:
    return bd.session.execute(
        select(func.count())
        .select_from(Horario)
        .where(Horario.course_id == curso_id, Horario.deleted_at.is_(None))
    ).scalar_one()


def _nombre_curso(grado: Grado, letra: str) -> str:
    """Nombre compuesto del curso: el código del grado y su letra, «6A»."""
    return f"{grado.code}{letra.upper()}"


class ServicioCursos(ServicioCRUD):
    modelo = Curso
    modulo = "Cursos"
    articulo = "el"
    sustantivo = "curso"
    campo_etiqueta = "name"
    orden_defecto = "name"

    ordenables = {
        "createdAt": Curso.created_at,
        "name": Curso.name,
        "letter": Curso.letter,
        "capacity": Curso.capacity,
        "status": Curso.status,
        "grade.position": Grado.position,
    }
    buscables = (Curso.name, Curso.letter, Grado.name, Grado.code)

    # ── Consultas ────────────────────────────────────────────────────

    @classmethod
    def consulta_base(cls):
        # Unión con el grado: se busca y se ordena por él
        return (
            select(Curso)
            .join(Grado, Grado.id == Curso.grade_id)
            .where(Curso.deleted_at.is_(None))
        )

    @classmethod
    def aplicar_filtros(cls, consulta, paginacion: Paginacion):
        consulta = super().aplicar_filtros(consulta, paginacion)

        grado_id = request.args.get("gradeId")
        if grado_id:
            consulta = consulta.where(Curso.grade_id == grado_id)

        jornada_id = request.args.get("shiftId")
        if jornada_id:
            consulta = consulta.where(Curso.shift_id == jornada_id)

        nivel = request.args.get("level")
        if nivel:
            consulta = consulta.where(Grado.level == nivel)

        docente_id = request.args.get("teacherId")
        if docente_id:
            consulta = consulta.where(
                Curso.id.in_(
                    select(DocenteCurso.course_id).where(DocenteCurso.teacher_id == docente_id)
                )
            )
        return consulta

    @classmethod
    def serializar(cls, fila: Curso) -> dict:
        grado, jornada, director = fila.grado, fila.jornada, fila.director
        return {
            **cls.campos_comunes(fila),
            "gradeId": fila.grade_id,
            "letter": fila.letter,
            "name": fila.name,
            "shiftId": fila.shift_id,
            "homeroomTeacherId": fila.homeroom_teacher_id,
            "capacity": fila.capacity,
            "grade": {
                "id": grado.id,
                "code": grado.code,
                "name": grado.name,
                "level": grado.level.value,
                "levelName": ETIQUETA_NIVEL_EDUCATIVO.get(grado.level.value, grado.level.value),
                "position": grado.position,
            },
            "shift": {"id": jornada.id, "name": jornada.name} if jornada else None,
            "homeroomTeacher": (
                {
                    "id": director.id,
                    "code": director.code,
                    "firstName": director.first_name,
                    "lastName": director.last_name,
                }
                if director
                else None
            ),
            "_count": {
                "teachers": _contar_docentes(fila.id),
                "schedules": _contar_horarios(fila.id),
            },
        }

    @classmethod
    def obtener(cls, identificador: str) -> dict:
        """El detalle incluye los docentes que atienden el curso."""
        fila = cls.buscar(identificador)
        docentes = bd.session.execute(
            select(Docente)
            .join(DocenteCurso, DocenteCurso.teacher_id == Docente.id)
            .where(DocenteCurso.course_id == identificador)
            .order_by(DocenteCurso.created_at.asc())
        ).scalars()

        return {
            **cls.serializar(fila),
            "teachers": [
                {
                    "id": d.id,
                    "code": d.code,
                    "firstName": d.first_name,
                    "lastName": d.last_name,
                    "status": d.status.value,
                }
                for d in docentes
            ],
        }

    @classmethod
    def opciones(cls) -> list[dict]:
        """Cursos activos, ordenados por la escalera educativa."""
        consulta = (
            select(Curso)
            .join(Grado, Grado.id == Curso.grade_id)
            .where(Curso.deleted_at.is_(None), Curso.status == EstadoRegistro.ACTIVO)
            .order_by(Grado.position.asc(), Curso.letter.asc())
        )

        docente_id = request.args.get("teacherId")
        if docente_id:
            consulta = consulta.where(
                Curso.id.in_(
                    select(DocenteCurso.course_id).where(DocenteCurso.teacher_id == docente_id)
                )
            )

        filas = bd.session.execute(consulta).scalars().unique()
        return [
            {
                "id": f.id,
                "name": f.name,
                "code": f.name,
                "description": f"{f.grado.name} · {f.jornada.name if f.jornada else 'Sin jornada'}",
            }
            for f in filas
        ]

    # ── Mutaciones ───────────────────────────────────────────────────

    @classmethod
    def _grado(cls, grado_id: str) -> Grado:
        grado = bd.session.execute(
            select(Grado).where(Grado.id == grado_id, Grado.deleted_at.is_(None))
        ).scalar_one_or_none()
        if grado is None:
            raise SolicitudInvalida("El grado seleccionado no existe")
        if grado.status != EstadoRegistro.ACTIVO:
            raise SolicitudInvalida(
                f"El grado {grado.name} está inactivo: actívelo antes de abrirle cursos"
            )
        return grado

    @classmethod
    def construir(cls, datos: dict) -> Curso:
        grado = cls._grado(datos["gradeId"])
        letra = datos["letter"].upper()

        return Curso(
            id=nuevo_id(),
            grade_id=grado.id,
            letter=letra,
            name=_nombre_curso(grado, letra),
            shift_id=datos.get("shiftId") or None,
            homeroom_teacher_id=datos.get("homeroomTeacherId") or None,
            capacity=datos.get("capacity"),
            status=datos.get("status") or EstadoRegistro.ACTIVO,
        )

    @classmethod
    def gancho_despues_de_crear(cls, fila: Curso, datos: dict) -> None:
        for docente_id in dict.fromkeys(datos.get("teacherIds") or []):
            bd.session.add(
                DocenteCurso(
                    teacher_id=docente_id,
                    course_id=fila.id,
                    created_at=datetime.now(timezone.utc),
                )
            )

    @classmethod
    def aplicar_cambios(cls, fila: Curso, datos: dict) -> None:
        if datos.get("gradeId") is not None:
            fila.grade_id = cls._grado(datos["gradeId"]).id
        if datos.get("letter") is not None:
            fila.letter = datos["letter"].upper()
        if "shiftId" in datos:
            fila.shift_id = datos["shiftId"] or None
        if "homeroomTeacherId" in datos:
            fila.homeroom_teacher_id = datos["homeroomTeacherId"] or None
        if "capacity" in datos:
            fila.capacity = datos["capacity"]
        if datos.get("status") is not None:
            fila.status = datos["status"]

        # El nombre se recompone siempre: depende del grado y de la letra
        grado = bd.session.execute(
            select(Grado).where(Grado.id == fila.grade_id)
        ).scalar_one()
        fila.name = _nombre_curso(grado, fila.letter)

    @classmethod
    def liberar_claves_unicas(cls, fila: Curso) -> None:
        # La letra es única dentro del grado mientras el curso esté vigente.
        # Al darlo de baja se libera para poder reabrir ese grupo.
        marca = int(time.time() * 1000)
        fila.letter = f"{fila.letter}.{marca}"[:10]
        fila.name = f"{fila.name} (eliminado)"[:80]

    # ── Reglas propias ───────────────────────────────────────────────

    @classmethod
    def _letra_libre(cls, grado_id: str, letra: str, excluir: str | None = None) -> None:
        consulta = select(Curso.id).where(
            Curso.grade_id == grado_id,
            Curso.letter == letra.upper(),
            Curso.deleted_at.is_(None),
        )
        if excluir:
            consulta = consulta.where(Curso.id != excluir)
        if bd.session.execute(consulta.limit(1)).scalar_one_or_none():
            raise Conflicto(f"Ese grado ya tiene un curso {letra.upper()}")

    @classmethod
    def gancho_antes_de_crear(cls, datos: dict) -> None:
        cls._letra_libre(datos["gradeId"], datos["letter"])

    @classmethod
    def gancho_antes_de_actualizar(cls, fila: Curso, datos: dict) -> None:
        grado_id = datos.get("gradeId") or fila.grade_id
        letra = (datos.get("letter") or fila.letter).upper()
        if grado_id != fila.grade_id or letra != fila.letter:
            cls._letra_libre(grado_id, letra, excluir=fila.id)

    @classmethod
    def gancho_impide_eliminar(cls, fila: Curso) -> str | None:
        horarios = _contar_horarios(fila.id)
        if horarios:
            return f"No es posible eliminar el curso: tiene {horarios} horario(s) asociado(s)"
        return None

    @classmethod
    def gancho_antes_de_eliminar(cls, fila: Curso) -> None:
        bd.session.execute(delete(DocenteCurso).where(DocenteCurso.course_id == fila.id))

    # ── Docentes del curso ───────────────────────────────────────────

    @classmethod
    def asignar_docentes(
        cls,
        identificador: str,
        docentes_ids: list[str],
        actor: UsuarioAutenticado,
        ctx: ContextoPeticion,
    ) -> dict:
        """Reemplaza el listado de docentes que atienden el curso."""
        curso = cls.buscar(identificador)

        validos = bd.session.execute(
            select(func.count())
            .select_from(Docente)
            .where(Docente.id.in_(docentes_ids), Docente.deleted_at.is_(None))
        ).scalar_one()
        if validos != len(set(docentes_ids)):
            raise SolicitudInvalida("Uno o más docentes seleccionados no existen")

        bd.session.execute(
            delete(DocenteCurso).where(DocenteCurso.course_id == identificador)
        )
        for docente_id in dict.fromkeys(docentes_ids):
            bd.session.add(
                DocenteCurso(
                    teacher_id=docente_id,
                    course_id=identificador,
                    created_at=datetime.now(timezone.utc),
                )
            )

        auditoria.anotar(
            AccionAuditoria.ACTUALIZAR,
            cls.modulo,
            f"Asignó {len(docentes_ids)} docente(s) al curso {curso.name}",
            entidad_id=identificador,
            detalle={"teacherIds": docentes_ids},
            usuario=actor,
            ctx=ctx,
        )
        bd.session.commit()
        return cls.obtener(identificador)
