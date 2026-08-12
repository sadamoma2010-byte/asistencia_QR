"""
Salida de las herramientas por consola.

En Windows la consola usa cp1252, que no sabe escribir los caracteres de las
líneas y las marcas con las que se presentan los resultados. Sin esto, la
herramienta muere con un UnicodeEncodeError antes de decir nada útil.
"""

from __future__ import annotations

import sys


def preparar() -> None:
    """Deja stdout y stderr en UTF-8, sin romperse si el flujo no lo admite."""
    for flujo in (sys.stdout, sys.stderr):
        try:
            flujo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            # Salida redirigida a algo que no admite reconfiguración: se deja
            # como está, que es preferible a impedir la ejecución.
            pass
