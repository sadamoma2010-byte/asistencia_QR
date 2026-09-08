"""
Arranque de la aplicación.

Sustituye a `backend/src/main.ts`. Un solo proceso sirve las páginas HTML,
la API REST y los archivos subidos.

    .venv\\Scripts\\python servidor.py

En producción se levanta con waitress, que sí está pensado para eso:

    .venv\\Scripts\\python servidor.py --produccion
"""

from __future__ import annotations

import sys

from aplicacion import __version__, crear_app

# La consola de Windows usa cp1252 y no sabe escribir acentos ni caracteres de
# recuadro. Se fuerza UTF-8 para que los mensajes salgan legibles.
for flujo in (sys.stdout, sys.stderr):
    if hasattr(flujo, "reconfigure"):
        flujo.reconfigure(encoding="utf-8", errors="replace")

app = crear_app()

# Asegura que los docentes y sus usuarios existan en la base (idempotente).
# Se ejecuta al arrancar para no depender de la fase de build de Render.
try:
    import seed_sincronizacion

    seed_sincronizacion.ejecutar_seed()
except Exception as error:  # noqa: BLE001
    print(f"[arranque] No se pudo sincronizar el seed: {error}")


def main() -> None:
    puerto = app.config["PUERTO"]
    produccion = "--produccion" in sys.argv

    print()
    print("  Sistema de Asistencia Docente por QR")
    print("  " + "─" * 46)
    print(f"  Versión      {__version__} · Python + Flask")
    print(f"  Aplicación   http://localhost:{puerto}")
    print(f"  API          http://localhost:{puerto}{app.config['PREFIJO_API']}")
    print(f"  Modo         {'producción' if produccion else 'desarrollo'}")
    print()

    if produccion:
        from waitress import serve

        serve(app, host="0.0.0.0", port=puerto, threads=8)
    else:
        # `use_reloader` recarga al guardar, como hacía `nest start --watch`
        app.run(host="0.0.0.0", port=puerto, debug=True, use_reloader=True)


if __name__ == "__main__":
    main()
