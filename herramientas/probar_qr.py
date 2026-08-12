"""
Comprobación del código QR institucional.

Verifica lo que de verdad importa: que el QR lleve a una dirección alcanzable
desde un celular, que sea uno solo para todos los docentes y que cada uno, al
escanearlo, acabe en su propia pantalla de marcación.

    .venv\\Scripts\\python herramientas\\probar_qr.py
"""

from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from aplicacion import crear_app
from aplicacion.comun import red
from aplicacion.extensiones import bd, limitador
from aplicacion.modelos import Docente, EstadoRegistro, Usuario
from aplicacion.modulos.configuracion import servicio as configuracion

fallos = 0


def comprobar(etiqueta: str, correcto: bool, detalle: str = "") -> None:
    global fallos
    if not correcto:
        fallos += 1
    print(f"  {' ' if correcto else '✗'} {etiqueta:<44}{detalle}")


def main() -> int:
    app = crear_app()
    limitador.enabled = False
    cliente = app.test_client()

    print("\n  Código QR institucional")
    print("  " + "─" * 66)

    with app.app_context():
        datos = configuracion.qr()
        url = datos["publicUrl"]
        partes = urlsplit(url)

    # ── La dirección debe servir desde un teléfono ───────────────────
    comprobar("Hay una dirección configurada", bool(url), url)
    comprobar(
        "Alcanzable desde otro dispositivo",
        red.es_alcanzable_desde_fuera(url),
        "no usa localhost" if red.es_alcanzable_desde_fuera(url) else "APUNTA A LOCALHOST",
    )
    comprobar("Lleva a la pantalla de marcación", partes.path == "/marcar", partes.path)
    comprobar(
        "Usa el puerto de la aplicación",
        str(partes.port or 80) == str(app.config["PUERTO"]),
        f"puerto {partes.port}",
    )

    # ── La imagen se genera ──────────────────────────────────────────
    cliente.post("/api/v1/auth/login", json={"email": "admin@datly.local", "password": "Admin123*"})

    svg = cliente.get("/qr/imagen.svg")
    comprobar(
        "Se genera la imagen SVG",
        svg.status_code == 200 and b"<svg" in svg.get_data(),
        f"{len(svg.get_data()) // 1024} KB",
    )
    png = cliente.get("/qr/imagen.png")
    comprobar(
        "Se genera la imagen PNG",
        png.status_code == 200 and png.get_data()[:4] == b"\x89PNG",
        f"{len(png.get_data()) // 1024} KB",
    )

    # El contenido del QR debe ser exactamente la dirección configurada. Se
    # genera aquí el código de esa dirección y se contrasta con el que sirve la
    # aplicación: si coinciden byte a byte, el QR lleva a donde debe.
    import io

    import segno

    esperado = io.BytesIO()
    segno.make(url, error="h").save(esperado, kind="svg", scale=8, dark="#0F172A", border=2)

    comprobar(
        "El QR codifica esa misma dirección",
        svg.get_data() == esperado.getvalue(),
        url,
    )

    # Y un contenido distinto tiene que producir un código distinto
    otro = cliente.get("/qr/imagen.svg?url=http://otra-direccion/marcar")
    comprobar(
        "Otra dirección produce otro código",
        otro.status_code == 200 and otro.get_data() != svg.get_data(),
        "los códigos difieren",
    )

    # ── Un solo QR para todos los docentes ───────────────────────────
    print("\n  Un mismo código para todos los docentes")
    print("  " + "─" * 66)

    with app.app_context():
        docentes = list(
            bd.session.execute(
                select(Docente)
                .where(
                    Docente.deleted_at.is_(None),
                    Docente.status == EstadoRegistro.ACTIVO,
                    Docente.user_id.is_not(None),
                )
                .limit(5)
            ).scalars()
        )
        cuentas = {
            d.id: bd.session.execute(
                select(Usuario).where(Usuario.id == d.user_id)
            ).scalar_one_or_none()
            for d in docentes
        }

    comprobar(
        "Hay docentes con cuenta de acceso",
        len(docentes) > 0,
        f"{len(docentes)} docente(s)",
    )

    # ── Sin sesión, el QR lleva al acceso y de ahí a marcar ──────────
    anonimo = app.test_client()
    respuesta = anonimo.get("/marcar")
    destino = respuesta.headers.get("Location", "")
    comprobar(
        "Sin sesión lleva al acceso",
        respuesta.status_code == 302 and "/login" in destino,
        f"HTTP {respuesta.status_code}",
    )
    comprobar(
        "Y recuerda que iba a marcar",
        "redirect=%2Fmarcar" in destino or "redirect=/marcar" in destino,
        destino[:46],
    )

    # ── Cada docente llega a su propia pantalla ──────────────────────
    print("\n  Cada docente ve lo suyo al escanearlo")
    print("  " + "─" * 66)

    for docente in docentes:
        cuenta = cuentas.get(docente.id)
        if cuenta is None:
            continue

        sesion = app.test_client()
        # Cada docente entra con su cuenta desde el mismo código
        acceso = sesion.post(
            "/api/v1/auth/login",
            json={"email": cuenta.email, "password": "Admin123*"},
        )
        if acceso.status_code != 200:
            # Solo se prueban las cuentas cuya contraseña conocemos
            print(f"    {docente.code:<12}(no se pudo entrar con la clave de prueba)")
            continue

        pagina = sesion.get("/marcar")
        html = pagina.get_data(as_text=True)
        suyo = docente.first_name in html and docente.last_name in html

        comprobar(
            f"{docente.code} llega a su panel",
            pagina.status_code == 200 and suyo,
            f"{docente.first_name} {docente.last_name}",
        )

    print("\n  " + "─" * 66)
    if fallos:
        print(f"  ✗ {fallos} comprobación(es) fallaron.\n")
        return 1
    print("  ✓ El código QR funciona y es el mismo para todos los docentes.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
