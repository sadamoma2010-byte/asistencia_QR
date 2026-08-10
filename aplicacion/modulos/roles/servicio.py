"""
Servicio de roles.

Traducción de `modules/roles/roles.service.ts`.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, func, select

from ...comun import auditoria
from ...comun.crud import ServicioCRUD
from ...comun.errores import SolicitudInvalida
from ...comun.peticion import ContextoPeticion
from ...comun.seguridad import UsuarioAutenticado
from ...comun.tiempo import iso
from ...extensiones import bd
from ...modelos import (
    AccionAuditoria,
    EstadoRegistro,
    Permiso,
    Rol,
    RolPermiso,
    Usuario,
    nuevo_id,
)


def _contar_usuarios(rol_id: str, solo_vigentes: bool = True) -> int:
    consulta = select(func.count()).select_from(Usuario).where(Usuario.role_id == rol_id)
    if solo_vigentes:
        consulta = consulta.where(Usuario.deleted_at.is_(None))
    return bd.session.execute(consulta).scalar_one()


def _contar_permisos(rol_id: str) -> int:
    return bd.session.execute(
        select(func.count()).select_from(RolPermiso).where(RolPermiso.role_id == rol_id)
    ).scalar_one()


class ServicioRoles(ServicioCRUD):
    modelo = Rol
    modulo = "Roles"
    articulo = "el"
    sustantivo = "rol"
    campo_etiqueta = "name"

    ordenables = {
        "createdAt": Rol.created_at,
        "name": Rol.name,
        "status": Rol.status,
    }
    buscables = (Rol.name, Rol.description)

    # ── Serialización ────────────────────────────────────────────────

    @classmethod
    def serializar(cls, fila: Rol) -> dict:
        return {
            **cls.campos_comunes(fila),
            "name": fila.name,
            "description": fila.description,
            "isSystem": fila.is_system,
            "_count": {
                "users": _contar_usuarios(fila.id, solo_vigentes=False),
                "permissions": _contar_permisos(fila.id),
            },
        }

    @classmethod
    def obtener(cls, identificador: str) -> dict:
        """
        El detalle incluye los permisos concedidos, completos.

        Aquí el contador solo trae los usuarios: la lista de permisos ya va
        entera, así que contarlos por separado sobraría.
        """
        fila = cls.buscar(identificador)
        permisos = list(
            bd.session.execute(
                select(Permiso)
                .join(RolPermiso, RolPermiso.permission_id == Permiso.id)
                .where(RolPermiso.role_id == identificador)
                .order_by(RolPermiso.created_at.asc())
            ).scalars()
        )

        return {
            **cls.campos_comunes(fila),
            "name": fila.name,
            "description": fila.description,
            "isSystem": fila.is_system,
            "_count": {"users": _contar_usuarios(fila.id, solo_vigentes=False)},
            "permissions": [
                {
                    "id": p.id,
                    "code": p.code,
                    "name": p.name,
                    "module": p.module,
                    "description": p.description,
                    "isSystem": p.is_system,
                    "status": p.status.value,
                    "createdAt": iso(p.created_at),
                    "updatedAt": iso(p.updated_at),
                    "deletedAt": iso(p.deleted_at),
                }
                for p in permisos
            ],
            "permissionIds": [p.id for p in permisos],
        }

    @classmethod
    def opciones(cls) -> list[dict]:
        filas = bd.session.execute(
            select(Rol)
            .where(Rol.deleted_at.is_(None), Rol.status == EstadoRegistro.ACTIVO)
            .order_by(Rol.name.asc())
        ).scalars()
        return [{"id": f.id, "name": f.name, "description": f.description} for f in filas]

    # ── Mutaciones ───────────────────────────────────────────────────

    @classmethod
    def construir(cls, datos: dict) -> Rol:
        return Rol(
            id=nuevo_id(),
            name=datos["name"],
            description=datos.get("description") or None,
            status=datos.get("status") or EstadoRegistro.ACTIVO,
            is_system=False,
        )

    @classmethod
    def gancho_despues_de_crear(cls, fila: Rol, datos: dict) -> None:
        for permiso_id in dict.fromkeys(datos.get("permissionIds") or []):
            bd.session.add(
                RolPermiso(
                    role_id=fila.id,
                    permission_id=permiso_id,
                    created_at=datetime.now(timezone.utc),
                )
            )

    @classmethod
    def aplicar_cambios(cls, fila: Rol, datos: dict) -> None:
        if datos.get("name") is not None:
            fila.name = datos["name"]
        if "description" in datos:
            fila.description = datos["description"] or None
        if datos.get("status") is not None:
            fila.status = datos["status"]

    # ── Reglas propias ───────────────────────────────────────────────

    @classmethod
    def gancho_antes_de_crear(cls, datos: dict) -> None:
        cls.exige_unico(Rol.name, datos["name"], "Ya existe un rol con ese nombre")

    @classmethod
    def gancho_antes_de_actualizar(cls, fila: Rol, datos: dict) -> None:
        if fila.is_system and datos.get("name") and datos["name"] != fila.name:
            raise SolicitudInvalida("No es posible renombrar un rol del sistema")
        nombre = datos.get("name")
        if nombre and nombre.lower() != fila.name.lower():
            cls.exige_unico(Rol.name, nombre, "Ya existe un rol con ese nombre", excluir=fila.id)

    @classmethod
    def gancho_impide_inactivar(cls, fila: Rol) -> str | None:
        if fila.is_system:
            return "No es posible inactivar un rol del sistema"
        usuarios = _contar_usuarios(fila.id)
        if usuarios:
            return f"No es posible inactivar el rol: tiene {usuarios} usuario(s) asignado(s)"
        return None

    @classmethod
    def gancho_impide_eliminar(cls, fila: Rol) -> str | None:
        if fila.is_system:
            return "No es posible eliminar un rol del sistema"
        usuarios = _contar_usuarios(fila.id)
        if usuarios:
            return f"No es posible eliminar el rol: tiene {usuarios} usuario(s) asignado(s)"
        return None

    @classmethod
    def gancho_antes_de_eliminar(cls, fila: Rol) -> None:
        bd.session.execute(delete(RolPermiso).where(RolPermiso.role_id == fila.id))

    @classmethod
    def liberar_claves_unicas(cls, fila: Rol) -> None:
        import time

        fila.name = f"{fila.name} (eliminado {int(time.time() * 1000)})"[:60]

    # ── Permisos del rol ─────────────────────────────────────────────

    @classmethod
    def asignar_permisos(
        cls,
        identificador: str,
        permisos_ids: list[str],
        actor: UsuarioAutenticado,
        ctx: ContextoPeticion,
    ) -> dict:
        """Reemplaza el conjunto de permisos concedidos al rol."""
        rol = cls.buscar(identificador)

        if rol.name == "SUPER_ADMIN":
            raise SolicitudInvalida(
                "El rol SUPER_ADMIN tiene acceso total por definición: sus permisos no se editan"
            )

        validos = bd.session.execute(
            select(func.count())
            .select_from(Permiso)
            .where(Permiso.id.in_(permisos_ids), Permiso.deleted_at.is_(None))
        ).scalar_one()
        if validos != len(set(permisos_ids)):
            raise SolicitudInvalida("Uno o más permisos seleccionados no existen")

        bd.session.execute(delete(RolPermiso).where(RolPermiso.role_id == identificador))
        for permiso_id in dict.fromkeys(permisos_ids):
            bd.session.add(
                RolPermiso(
                    role_id=identificador,
                    permission_id=permiso_id,
                    created_at=datetime.now(timezone.utc),
                )
            )

        auditoria.anotar(
            AccionAuditoria.ACTUALIZAR,
            cls.modulo,
            f"Asignó {len(permisos_ids)} permiso(s) al rol {rol.name}",
            entidad_id=identificador,
            detalle={"permissionIds": permisos_ids},
            usuario=actor,
            ctx=ctx,
        )
        bd.session.commit()
        return cls.obtener(identificador)
