"""
Identidad del rol frente a su nombre visible.

Lo que se comprueba aquí es que renombrar un rol no cambia lo que puede hacer
quien lo tiene. Antes el control de acceso comparaba el nombre, así que un
cambio de etiqueta habría dejado a esos usuarios sin permisos sin avisar.

    .venv\\Scripts\\python herramientas\\probar_roles.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from aplicacion import crear_app
from aplicacion.extensiones import bd, limitador
from aplicacion.modelos import Rol
from aplicacion.modelos.acceso import ROL_CONTROL_TOTAL

fallos = 0


def comprobar(etiqueta: str, correcto: bool, detalle: str = "") -> None:
    global fallos
    if not correcto:
        fallos += 1
    print(f"  {' ' if correcto else '✗'} {etiqueta:<50}{detalle}")


def main() -> int:
    app = crear_app()
    limitador.enabled = False
    cliente = app.test_client()
    cliente.post("/api/v1/auth/login", json={"email": "admin@datly.local", "password": "Admin123*"})

    print("\n  El rol tiene identificador y nombre por separado")
    print("  " + "─" * 70)

    perfil = (cliente.get("/api/v1/auth/me").get_json() or {}).get("data") or {}
    rol = perfil.get("role") or {}

    comprobar("El identificador no cambia", rol.get("code") == ROL_CONTROL_TOTAL, str(rol.get("code")))
    comprobar("El nombre visible es el elegido", rol.get("name") == "Rector(a)", str(rol.get("name")))
    comprobar(
        "Conserva todos sus permisos",
        len(perfil.get("permissions", [])) > 50,
        f"{len(perfil.get('permissions', []))} permisos",
    )

    # ── Las acciones reservadas siguen funcionando ───────────────────
    print("\n  Las acciones reservadas siguen reconociéndolo")
    print("  " + "─" * 70)

    reservada = cliente.post("/api/v1/attendance/bulk-delete", json={"ids": []})
    # Un cuerpo vacío falla por validación (400), no por permisos (403): eso
    # demuestra que la barrera del rol lo dejó pasar.
    comprobar(
        "Supera la barrera del rol en borrado múltiple",
        reservada.status_code == 400,
        f"HTTP {reservada.status_code} (400 = pasó el rol, falló la validación)",
    )

    reportes = cliente.get("/reportes")
    comprobar(
        "Ve las casillas de borrado en Reportes",
        b'data-seleccion="todas"' in reportes.get_data(),
        f"HTTP {reportes.status_code}",
    )

    # ── Renombrarlo no le quita nada ─────────────────────────────────
    print("\n  Renombrarlo no le quita permisos")
    print("  " + "─" * 70)

    with app.app_context():
        fila = bd.session.execute(
            select(Rol).where(Rol.code == ROL_CONTROL_TOTAL)
        ).scalar_one()
        identificador, original = fila.id, fila.name

    cambio = cliente.patch(f"/api/v1/roles/{identificador}", json={"name": "Dirección General"})
    comprobar(
        "Se puede renombrar aunque sea del sistema",
        cambio.status_code == 200,
        f"HTTP {cambio.status_code}",
    )

    perfil = (cliente.get("/api/v1/auth/me").get_json() or {}).get("data") or {}
    comprobar(
        "El identificador sigue siendo el mismo",
        (perfil.get("role") or {}).get("code") == ROL_CONTROL_TOTAL,
        str((perfil.get("role") or {}).get("code")),
    )
    comprobar(
        "Y mantiene sus permisos",
        len(perfil.get("permissions", [])) > 50,
        f"{len(perfil.get('permissions', []))} permisos",
    )

    reservada = cliente.post("/api/v1/attendance/bulk-delete", json={"ids": []})
    comprobar(
        "Las acciones reservadas siguen abiertas",
        reservada.status_code == 400,
        f"HTTP {reservada.status_code}",
    )

    # Se deja como estaba
    cliente.patch(f"/api/v1/roles/{identificador}", json={"name": original})
    perfil = (cliente.get("/api/v1/auth/me").get_json() or {}).get("data") or {}
    comprobar(
        "Restaurado el nombre original",
        (perfil.get("role") or {}).get("name") == original,
        original,
    )

    # ── Lo que sigue estando protegido ───────────────────────────────
    print("\n  Lo que sigue protegido")
    print("  " + "─" * 70)

    borrado = cliente.delete(f"/api/v1/roles/{identificador}")
    comprobar(
        "No se puede eliminar un rol del sistema",
        borrado.status_code == 400,
        (borrado.get_json() or {}).get("message", "")[:44],
    )

    baja = cliente.patch(f"/api/v1/roles/{identificador}/deactivate")
    comprobar(
        "Ni inactivarlo",
        baja.status_code == 400,
        (baja.get_json() or {}).get("message", "")[:44],
    )

    permisos = cliente.patch(
        f"/api/v1/roles/{identificador}/permissions", json={"permissionIds": []}
    )
    comprobar(
        "Ni recortarle los permisos",
        permisos.status_code == 400,
        (permisos.get_json() or {}).get("message", "")[:44],
    )

    print("\n  " + "─" * 70)
    if fallos:
        print(f"  ✗ {fallos} comprobación(es) fallaron.\n")
        return 1
    print("  ✓ El nombre del rol se puede cambiar sin tocar los permisos.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
