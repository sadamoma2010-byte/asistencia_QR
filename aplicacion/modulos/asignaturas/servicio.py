"""
Servicio de asignaturas.

Traducción de `modules/subjects/subjects.service.ts`.
"""

from __future__ import annotations

import time

from flask import request
from sqlalchemy import delete, func, select

from ...comun import auditoria, codigos
from ...comun.consultas import Paginacion
from ...comun.crud import ServicioCRUD
from ...comun.errores import SolicitudInvalida
from ...comun.peticion import ContextoPeticion
from ...comun.seguridad import UsuarioAutenticado
from ...extensiones import bd
from ...modelos import (
    AccionAuditoria,
    Asignatura,
    Docente,
    DocenteAsignatura,
    EstadoRegistro,
    Horario,
    nuevo_id,
)


def _contar_horarios(asignatura_id: str, solo_activos: bool = False) -> int:
    consulta = select(func.count()).select_from(Horario).where(
        Horario.subject_id == asignatura_id, Horario.deleted_at.is_(None)
    )
    if solo_activos:
        consulta = consulta.where(Horario.status == EstadoRegistro.ACTIVO)
    return bd.session.execute(consulta).scalar_one()


def _contar_docentes(asignatura_id: str) -> int:
    return bd.session.execute(
        select(func.count())
        .select_from(DocenteAsignatura)
        .where(DocenteAsignatura.subject_id == asignatura_id)
    ).scalar_one()


class ServicioAsignaturas(ServicioCRUD):
    modelo = Asignatura
    modulo = "Asignaturas"
    articulo = "la"
    sustantivo = "asignatura"
    campo_etiqueta = "code"
    orden_defecto = "name"
    tope_exportacion = 5000

    ordenables = {
        "createdAt": Asignatura.created_at,
        "code": Asignatura.code,
        "name": Asignatura.name,
        "weeklyHours": Asignatura.weekly_hours,
        "status": Asignatura.status,
    }
    buscables = (Asignatura.code, Asignatura.name, Asignatura.description)

    # ── Consultas ────────────────────────────────────────────────────

    @classmethod
    def aplicar_filtros(cls, consulta, paginacion: Paginacion):
        consulta = super().aplicar_filtros(consulta, paginacion)

        # Filtro por docente: solo las asignaturas que dicta
        docente_id = request.args.get("teacherId")
        if docente_id:
            consulta = consulta.where(
                Asignatura.id.in_(
                    select(DocenteAsignatura.subject_id).where(
                        DocenteAsignatura.teacher_id == docente_id
                    )
                )
            )
        return consulta

    @classmethod
    def serializar(cls, fila: Asignatura) -> dict:
        return {
            **cls.campos_comunes(fila),
            "code": fila.code,
            "name": fila.name,
            "description": fila.description,
            "weeklyHours": fila.weekly_hours,
            "color": fila.color,
            # Los contadores excluyen lo eliminado: si no, la interfaz mostraría
            # horarios que en realidad ya no existen.
            "_count": {
                "teachers": _contar_docentes(fila.id),
                "schedules": _contar_horarios(fila.id),
            },
        }

    @classmethod
    def obtener(cls, identificador: str) -> dict:
        """El detalle incluye además los docentes que la dictan."""
        fila = cls.buscar(identificador)
        # Se ordena por la fecha del vínculo, que es el orden en que los
        # devolvía el sistema original y además es determinista.
        docentes = bd.session.execute(
            select(Docente)
            .join(DocenteAsignatura, DocenteAsignatura.teacher_id == Docente.id)
            .where(DocenteAsignatura.subject_id == identificador)
            .order_by(DocenteAsignatura.created_at.asc())
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
        """
        Catálogo para desplegables.

        Con `teacherId` devuelve solo las asignaturas que dicta ese docente,
        que es lo que necesita el formulario de horarios.
        """
        consulta = select(Asignatura).where(
            Asignatura.deleted_at.is_(None), Asignatura.status == EstadoRegistro.ACTIVO
        )
        docente_id = request.args.get("teacherId")
        if docente_id:
            consulta = consulta.where(
                Asignatura.id.in_(
                    select(DocenteAsignatura.subject_id).where(
                        DocenteAsignatura.teacher_id == docente_id
                    )
                )
            )

        filas = bd.session.execute(consulta.order_by(Asignatura.name.asc())).scalars()
        return [
            {"id": f.id, "code": f.code, "name": f.name, "color": f.color} for f in filas
        ]

    @classmethod
    def sugerir_codigo(cls) -> dict:
        """Siguiente código disponible con el formato ASG-000."""
        return {"code": codigos.siguiente(Asignatura.code, "ASG-", 3)}

    # ── Mutaciones ───────────────────────────────────────────────────

    @classmethod
    def construir(cls, datos: dict) -> Asignatura:
        return Asignatura(
            id=nuevo_id(),
            code=datos["code"],
            name=datos["name"],
            description=datos.get("description") or None,
            weekly_hours=datos.get("weeklyHours"),
            color=datos.get("color") or "#4F46E5",
            status=datos.get("status") or EstadoRegistro.ACTIVO,
        )

    @classmethod
    def aplicar_cambios(cls, fila: Asignatura, datos: dict) -> None:
        if datos.get("code") is not None:
            fila.code = datos["code"]
        if datos.get("name") is not None:
            fila.name = datos["name"]
        if "description" in datos:
            fila.description = datos["description"] or None
        if "weeklyHours" in datos:
            fila.weekly_hours = datos["weeklyHours"]
        if datos.get("color") is not None:
            fila.color = datos["color"]
        if datos.get("status") is not None:
            fila.status = datos["status"]

    @classmethod
    def liberar_claves_unicas(cls, fila: Asignatura) -> None:
        fila.code = f"{fila.code}.DEL.{int(time.time() * 1000)}"[:40]

    @classmethod
    def _etiqueta(cls, fila: Asignatura) -> str:
        return f"{fila.code} — {fila.name}"

    # ── Reglas propias ───────────────────────────────────────────────

    @classmethod
    def gancho_antes_de_crear(cls, datos: dict) -> None:
        cls.exige_unico(
            Asignatura.code, datos["code"], "Ya existe una asignatura con ese código"
        )

    @classmethod
    def gancho_antes_de_actualizar(cls, fila: Asignatura, datos: dict) -> None:
        codigo = datos.get("code")
        if codigo and codigo != fila.code:
            cls.exige_unico(
                Asignatura.code,
                codigo,
                "Ya existe una asignatura con ese código",
                excluir=fila.id,
            )

    @classmethod
    def gancho_impide_inactivar(cls, fila: Asignatura) -> str | None:
        activos = _contar_horarios(fila.id, solo_activos=True)
        if activos:
            return f"No es posible inactivar la asignatura: tiene {activos} horario(s) activo(s)"
        return None

    @classmethod
    def gancho_impide_eliminar(cls, fila: Asignatura) -> str | None:
        asociados = _contar_horarios(fila.id)
        if asociados:
            return (
                f"No es posible eliminar la asignatura: tiene {asociados} horario(s) asociado(s)"
            )
        return None

    @classmethod
    def gancho_antes_de_eliminar(cls, fila: Asignatura) -> None:
        # Los vínculos con los docentes no sobreviven a la asignatura
        bd.session.execute(
            delete(DocenteAsignatura).where(DocenteAsignatura.subject_id == fila.id)
        )

    # ── Docentes que la dictan ───────────────────────────────────────

    @classmethod
    def asignar_docentes(
        cls,
        identificador: str,
        docentes_ids: list[str],
        actor: UsuarioAutenticado,
        ctx: ContextoPeticion,
    ) -> dict:
        """Reemplaza el listado de docentes que dictan la asignatura."""
        asignatura = cls.buscar(identificador)

        validos = bd.session.execute(
            select(func.count())
            .select_from(Docente)
            .where(Docente.id.in_(docentes_ids), Docente.deleted_at.is_(None))
        ).scalar_one()
        if validos != len(set(docentes_ids)):
            raise SolicitudInvalida("Uno o más docentes seleccionados no existen")

        # Un horario no puede quedar apuntando a una asignatura que su docente
        # ya no dicta. Sin docentes en la lista, todos los horarios quedarían
        # huérfanos, así que no se filtra por identificador.
        consulta_huerfanos = select(func.count()).select_from(Horario).where(
            Horario.subject_id == identificador, Horario.deleted_at.is_(None)
        )
        if docentes_ids:
            consulta_huerfanos = consulta_huerfanos.where(
                Horario.teacher_id.notin_(docentes_ids)
            )
        huerfanos = bd.session.execute(consulta_huerfanos).scalar_one()
        if huerfanos:
            raise SolicitudInvalida(
                f"No es posible retirar esos docentes: {huerfanos} horario(s) siguen usando "
                "esta asignatura"
            )

        bd.session.execute(
            delete(DocenteAsignatura).where(DocenteAsignatura.subject_id == identificador)
        )
        from datetime import datetime, timezone

        for docente_id in dict.fromkeys(docentes_ids):
            bd.session.add(
                DocenteAsignatura(
                    teacher_id=docente_id,
                    subject_id=identificador,
                    created_at=datetime.now(timezone.utc),
                )
            )

        auditoria.anotar(
            AccionAuditoria.ACTUALIZAR,
            cls.modulo,
            f"Asignó {len(docentes_ids)} docente(s) a la asignatura {asignatura.code}",
            entidad_id=identificador,
            detalle={"teacherIds": docentes_ids},
            usuario=actor,
            ctx=ctx,
        )
        bd.session.commit()
        return cls.obtener(identificador)
