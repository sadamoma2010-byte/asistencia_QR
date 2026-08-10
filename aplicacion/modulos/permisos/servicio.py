"""
Servicio de permisos.

Traducción de `modules/permissions/permissions.service.ts`.
"""

from __future__ import annotations

import time

from sqlalchemy import delete, func, select

from ...comun.crud import ServicioCRUD
from ...comun.errores import SolicitudInvalida
from ...extensiones import bd
from ...modelos import Permiso, RolPermiso, EstadoRegistro, nuevo_id


def _contar_roles(permiso_id: str) -> int:
    return bd.session.execute(
        select(func.count()).select_from(RolPermiso).where(RolPermiso.permission_id == permiso_id)
    ).scalar_one()


class ServicioPermisos(ServicioCRUD):
    modelo = Permiso
    modulo = "Permisos"
    articulo = "el"
    sustantivo = "permiso"
    campo_etiqueta = "code"
    tope_exportacion = 2000

    ordenables = {
        "createdAt": Permiso.created_at,
        "code": Permiso.code,
        "name": Permiso.name,
        "module": Permiso.module,
        "status": Permiso.status,
    }
    buscables = (Permiso.code, Permiso.name, Permiso.module, Permiso.description)

    # ── Serialización ────────────────────────────────────────────────

    @classmethod
    def serializar(cls, fila: Permiso) -> dict:
        return {
            **cls.campos_comunes(fila),
            "code": fila.code,
            "name": fila.name,
            "module": fila.module,
            "description": fila.description,
            "isSystem": fila.is_system,
            "_count": {"roles": _contar_roles(fila.id)},
        }

    @classmethod
    def agrupados(cls) -> list[dict]:
        """
        Permisos organizados por módulo.

        Es lo que consume la pantalla de roles para pintar el árbol de casillas.
        """
        filas = bd.session.execute(
            select(Permiso)
            .where(Permiso.deleted_at.is_(None), Permiso.status == EstadoRegistro.ACTIVO)
            .order_by(Permiso.module.asc(), Permiso.code.asc())
        ).scalars()

        grupos: dict[str, list[dict]] = {}
        for permiso in filas:
            grupos.setdefault(permiso.module, []).append(
                {
                    "id": permiso.id,
                    "code": permiso.code,
                    "name": permiso.name,
                    "module": permiso.module,
                    "description": permiso.description,
                }
            )

        return [
            {"module": modulo, "permissions": permisos} for modulo, permisos in grupos.items()
        ]

    @classmethod
    def modulos(cls) -> list[str]:
        """Módulos distintos presentes en el catálogo."""
        return list(
            bd.session.execute(
                select(Permiso.module)
                .where(Permiso.deleted_at.is_(None))
                .distinct()
                .order_by(Permiso.module.asc())
            ).scalars()
        )

    # ── Mutaciones ───────────────────────────────────────────────────

    @classmethod
    def construir(cls, datos: dict) -> Permiso:
        return Permiso(
            id=nuevo_id(),
            code=datos["code"],
            name=datos["name"],
            module=datos["module"],
            description=datos.get("description") or None,
            status=datos.get("status") or EstadoRegistro.ACTIVO,
            is_system=False,
        )

    @classmethod
    def aplicar_cambios(cls, fila: Permiso, datos: dict) -> None:
        if datos.get("code") is not None:
            fila.code = datos["code"]
        if datos.get("name") is not None:
            fila.name = datos["name"]
        if datos.get("module") is not None:
            fila.module = datos["module"]
        if "description" in datos:
            fila.description = datos["description"] or None
        if datos.get("status") is not None:
            fila.status = datos["status"]

    @classmethod
    def liberar_claves_unicas(cls, fila: Permiso) -> None:
        fila.code = f"{fila.code}.DEL.{int(time.time() * 1000)}"[:80]

    # ── Reglas propias ───────────────────────────────────────────────

    @classmethod
    def gancho_antes_de_crear(cls, datos: dict) -> None:
        cls.exige_unico(Permiso.code, datos["code"], "Ya existe un permiso con ese código")

    @classmethod
    def gancho_antes_de_actualizar(cls, fila: Permiso, datos: dict) -> None:
        if fila.is_system and datos.get("code") and datos["code"] != fila.code:
            raise SolicitudInvalida("No es posible cambiar el código de un permiso del sistema")
        codigo = datos.get("code")
        if codigo and codigo != fila.code:
            cls.exige_unico(
                Permiso.code, codigo, "Ya existe un permiso con ese código", excluir=fila.id
            )

    @classmethod
    def gancho_impide_inactivar(cls, fila: Permiso) -> str | None:
        if fila.is_system:
            return "No es posible inactivar un permiso del sistema"
        return None

    @classmethod
    def gancho_impide_eliminar(cls, fila: Permiso) -> str | None:
        if fila.is_system:
            return "No es posible eliminar un permiso del sistema"
        roles = _contar_roles(fila.id)
        if roles:
            return f"No es posible eliminar el permiso: está concedido a {roles} rol(es)"
        return None

    @classmethod
    def gancho_antes_de_eliminar(cls, fila: Permiso) -> None:
        bd.session.execute(delete(RolPermiso).where(RolPermiso.permission_id == fila.id))
