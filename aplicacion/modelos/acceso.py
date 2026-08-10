"""
Modelos de acceso: usuarios, sesiones, roles y permisos.

Traducción de los modelos `User`, `RefreshToken`, `Role`, `Permission` y
`RolePermission` del esquema Prisma. Se mapean contra las tablas que ya
existen: no se crea ni se altera ninguna estructura.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensiones import bd
from .base import BorradoLogico, ConEstado, MarcasTiempo, columna_uuid, nuevo_id


class Rol(bd.Model, MarcasTiempo, BorradoLogico, ConEstado):
    """Perfiles de acceso. Los del sistema no pueden eliminarse."""

    __tablename__ = "roles"

    id: Mapped[str] = columna_uuid(primary_key=True, default=nuevo_id)
    name: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(300))
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="rol")
    permisos: Mapped[list["RolPermiso"]] = relationship(
        back_populates="rol", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("roles_status_deleted_at_idx", "status", "deleted_at"),)

    @property
    def es_super_admin(self) -> bool:
        return self.name == "SUPER_ADMIN"


class Permiso(bd.Model, MarcasTiempo, BorradoLogico, ConEstado):
    """Catálogo de capacidades granulares con formato `modulo.accion`."""

    __tablename__ = "permissions"

    id: Mapped[str] = columna_uuid(primary_key=True, default=nuevo_id)
    code: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    module: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str | None] = mapped_column(String(300))
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    roles: Mapped[list["RolPermiso"]] = relationship(
        back_populates="permiso", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("permissions_module_idx", "module"),
        Index("permissions_status_deleted_at_idx", "status", "deleted_at"),
    )


class RolPermiso(bd.Model):
    """Tabla puente entre roles y permisos."""

    __tablename__ = "role_permissions"

    role_id: Mapped[str] = columna_uuid(
        ForeignKey("roles.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True
    )
    permission_id: Mapped[str] = columna_uuid(
        ForeignKey("permissions.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    rol: Mapped[Rol] = relationship(back_populates="permisos")
    permiso: Mapped[Permiso] = relationship(back_populates="roles")


class Usuario(bd.Model, MarcasTiempo, BorradoLogico, ConEstado):
    """Cuentas de acceso al sistema."""

    __tablename__ = "users"

    id: Mapped[str] = columna_uuid(primary_key=True, default=nuevo_id)
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    document: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(180), unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))

    # Hash bcrypt. Nunca se almacena la contraseña en claro.
    password: Mapped[str] = mapped_column(String(255), nullable=False)

    role_id: Mapped[str] = columna_uuid(
        ForeignKey("roles.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False
    )
    rol: Mapped[Rol] = relationship(back_populates="usuarios", lazy="joined")

    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failed_login_attempts: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    docente: Mapped["Docente | None"] = relationship(back_populates="usuario", uselist=False)
    sesiones: Mapped[list["SesionRefresco"]] = relationship(
        back_populates="usuario", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("users_status_deleted_at_idx", "status", "deleted_at"),
        Index("users_role_id_idx", "role_id"),
        Index("users_email_idx", "email"),
    )

    @property
    def nombre_completo(self) -> str:
        return f"{self.first_name} {self.last_name}"


class SesionRefresco(bd.Model):
    """Tokens de renovación de sesión, guardados hasheados y con rotación."""

    __tablename__ = "refresh_tokens"

    id: Mapped[str] = columna_uuid(primary_key=True, default=nuevo_id)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[str] = columna_uuid(
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip_address: Mapped[str | None] = mapped_column(String(60))
    user_agent: Mapped[str | None] = mapped_column(String(400))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    usuario: Mapped[Usuario] = relationship(back_populates="sesiones")

    __table_args__ = (
        Index("refresh_tokens_user_id_revoked_at_idx", "user_id", "revoked_at"),
        Index("refresh_tokens_expires_at_idx", "expires_at"),
    )
