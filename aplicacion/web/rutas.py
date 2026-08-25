"""
Páginas HTML.

Sustituye al enrutado de Next.js. Cada pantalla se genera en el servidor con
Jinja2 y los mismos datos que antes pedía el frontend a la API; el JavaScript
propio se encarga de la interacción.

Las direcciones son las mismas que tenía la aplicación en React, para que
cualquier enlace guardado siga funcionando.
"""

from __future__ import annotations

from functools import wraps
from urllib.parse import quote

from flask import Blueprint, redirect, render_template, request, url_for

from ..comun.seguridad import usuario_actual
from ..modelos.acceso import ROL_CONTROL_TOTAL
from ..modulos.configuracion import servicio as configuracion
from . import navegacion

bp = Blueprint("web", __name__)


def con_sesion(permiso: str | None = None):
    """
    Exige sesión para ver la página.

    A diferencia de la API, aquí no se devuelve 401: se lleva al acceso
    recordando a dónde se quería ir.
    """

    def decorador(funcion):
        @wraps(funcion)
        def envoltura(*args, **kwargs):
            usuario = usuario_actual()
            if usuario is None:
                destino = quote(request.full_path.rstrip("?"))
                return redirect(f"/login?redirect={destino}")
            if permiso and not usuario.tiene(permiso):
                return render_template("sin-permiso.html", **_contexto("Sin acceso")), 403
            return funcion(*args, **kwargs)

        return envoltura

    return decorador


def _contexto(titulo: str) -> dict:
    """Datos que necesitan todas las pantallas administrativas."""
    usuario = usuario_actual()
    return {
        "titulo_pagina": titulo,
        "menu": navegacion.construir(usuario, request.path) if usuario else [],
        "usuario": {
            "nombre": usuario.nombre_completo if usuario else "",
            "correo": usuario.email if usuario else "",
            "rol": usuario.rol_nombre if usuario else "",
            "iniciales": navegacion.iniciales(usuario.nombre_completo if usuario else ""),
        },
        "permisos": {
            "marcar": bool(usuario and usuario.tiene("attendance.self", "attendance.create")),
            "borrar_asistencia": bool(usuario and usuario.rol_codigo == ROL_CONTROL_TOTAL),
        },
        "institucion": configuracion.texto(
            configuracion.CLAVES["NOMBRE_CORTO"], "Institución Educativa"
        ),
    }


# ── Acceso ───────────────────────────────────────────────────────────


@bp.get("/")
def inicio():
    if usuario_actual():
        return redirect("/dashboard")
    return render_template("inicio.html")


@bp.get("/login")
def login():
    if usuario_actual():
        return redirect(request.args.get("redirect") or "/dashboard")
    return render_template("login.html")


# ── Pantallas ────────────────────────────────────────────────────────


@bp.get("/dashboard")
@con_sesion("dashboard.read")
def dashboard():
    from ..modulos.reportes import servicio as reportes

    return render_template("dashboard.html", panel=reportes.panel(), **_contexto("Dashboard"))


# Cada listado se resuelve con la misma plantilla: cambia la definición de
# columnas y el módulo del que salen los datos.
LISTADOS = {
    "docentes": ("Docentes", "teachers.read"),
    "asignaturas": ("Asignaturas", "subjects.read"),
    "grados": ("Grados", "grades.read"),
    "cursos": ("Cursos", "courses.read"),
    "jornadas": ("Jornadas", "shifts.read"),
    "horarios": ("Horarios", "schedules.read"),
    "asistencia": ("Asistencia", "attendance.read"),
    "usuarios": ("Usuarios", "users.read"),
    "roles": ("Roles", "roles.read"),
    "reportes": ("Reportes", "reports.read"),
}


def _registrar_listado(nombre: str, titulo: str, permiso: str) -> None:
    @bp.get(f"/{nombre}", endpoint=f"listado_{nombre}")
    @con_sesion(permiso)
    def vista(nombre=nombre, titulo=titulo):
        from . import listados

        return render_template(
            "listado.html", vista=listados.construir(nombre), **_contexto(titulo)
        )


for _nombre, (_titulo, _permiso) in LISTADOS.items():
    _registrar_listado(_nombre, _titulo, _permiso)


@bp.get("/qr")
@con_sesion("settings.read")
def codigo_qr():
    from flask import current_app

    from ..comun import red

    datos = configuracion.qr()
    return render_template(
        "qr.html",
        qr=datos,
        # Un QR con «localhost» se escanea bien pero no lleva a ninguna parte
        # desde un teléfono: se avisa y se ofrece la dirección correcta.
        sugerida=red.url_sugerida(current_app.config["PUERTO"]),
        alcanzable=red.es_alcanzable_desde_fuera(datos.get("publicUrl", "")),
        **_contexto("Código QR"),
    )


@bp.get("/qr/imagen.<formato>")
@con_sesion("settings.read")
def imagen_qr(formato: str):
    """
    Genera el código QR.

    Sustituye a la librería `qrcode` que usaba el frontend en React. Se genera
    en el servidor con segno, así que la imagen no depende de JavaScript y
    puede imprimirse directamente.
    """
    import segno
    from flask import Response

    if formato not in ("svg", "png"):
        return render_template("sin-permiso.html", **_contexto("Formato no válido")), 404

    destino = request.args.get("url") or configuracion.qr()["publicUrl"]
    if not destino:
        return Response("", status=204)

    # Corrección de errores alta: el código sigue leyéndose impreso y con uso
    codigo = segno.make(destino, error="h")

    from io import BytesIO

    memoria = BytesIO()
    if formato == "svg":
        codigo.save(memoria, kind="svg", scale=8, dark="#0F172A", border=2)
        tipo = "image/svg+xml"
    else:
        codigo.save(memoria, kind="png", scale=12, dark="#0F172A", border=2)
        tipo = "image/png"

    cabeceras = {"Cache-Control": "no-store"}
    if request.args.get("descargar"):
        cabeceras["Content-Disposition"] = f'attachment; filename="qr-institucional.{formato}"'

    return Response(memoria.getvalue(), mimetype=tipo, headers=cabeceras)


@bp.get("/marcar")
@con_sesion()
def marcar():
    from ..modulos.asistencia import servicio as asistencia

    usuario = usuario_actual()
    estado = asistencia.estado_propio(usuario) if usuario.docente_id else None
    return render_template("marcar.html", estado=estado, **_contexto("Marcar asistencia"))
