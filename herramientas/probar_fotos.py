"""
Fotografía del docente: subida, almacenamiento y entrega.

Comprueba que la imagen se guarda dentro de la base de datos —no en el disco—,
que se normaliza siempre al mismo formato y tamaño, que se sirve correctamente
y que se puede poner tanto al crear como al editar.

    .venv\\Scripts\\python herramientas\\probar_fotos.py
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from herramientas.consola import preparar

preparar()

from PIL import Image
from sqlalchemy import delete, select, text

from aplicacion import crear_app
from aplicacion.extensiones import bd, limitador
from aplicacion.modelos import Docente

MARCA = "ZZFOTO"
fallos = 0


def comprobar(etiqueta: str, correcto: bool, detalle: str = "") -> None:
    global fallos
    if not correcto:
        fallos += 1
    print(f"  {' ' if correcto else '✗'} {etiqueta:<46}{detalle}")


def imagen(ancho: int, alto: int, color=(220, 60, 60), formato="PNG") -> bytes:
    """Genera una imagen de prueba con las medidas pedidas."""
    memoria = io.BytesIO()
    Image.new("RGB", (ancho, alto), color).save(memoria, format=formato)
    return memoria.getvalue()


def limpiar() -> None:
    for docente in bd.session.execute(
        select(Docente).where(Docente.code.startswith(MARCA))
    ).scalars():
        bd.session.delete(docente)
    bd.session.commit()


def main() -> int:
    app = crear_app()
    limitador.enabled = False
    cliente = app.test_client()
    cliente.post("/api/v1/auth/login", json={"email": "admin@datly.local", "password": "Admin123*"})

    with app.app_context():
        limpiar()

    print("\n  Fotografía al crear el docente")
    print("  " + "─" * 68)

    # ── Alta y subida inmediata, como hace el formulario ─────────────
    alta = cliente.post(
        "/api/v1/teachers",
        json={
            "code": f"{MARCA}-1",
            "firstName": "Prueba",
            "lastName": "Fotografia",
            "document": f"{MARCA}001",
            "email": f"{MARCA.lower()}@datly.local",
        },
    )
    creado = (alta.get_json() or {}).get("data") or {}
    comprobar("Se crea el docente", alta.status_code == 201, f"HTTP {alta.status_code}")
    if not creado:
        return 1

    identificador = creado["id"]
    comprobar("Nace sin fotografía", creado.get("photoUrl") is None, str(creado.get("photoUrl")))

    subida = cliente.post(
        f"/api/v1/teachers/{identificador}/photo",
        data={"file": (io.BytesIO(imagen(900, 600)), "retrato.png")},
        content_type="multipart/form-data",
    )
    resultado = (subida.get_json() or {}).get("data") or {}
    comprobar("Se sube justo después del alta", subida.status_code == 200, f"HTTP {subida.status_code}")
    comprobar(
        "Queda una dirección para mostrarla",
        bool(resultado.get("photoUrl")),
        (resultado.get("photoUrl") or "")[:52],
    )

    # ── Dónde quedó guardada ─────────────────────────────────────────
    print("\n  Dónde se guarda")
    print("  " + "─" * 68)

    with app.app_context():
        fila = bd.session.execute(
            text('SELECT "photo", "photo_mime", LENGTH("photo") AS peso '
                 'FROM "teachers" WHERE "id" = :i'),
            {"i": identificador},
        ).one()

        comprobar("La imagen está en la base de datos", fila.photo is not None, f"{fila.peso} bytes")
        comprobar("Con su tipo declarado", fila.photo_mime == "image/webp", str(fila.photo_mime))

        with Image.open(io.BytesIO(bytes(fila.photo))) as guardada:
            comprobar(
                "Normalizada a 512 × 512",
                guardada.size == (512, 512),
                f"{guardada.size[0]} × {guardada.size[1]}",
            )
            comprobar("Convertida a WEBP", guardada.format == "WEBP", str(guardada.format))

        comprobar(
            "Pesa mucho menos que el original",
            fila.peso < len(imagen(900, 600)),
            f"{fila.peso} contra {len(imagen(900, 600))} bytes",
        )

    # No debe aparecer ningún archivo nuevo en la carpeta antigua
    carpeta = Path(__file__).resolve().parent.parent / "uploads" / "teachers"
    antes = {p.name for p in carpeta.glob("*")} if carpeta.exists() else set()
    comprobar(
        "No se escribe nada nuevo en el disco",
        not any(identificador in n for n in antes),
        f"{len(antes)} archivo(s) antiguos, ninguno nuevo",
    )

    # ── Se sirve correctamente ───────────────────────────────────────
    print("\n  Cómo se muestra")
    print("  " + "─" * 68)

    ruta = (resultado.get("photoUrl") or "").replace("/api/v1", "/api/v1")
    entrega = cliente.get(ruta)
    comprobar("Se entrega al pedirla", entrega.status_code == 200, f"HTTP {entrega.status_code}")
    comprobar(
        "Con el tipo de imagen correcto",
        entrega.mimetype == "image/webp",
        entrega.mimetype,
    )
    with app.app_context():
        guardado = bd.session.execute(
            text('SELECT "photo" FROM "teachers" WHERE "id" = :i'), {"i": identificador}
        ).scalar_one()
    comprobar(
        "Y es exactamente la guardada",
        entrega.get_data() == bytes(guardado),
        f"{len(entrega.get_data())} bytes",
    )

    anonimo = app.test_client()
    comprobar(
        "Sin sesión no se entrega",
        anonimo.get(ruta).status_code == 401,
        f"HTTP {anonimo.get(ruta).status_code}",
    )

    # ── Cambio y retirada ────────────────────────────────────────────
    print("\n  Cambiar y quitar")
    print("  " + "─" * 68)

    with app.app_context():
        anterior = bd.session.execute(
            text('SELECT "photo" FROM "teachers" WHERE "id" = :i'), {"i": identificador}
        ).scalar_one()

    cliente.post(
        f"/api/v1/teachers/{identificador}/photo",
        data={"file": (io.BytesIO(imagen(400, 400, (40, 120, 220), "JPEG")), "otra.jpg")},
        content_type="multipart/form-data",
    )
    with app.app_context():
        nueva = bd.session.execute(
            text('SELECT "photo" FROM "teachers" WHERE "id" = :i'), {"i": identificador}
        ).scalar_one()
    comprobar("Se reemplaza por la nueva", bytes(nueva) != bytes(anterior), "contenido distinto")

    quitada = cliente.delete(f"/api/v1/teachers/{identificador}/photo")
    comprobar("Se puede quitar", quitada.status_code == 200, f"HTTP {quitada.status_code}")

    with app.app_context():
        fila = bd.session.execute(
            text('SELECT "photo", "photo_url" FROM "teachers" WHERE "id" = :i'),
            {"i": identificador},
        ).one()
    comprobar("La base queda sin imagen", fila.photo is None and fila.photo_url is None, "vacía")
    comprobar(
        "Y ya no se entrega",
        cliente.get(ruta).status_code == 404,
        f"HTTP {cliente.get(ruta).status_code}",
    )

    # ── Archivos que no son imágenes ─────────────────────────────────
    print("\n  Archivos que no debe aceptar")
    print("  " + "─" * 68)

    rechazo = cliente.post(
        f"/api/v1/teachers/{identificador}/photo",
        data={"file": (io.BytesIO(b"esto no es una imagen"), "trampa.png")},
        content_type="multipart/form-data",
    )
    comprobar(
        "Rechaza contenido que no es imagen",
        rechazo.status_code == 400,
        (rechazo.get_json() or {}).get("message", "")[:40],
    )

    rechazo = cliente.post(
        f"/api/v1/teachers/{identificador}/photo",
        data={"file": (io.BytesIO(b"%PDF-1.4"), "documento.pdf")},
        content_type="multipart/form-data",
    )
    comprobar(
        "Rechaza otros formatos",
        rechazo.status_code == 400,
        (rechazo.get_json() or {}).get("message", "")[:40],
    )

    with app.app_context():
        limpiar()

    print("\n  " + "─" * 68)
    if fallos:
        print(f"  ✗ {fallos} comprobación(es) fallaron.\n")
        return 1
    print("  ✓ La fotografía se guarda en la base y se sirve correctamente.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
