"""
Alta de las rutas estándar de un módulo CRUD.

Los controladores del sistema original exponían siempre los mismos ocho
puntos de entrada con los mismos permisos. Aquí se declaran una vez y cada
módulo los registra indicando su servicio y su prefijo de permisos.

Los módulos que necesiten algo más añaden sus rutas propias al mismo
blueprint, antes o después de llamar a esta función.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Sequence

from flask import Blueprint, request

from . import excel as hoja
from .consultas import Paginacion
from .peticion import contexto
from .respuestas import responder
from .seguridad import exigir_usuario, requiere_permisos
from ..modelos import EstadoRegistro


@dataclass
class Exportacion:
    """Cómo se arma el Excel de un módulo."""

    nombre_hoja: str
    titulo: str
    archivo: str
    columnas: Sequence[hoja.Columna]


def registrar_crud(
    bp: Blueprint,
    *,
    ruta: str,
    servicio: Any,
    permiso: str,
    esquema_crear: Any,
    esquema_actualizar: Any,
    exportacion: Exportacion | None = None,
    opciones: Callable[[], list] | None = None,
    permisos_opciones: Sequence[str] = (),
    orden_defecto: str = "createdAt",
) -> None:
    """
    Registra listar, opciones, exportar, detalle, crear, actualizar,
    activar, inactivar y eliminar.

    `ruta` es el segmento público, por ejemplo `shifts`. `permiso` es el
    prefijo de los permisos, por ejemplo `shifts`, del que salen
    `shifts.read`, `shifts.create` y los demás.
    """

    @bp.get(f"/{ruta}")
    @requiere_permisos(f"{permiso}.read")
    def listar():
        return responder(servicio.listar(Paginacion(orden_defecto)))

    if opciones is not None:

        @bp.get(f"/{ruta}/options")
        @requiere_permisos(*(permisos_opciones or (f"{permiso}.read",)))
        def catalogo():
            """Catálogo reducido para los desplegables de los formularios."""
            return responder(opciones())

    if exportacion is not None:

        @bp.get(f"/{ruta}/export")
        @requiere_permisos(f"{permiso}.export")
        def exportar():
            filas = servicio.para_exportar(Paginacion(orden_defecto))
            contenido = hoja.construir(
                hoja=exportacion.nombre_hoja,
                titulo=exportacion.titulo,
                subtitulo=hoja.subtitulo_estandar(len(filas)),
                columnas=exportacion.columnas,
                filas=filas,
            )
            return hoja.descargar(contenido, exportacion.archivo)

    @bp.get(f"/{ruta}/<identificador>")
    @requiere_permisos(f"{permiso}.read")
    def detalle(identificador: str):
        return responder(servicio.obtener(identificador))

    @bp.post(f"/{ruta}")
    @requiere_permisos(f"{permiso}.create")
    def crear():
        datos = esquema_crear.model_validate(request.get_json(silent=True) or {})
        creado = servicio.crear(datos.model_dump(exclude_unset=True), exigir_usuario(), contexto())
        return responder(creado, 201)

    @bp.patch(f"/{ruta}/<identificador>")
    @requiere_permisos(f"{permiso}.update")
    def actualizar(identificador: str):
        datos = esquema_actualizar.model_validate(request.get_json(silent=True) or {})
        actualizado = servicio.actualizar(
            identificador, datos.model_dump(exclude_unset=True), exigir_usuario(), contexto()
        )
        return responder(actualizado)

    @bp.patch(f"/{ruta}/<identificador>/activate")
    @requiere_permisos(f"{permiso}.activate")
    def activar(identificador: str):
        return responder(
            servicio.cambiar_estado(
                identificador, EstadoRegistro.ACTIVO, exigir_usuario(), contexto()
            )
        )

    @bp.patch(f"/{ruta}/<identificador>/deactivate")
    @requiere_permisos(f"{permiso}.deactivate")
    def inactivar(identificador: str):
        return responder(
            servicio.cambiar_estado(
                identificador, EstadoRegistro.INACTIVO, exigir_usuario(), contexto()
            )
        )

    @bp.delete(f"/{ruta}/<identificador>")
    @requiere_permisos(f"{permiso}.delete")
    def eliminar(identificador: str):
        return responder(servicio.eliminar(identificador, exigir_usuario(), contexto()))
