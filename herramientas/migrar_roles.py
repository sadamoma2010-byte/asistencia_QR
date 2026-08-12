"""
Separa el identificador del rol de su nombre visible.

Hasta ahora el control de acceso comparaba el **nombre** del rol, así que
renombrarlo dejaba a sus usuarios sin permisos en silencio. Este guion añade
la columna `code`, la rellena con el nombre actual —que es lo que el sistema
venía usando— y deja `name` libre para llamarlo como quiera la institución.

De paso pone los nombres en castellano, empezando por «Rector(a)» para quien
tiene el control total.

    .venv\\Scripts\\python herramientas\\migrar_roles.py
"""

from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, select, text

from aplicacion import crear_app
from aplicacion.extensiones import bd

# Nombre visible que recibe cada rol del sistema
NOMBRES = {
    "SUPER_ADMIN": "Rector(a)",
    "ADMINISTRADOR": "Administrador(a)",
    "COORDINADOR": "Coordinador(a)",
    "DOCENTE": "Docente",
}


def codigo_desde(nombre: str) -> str:
    """Mismo criterio que usa la aplicación para los roles nuevos."""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", nombre) if unicodedata.category(c) != "Mn"
    )
    return (re.sub(r"[^A-Za-z0-9]+", "_", sin_tildes).strip("_").upper() or "ROL")[:40]


def main() -> int:
    app = crear_app()

    with app.app_context():
        motor = bd.session.get_bind()
        columnas = {c["name"] for c in inspect(motor).get_columns("roles")}

        # ── 1. La columna ────────────────────────────────────────────
        print("\n  Columna del identificador")
        print("  " + "─" * 62)

        if "code" in columnas:
            print("    code                ya existía")
        else:
            bd.session.execute(text('ALTER TABLE "roles" ADD COLUMN "code" VARCHAR(40)'))
            bd.session.commit()
            print("    code                añadida")

        # ── 2. Rellenar con el nombre actual ─────────────────────────
        # Es lo que el control de acceso venía comparando, así que copiarlo
        # deja el sistema exactamente igual que antes.
        print("\n  Roles")
        print("  " + "─" * 62)

        filas = bd.session.execute(
            text('SELECT "id", "code", "name", "is_system" FROM "roles" ORDER BY "is_system" DESC, "name"')
        ).all()

        for fila in filas:
            if fila.code:
                print(f"    {fila.name[:28]:<30}ya tenía código «{fila.code}»")
                continue

            codigo = codigo_desde(fila.name)
            visible = NOMBRES.get(codigo, fila.name)

            bd.session.execute(
                text('UPDATE "roles" SET "code" = :c, "name" = :n WHERE "id" = :i'),
                {"c": codigo, "n": visible, "i": fila.id},
            )
            cambio = f"→ «{visible}»" if visible != fila.name else ""
            print(f"    {fila.name[:28]:<30}código «{codigo}»  {cambio}")

        bd.session.commit()

        # ── 3. Restricciones ─────────────────────────────────────────
        print("\n  Restricciones")
        print("  " + "─" * 62)

        sin_codigo = bd.session.execute(
            text('SELECT COUNT(*) FROM "roles" WHERE "code" IS NULL')
        ).scalar_one()

        if sin_codigo:
            print(f"    ✗ Quedan {sin_codigo} rol(es) sin código: no se puede continuar.")
            return 1

        indices = {i["name"] for i in inspect(motor).get_indexes("roles")}
        if "roles_code_key" in indices:
            print("    roles_code_key      ya existía")
        else:
            bd.session.execute(text('CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code")'))
            print("    roles_code_key      creado")

        bd.session.execute(text('ALTER TABLE "roles" ALTER COLUMN "code" SET NOT NULL'))
        bd.session.commit()
        print("    code obligatorio    aplicado")

        # ── 4. Comprobación ──────────────────────────────────────────
        print("\n  Resultado")
        print("  " + "─" * 62)
        print(f"    {'CÓDIGO':<18}{'NOMBRE VISIBLE':<24}{'USUARIOS':>9}")

        for fila in bd.session.execute(
            text(
                'SELECT r."code", r."name", COUNT(u."id") AS usuarios '
                'FROM "roles" r LEFT JOIN "users" u ON u."role_id" = r."id" '
                'WHERE r."deleted_at" IS NULL '
                'GROUP BY r."id", r."code", r."name" '
                'ORDER BY r."is_system" DESC, r."name"'
            )
        ).all():
            print(f"    {fila.code[:16]:<18}{fila.name[:22]:<24}{fila.usuarios:>9}")

    print("\n  " + "─" * 62)
    print("  ✓ Los roles ya tienen identificador propio.")
    print("    El nombre visible puede cambiarse sin afectar a los permisos.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
