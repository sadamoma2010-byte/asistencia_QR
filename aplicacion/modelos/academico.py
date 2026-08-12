"""
Modelos académicos: docentes, asignaturas, jornadas y horarios.

Traducción de `Teacher`, `Subject`, `TeacherSubject`, `Shift` y `Schedule`.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
    SmallInteger,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensiones import bd
from .base import BorradoLogico, ConEstado, MarcasTiempo, columna_uuid, enum_sql, nuevo_id
from .enumeraciones import NivelEducativo


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

    # Ruta pública desde la que se sirve la fotografía
    photo_url: Mapped[str | None] = mapped_column(String(300))

    # La imagen vive en la base, no en el disco: así viaja con el respaldo y
    # no quedan archivos huérfanos cuando se elimina un docente. Se guarda
    # normalizada a WEBP de 512×512, unos 10 KB por docente.
    #
    # `deferred` evita traerla en los listados: sin esto, cada consulta de
    # docentes arrastraría todas las imágenes sin necesitarlas.
    photo: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    photo_mime: Mapped[str | None] = mapped_column(String(40))

    # Cuenta con la que el docente entra a marcar su asistencia
    user_id: Mapped[str | None] = columna_uuid(
        ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"), unique=True
    )
    usuario: Mapped["Usuario | None"] = relationship(back_populates="docente", lazy="joined")

    asignaturas: Mapped[list["DocenteAsignatura"]] = relationship(
        back_populates="docente", cascade="all, delete-orphan"
    )
    cursos: Mapped[list["DocenteCurso"]] = relationship(
        back_populates="docente", cascade="all, delete-orphan"
    )
    # Cursos de los que es director de grupo
    cursos_dirigidos: Mapped[list["Curso"]] = relationship(
        back_populates="director", foreign_keys="Curso.homeroom_teacher_id"
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


class Grado(bd.Model, MarcasTiempo, BorradoLogico, ConEstado):
    """
    Grados del servicio educativo formal, según la Ley 115 de 1994.

    La escalera la fija la ley, no la institución: los catorce grados vienen
    cargados y marcados como del sistema. Lo que cada colegio decide es cuáles
    ofrece —activándolos o inactivándolos— y qué cursos abre en cada uno.
    """

    __tablename__ = "grades"

    id: Mapped[str] = columna_uuid(primary_key=True, default=nuevo_id)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    level: Mapped[NivelEducativo] = enum_sql(
        NivelEducativo, "education_level", nullable=False
    )
    # Lugar en la escalera educativa: 1 = prejardín … 14 = once
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    description: Mapped[str | None] = mapped_column(String(300))
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    cursos: Mapped[list["Curso"]] = relationship(back_populates="grado")

    __table_args__ = (
        Index("grades_level_position_idx", "level", "position"),
        Index("grades_status_deleted_at_idx", "status", "deleted_at"),
    )


class Curso(bd.Model, MarcasTiempo, BorradoLogico, ConEstado):
    """Curso o grupo de un grado: 6A, 6B, 6C."""

    __tablename__ = "courses"

    id: Mapped[str] = columna_uuid(primary_key=True, default=nuevo_id)

    grade_id: Mapped[str] = columna_uuid(
        ForeignKey("grades.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False
    )
    grado: Mapped[Grado] = relationship(back_populates="cursos", lazy="joined")

    # Letra o denominación del grupo dentro del grado
    letter: Mapped[str] = mapped_column(String(10), nullable=False)
    # Nombre ya compuesto («6A»), guardado resuelto para buscar y ordenar
    name: Mapped[str] = mapped_column(String(80), nullable=False)

    shift_id: Mapped[str | None] = columna_uuid(
        ForeignKey("shifts.id", ondelete="SET NULL", onupdate="CASCADE")
    )
    jornada: Mapped["Jornada | None"] = relationship(back_populates="cursos", lazy="joined")

    # Director de grupo
    homeroom_teacher_id: Mapped[str | None] = columna_uuid(
        ForeignKey("teachers.id", ondelete="SET NULL", onupdate="CASCADE")
    )
    director: Mapped["Docente | None"] = relationship(
        back_populates="cursos_dirigidos", lazy="joined", foreign_keys=[homeroom_teacher_id]
    )

    capacity: Mapped[int | None] = mapped_column(SmallInteger)

    docentes: Mapped[list["DocenteCurso"]] = relationship(
        back_populates="curso", cascade="all, delete-orphan"
    )
    horarios: Mapped[list["Horario"]] = relationship(back_populates="curso")

    __table_args__ = (
        Index("courses_grade_id_idx", "grade_id"),
        Index("courses_shift_id_idx", "shift_id"),
        Index("courses_homeroom_teacher_id_idx", "homeroom_teacher_id"),
        Index("courses_status_deleted_at_idx", "status", "deleted_at"),
    )


class DocenteCurso(bd.Model):
    """Cursos que atiende cada docente (relación muchos a muchos)."""

    __tablename__ = "teacher_courses"

    teacher_id: Mapped[str] = columna_uuid(
        ForeignKey("teachers.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True
    )
    course_id: Mapped[str] = columna_uuid(
        ForeignKey("courses.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    docente: Mapped["Docente"] = relationship(back_populates="cursos")
    curso: Mapped[Curso] = relationship(back_populates="docentes")


class Jornada(bd.Model, MarcasTiempo, BorradoLogico, ConEstado):
    """Franjas institucionales sobre las que se arman los horarios."""

    __tablename__ = "shifts"

    id: Mapped[str] = columna_uuid(primary_key=True, default=nuevo_id)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(300))

    horarios: Mapped[list["Horario"]] = relationship(back_populates="jornada")
    cursos: Mapped[list["Curso"]] = relationship(back_populates="jornada")

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

    # Curso al que se dicta esa franja
    course_id: Mapped[str | None] = columna_uuid(
        ForeignKey("courses.id", ondelete="SET NULL", onupdate="CASCADE")
    )
    curso: Mapped[Curso | None] = relationship(back_populates="horarios", lazy="joined")

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
        Index("schedules_course_id_idx", "course_id"),
    )
