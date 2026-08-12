"""
Traslada las fotografías del disco a la base de datos.

Hasta ahora la imagen se guardaba en `uploads/teachers/` y en la base solo
quedaba su ruta. Esa carpeta está excluida del repositorio, así que un
respaldo de la base no se llevaba las fotos y restaurarla las perdía.

Este guion añade las columnas si faltan, mete dentro las imágenes que ya
existen y deja la carpeta antigua intacta por si hiciera falta revisarla.

    .venv\\Scripts\\python herramientas\\migrar_fotos.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, select, text

from aplicacion import crear_app
from aplicacion.extensiones import bd
from aplicacion.modelos import Docente

RAIZ = Path(__file__).resolve().parent.parent
CARPETA = RAIZ / "uploads" / "teachers"


def main() -> int:
    app = crear_app()

    with app.app_context():
        motor = bd.session.get_bind()
        columnas = {c["name"] for c in inspect(motor).get_columns("teachers")}

        # ── 1. Las columnas ──────────────────────────────────────────
        print("\n  Columnas de la fotografía")
        print("  " + "─" * 56)

        for nombre, tipo in (("photo", "BYTEA"), ("photo_mime", "VARCHAR(40)")):
            if nombre in columnas:
                print(f"    {nombre:<14} ya existía")
            else:
                bd.session.execute(text(f'ALTER TABLE "teachers" ADD COLUMN "{nombre}" {tipo}'))
                bd.session.commit()
                print(f"    {nombre:<14} añadida")

        # ── 2. Las imágenes ──────────────────────────────────────────
        print("\n  Fotografías")
        print("  " + "─" * 56)

        docentes = list(
            bd.session.execute(
                select(Docente).where(Docente.photo_url.is_not(None))
            ).scalars()
        )

        if not docentes:
            print("    No hay docentes con fotografía.")
            print("\n  ✓ Nada que traspasar.\n")
            return 0

        traspasadas = 0
        ausentes = 0

        for docente in docentes:
            if docente.photo:
                print(f"    {docente.code:<16}ya estaba en la base")
                continue

            # La ruta antigua terminaba en el nombre del archivo
            nombre = (docente.photo_url or "").rsplit("/", 1)[-1].split("?")[0]
            origen = CARPETA / nombre

            if not nombre or not origen.is_file():
                print(f"    {docente.code:<16}no se encontró el archivo ({nombre or 'sin ruta'})")
                # Sin archivo, la ruta guardada no lleva a ninguna parte
                docente.photo_url = None
                ausentes += 1
                continue

            docente.photo = origen.read_bytes()
            docente.photo_mime = "image/webp"
            docente.photo_url = f"/api/v1/teachers/{docente.id}/photo?v={int(origen.stat().st_mtime)}"
            traspasadas += 1
            print(f"    {docente.code:<16}{len(docente.photo) // 1024} KB traspasados")

        bd.session.commit()

        # ── 3. Comprobación ──────────────────────────────────────────
        print("\n  Comprobación")
        print("  " + "─" * 56)

        con_imagen = bd.session.execute(
            text('SELECT COUNT(*) FROM "teachers" WHERE "photo" IS NOT NULL')
        ).scalar_one()
        con_ruta = bd.session.execute(
            text('SELECT COUNT(*) FROM "teachers" WHERE "photo_url" IS NOT NULL')
        ).scalar_one()
        peso = bd.session.execute(
            text('SELECT COALESCE(SUM(LENGTH("photo")), 0) FROM "teachers"')
        ).scalar_one()

        print(f"    Docentes con imagen en la base  {con_imagen}")
        print(f"    Docentes con ruta publicada     {con_ruta}")
        print(f"    Ocupan en total                 {peso // 1024} KB")

        coherente = con_imagen == con_ruta

    print("\n  " + "─" * 56)
    if not coherente:
        print("  ✗ Hay rutas sin imagen o al revés: revise el listado.\n")
        return 1
    print(f"  ✓ {traspasadas} fotografía(s) traspasadas" + (f", {ausentes} sin archivo.\n" if ausentes else ".\n"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
