"""
Modelos académicos: docentes, asignaturas, jornadas y horarios.

Traducción de `Teacher`, `Subject`, `TeacherSubject`, `Shift` y `Schedule`.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensiones import bd
from .base import BorradoLogico, ConEstado, MarcasTiempo, columna_uuid, nuevo_id


class Asignatura(bd.Model, MarcasTiempo, BorradoLogico, ConEstado):
    """Materias que se imparten en la institución."""

    __tablename__ = "subjects"

    id: Mapped[str] = columna_uuid(primary_key=True, default=nuevo_id)
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(300))

    # Intensidad horaria semanal
    weekly_hours: Mapped[int | None] = mapped_column(SmallInteger)

    # Color hexadecimal de identificación en la interfaz
    color: Mapped[str | None] = mapped_column(String(7), default="#4F46E5")

    docentes: Mapped[list["DocenteAsignatura"]] = relationship(
        back_populates="asignatura", cascade="all, delete-orphan"
    )
    horarios: Mapped[list["Horario"]] = relationship(back_populates="asignatura")

    __table_args__ = (
        Index("subjects_status_deleted_at_idx", "status", "deleted_at"),
        Index("subjects_code_idx", "code"),
    )


class Docente(bd.Model, MarcasTiempo, BorradoLogico, ConEstado):
    """Personal docente sujeto al control de asistencia."""

    __tablename__ = "teachers"

    id: Mapped[str] = columna_uuid(primary_key=True, default=nuevo_id)
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    document: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))

    # Ruta pública de la fotografía, servida desde /uploads
    photo_url: Mapped[str | None] = mapped_column(String(300))

    # Cuenta con la que el docente entra a marcar su asistencia
    user_id: Mapped[str | None] = columna_uuid(
        ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"), unique=True
    )
    usuario: Mapped["Usuario | None"] = relationship(back_populates="docente", lazy="joined")

    asignaturas: Mapped[list["DocenteAsignatura"]] = relationship(
        back_populates="docente", cascade="all, delete-orphan"
    )
    horarios: Mapped[list["Horario"]] = relationship(back_populates="docente")
    marcaciones: Mapped[list["Marcacion"]] = relationship(back_populates="docente")

    __table_args__ = (
        Index("teachers_status_deleted_at_idx", "status", "deleted_at"),
        Index("teachers_code_idx", "code"),
        Index("teachers_last_name_first_name_idx", "last_name", "first_name"),
    )

    @property
    def nombre_completo(self) -> str:
        return f"{self.first_name} {self.last_name}"


class DocenteAsignatura(bd.Model):
    """Asignaturas que dicta cada docente (relación muchos a muchos)."""

    __tablename__ = "teacher_subjects"

    teacher_id: Mapped[str] = columna_uuid(
        ForeignKey("teachers.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True
    )
    subject_id: Mapped[str] = columna_uuid(
        ForeignKey("subjects.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    docente: Mapped[Docente] = relationship(back_populates="asignaturas")
    asignatura: Mapped[Asignatura] = relationship(back_populates="docentes")


class Jornada(bd.Model, MarcasTiempo, BorradoLogico, ConEstado):
    """Franjas institucionales sobre las que se arman los horarios."""

    __tablename__ = "shifts"

    id: Mapped[str] = columna_uuid(primary_key=True, default=nuevo_id)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(300))

    horarios: Mapped[list["Horario"]] = relationship(back_populates="jornada")

    __table_args__ = (Index("shifts_status_deleted_at_idx", "status", "deleted_at"),)


class Horario(bd.Model, MarcasTiempo, BorradoLogico, ConEstado):
    """Franja de trabajo de un docente: contra ella se mide la puntualidad."""

    __tablename__ = "schedules"

    id: Mapped[str] = columna_uuid(primary_key=True, default=nuevo_id)

    teacher_id: Mapped[str] = columna_uuid(
        ForeignKey("teachers.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False
    )
    docente: Mapped[Docente] = relationship(back_populates="horarios", lazy="joined")

    shift_id: Mapped[str] = columna_uuid(
        ForeignKey("shifts.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False
    )
    jornada: Mapped[Jornada] = relationship(back_populates="horarios", lazy="joined")

    # Asignatura de la franja. Debe estar entre las que dicta el docente.
    subject_id: Mapped[str | None] = columna_uuid(
        ForeignKey("subjects.id", ondelete="SET NULL", onupdate="CASCADE")
    )
    asignatura: Mapped[Asignatura | None] = relationship(back_populates="horarios", lazy="joined")

    # 0 = domingo … 6 = sábado. Nulo aplica a todos los días.
    day_of_week: Mapped[int | None] = mapped_column(SmallInteger)

    # Formato HH:MM en hora local institucional
    check_in_time: Mapped[str] = mapped_column(String(5), nullable=False)
    check_out_time: Mapped[str] = mapped_column(String(5), nullable=False)

    # Margen en minutos antes de considerar la entrada como tarde (RN007)
    tolerance_minutes: Mapped[int] = mapped_column(SmallInteger, default=10, nullable=False)

    marcaciones: Mapped[list["Marcacion"]] = relationship(back_populates="horario")

    __table_args__ = (
        Index("schedules_teacher_id_status_idx", "teacher_id", "status"),
        Index("schedules_teacher_id_day_of_week_idx", "teacher_id", "day_of_week"),
        Index("schedules_shift_id_idx", "shift_id"),
        Index("schedules_subject_id_idx", "subject_id"),
    )
