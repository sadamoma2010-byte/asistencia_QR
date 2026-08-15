"""
Comprueba que las quince pantallas responden y traen su contenido.

No basta con un HTTP 200: se verifica que el HTML contenga las marcas que
demuestran que la página se armó de verdad (título, menú, fondo institucional)
y que no haya quedado ningún bloque de plantilla sin resolver.

    .venv\\Scripts\\python herramientas\\probar_pantallas.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from herramientas.consola import preparar

preparar()

from aplicacion import crear_app
from aplicacion.extensiones import limitador

CORREO = "admin@datly.local"
CLAVE = "Admin123*"

PANTALLAS = [
    ("Dashboard", "/dashboard", "Resumen operativo"),
    ("Docentes", "/docentes", "Administre la información de los docentes"),
    ("Asignaturas", "/asignaturas", "Cree las materias"),
    ("Grados", "/grados", "Ley 115 de 1994"),
    ("Cursos", "/cursos", "Grupos de cada grado"),
    ("Jornadas", "/jornadas", "Franjas institucionales"),
    ("Horarios", "/horarios", "Franja de trabajo"),
    ("Asistencia", "/asistencia", "Consulte, filtre y exporte"),
    ("Reportes", "/reportes", "Resumen consolidado"),
    ("Usuarios", "/usuarios", "Cuentas de acceso"),
    ("Roles", "/roles", "Perfiles de acceso"),
    ("Código QR", "/qr", "Código QR institucional"),
    ("Marcar asistencia", "/marcar", "Registrar asistencia"),
]

# Pantallas retiradas de la aplicación. La maquinaria sigue trabajando por
# dentro —el control de acceso consulta los permisos, la auditoría registra
# cada acción y el QR lee su dirección de los ajustes—, pero ya no tienen
# página propia.
RETIRADAS = [
    ("Permisos", "/permisos"),
    ("Auditoría", "/auditoria"),
    ("Configuración", "/configuracion"),
]

fallos = 0


def comprobar(etiqueta: str, condicion: bool, detalle: str) -> None:
    global fallos
    if not condicion:
        fallos += 1
    print(f"  {' ' if condicion else '✗'} {etiqueta:<22}{detalle}")


def main() -> int:
    app = crear_app()
    limitador.enabled = False
    cliente = app.test_client()

    print("\n  Pantallas de la aplicación")
    print("  " + "─" * 62)

    # La pantalla de acceso se comprueba sin sesión: con una abierta redirige
    # al panel, que es justo lo que debe hacer.
    sin_sesion = app.test_client().get("/login")
    comprobar(
        "Acceso",
        sin_sesion.status_code == 200
        and "Correo institucional" in sin_sesion.get_data(as_text=True),
        f"HTTP {sin_sesion.status_code} · {len(sin_sesion.get_data()) // 1024} KB",
    )

    acceso = cliente.post("/api/v1/auth/login", json={"email": CORREO, "password": CLAVE})
    if acceso.status_code != 200:
        print(f"  No fue posible autenticar: HTTP {acceso.status_code}\n")
        return 1

    for etiqueta, ruta, marca in PANTALLAS:
        respuesta = cliente.get(ruta)
        html = respuesta.get_data(as_text=True)

        if respuesta.status_code != 200:
            comprobar(etiqueta, False, f"HTTP {respuesta.status_code}")
            continue

        problemas = []
        if marca not in html:
            problemas.append("falta el contenido esperado")
        if "{{" in html or "{%" in html:
            problemas.append("quedó plantilla sin resolver")
        if "app-gradient" not in html:
            problemas.append("falta el fondo institucional")
        if ruta not in ("/login", "/marcar") and 'id="lateral"' not in html:
            problemas.append("falta el menú lateral")

        comprobar(
            etiqueta,
            not problemas,
            f"HTTP 200 · {len(html) // 1024} KB" if not problemas else ", ".join(problemas),
        )

    # ── Pantallas retiradas ──────────────────────────────────────────
    # Ya no existen como página, pero lo que hacían por dentro sigue vivo:
    # se comprueba aparte, más abajo.
    print("\n  Pantallas retiradas")
    print("  " + "─" * 62)
    for etiqueta, ruta in RETIRADAS:
        respuesta = cliente.get(ruta)
        comprobar(
            etiqueta,
            respuesta.status_code == 404,
            f"HTTP {respuesta.status_code} · ya no tiene página",
        )

    # ── La maquinaria que sostenían ──────────────────────────────────
    print("\n  Lo que siguen haciendo por dentro")
    print("  " + "─" * 62)

    respuesta = cliente.get("/api/v1/permissions/grouped")
    grupos = (respuesta.get_json() or {}).get("data") or []
    comprobar(
        "Permisos por rol",
        respuesta.status_code == 200 and len(grupos) > 0,
        f"{sum(len(g['permissions']) for g in grupos)} permisos en {len(grupos)} módulos",
    )

    respuesta = cliente.get("/api/v1/audit?page=1&limit=1")
    meta = (respuesta.get_json() or {}).get("data", {}).get("meta", {})
    comprobar(
        "Auditoría",
        respuesta.status_code == 200 and meta.get("total", 0) > 0,
        f"{meta.get('total', 0)} registros guardados",
    )

    # La dirección del QR sale de los ajustes: si se hubiera perdido, la
    # pantalla del QR no tendría a dónde apuntar.
    ajustes = (cliente.get("/api/v1/settings/qr").get_json() or {}).get("data") or {}
    direccion = ajustes.get("publicUrl", "")
    pagina = cliente.get("/qr").get_data(as_text=True)
    comprobar(
        "Dirección del QR",
        bool(direccion) and direccion in pagina,
        direccion or "sin configurar",
    )

    # ── Recursos estáticos ───────────────────────────────────────────
    print("\n  Recursos")
    print("  " + "─" * 62)
    for etiqueta, ruta in (
        ("Hoja de estilos", "/estaticos/css/estilos.css"),
        ("Cliente de la API", "/estaticos/js/api.js"),
        ("Interfaz", "/estaticos/js/interfaz.js"),
        ("Listados", "/estaticos/js/listado.js"),
        ("Icono", "/estaticos/img/icono.svg"),
    ):
        respuesta = cliente.get(ruta)
        comprobar(
            etiqueta,
            respuesta.status_code == 200,
            f"HTTP {respuesta.status_code} · {len(respuesta.get_data()) // 1024} KB",
        )

    # ── Código QR generado en el servidor ────────────────────────────
    qr = cliente.get("/qr/imagen.svg")
    comprobar(
        "Código QR (SVG)",
        qr.status_code == 200 and b"<svg" in qr.get_data(),
        f"HTTP {qr.status_code}",
    )
    png = cliente.get("/qr/imagen.png")
    comprobar(
        "Código QR (PNG)",
        png.status_code == 200 and png.get_data()[:4] == b"\x89PNG",
        f"HTTP {png.status_code}",
    )

    # ── Sin sesión no se entra ───────────────────────────────────────
    print("\n  Control de acceso")
    print("  " + "─" * 62)
    anonimo = app.test_client()
    for ruta in ("/dashboard", "/docentes", "/roles"):
        respuesta = anonimo.get(ruta)
        comprobar(
            f"Sin sesión: {ruta}",
            respuesta.status_code == 302 and "/login" in respuesta.headers.get("Location", ""),
            f"HTTP {respuesta.status_code} → {respuesta.headers.get('Location', '')[:40]}",
        )

    print("\n  " + "─" * 62)
    if fallos:
        print(f"  ✗ {fallos} comprobación(es) fallaron.\n")
        return 1
    print(f"  ✓ Las {len(PANTALLAS)} pantallas y sus recursos responden correctamente.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
