"""
Compara la API de Python con la original en TypeScript.

Es la comprobación que exige el encargo: cada función portada debe producir el
mismo resultado que la aplicación original. En lugar de fiarse de la lectura
del código, se llama a ambas y se contrastan las respuestas.

Requiere el backend TypeScript en marcha (puerto 4000). La aplicación Python
se levanta en memoria, sin necesidad de otro proceso.

    .venv\\Scripts\\python herramientas\\comparar_api.py
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from aplicacion import crear_app
from aplicacion.extensiones import limitador

ORIGINAL = "http://localhost:4000/api/v1"
CORREO = "admin@datly.local"
CLAVE = "Admin123*"

# Campos que no pueden coincidir por naturaleza: identificadores de sesión,
# marcas de tiempo del momento de la respuesta y tokens.
VOLATILES = {"timestamp", "accessToken", "refreshToken", "lastLoginAt", "iat", "exp"}

diferencias = 0
comprobadas = 0


def normalizar(valor: Any) -> Any:
    """Quita lo que no puede ser igual entre dos ejecuciones distintas."""
    if isinstance(valor, dict):
        return {k: normalizar(v) for k, v in sorted(valor.items()) if k not in VOLATILES}
    if isinstance(valor, list):
        return [normalizar(v) for v in valor]
    return valor


def pedir_original(ruta: str, token: str | None, intentos: int = 4) -> tuple[int, Any]:
    """
    Llama al sistema original.

    El original limita las peticiones por minuto. Comparar decenas de rutas
    seguidas dispara ese límite, así que un 429 se espera y se reintenta: es
    el limitador haciendo su trabajo, no una diferencia de comportamiento.
    """
    for intento in range(intentos):
        peticion = urllib.request.Request(f"{ORIGINAL}{ruta}")
        if token:
            peticion.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(peticion, timeout=20) as respuesta:
                return respuesta.status, json.loads(respuesta.read())
        except urllib.error.HTTPError as error:
            if error.code == 429 and intento < intentos - 1:
                espera = 20 * (intento + 1)
                print(f"      (límite de peticiones: esperando {espera}s)")
                time.sleep(espera)
                continue
            return error.code, json.loads(error.read() or b"{}")
        except Exception as error:  # noqa: BLE001
            return 0, {"error": str(error)}
    return 0, {}


def entrar_original() -> str | None:
    datos = json.dumps({"email": CORREO, "password": CLAVE}).encode()
    peticion = urllib.request.Request(
        f"{ORIGINAL}/auth/login", data=datos, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(peticion, timeout=20) as respuesta:
            return json.loads(respuesta.read())["data"]["accessToken"]
    except Exception:  # noqa: BLE001
        return None


def comparar(etiqueta: str, ruta: str, cliente, token_py: str, token_ts: str | None) -> None:
    """Llama a las dos APIs y contrasta el resultado."""
    global diferencias, comprobadas
    comprobadas += 1

    estado_ts, cuerpo_ts = pedir_original(ruta, token_ts)

    respuesta = cliente.get(f"/api/v1{ruta}", headers={"Authorization": f"Bearer {token_py}"})
    estado_py, cuerpo_py = respuesta.status_code, respuesta.get_json()

    if estado_ts != estado_py:
        diferencias += 1
        print(f"  ✗ {etiqueta:<40}HTTP {estado_ts} (original) vs {estado_py} (Python)")
        return

    a, b = normalizar(cuerpo_ts), normalizar(cuerpo_py)
    if a == b:
        print(f"    {etiqueta:<40}idéntico  (HTTP {estado_py})")
        return

    diferencias += 1
    print(f"  ✗ {etiqueta:<40}difiere")
    _detallar(a, b)


def _detallar(a: Any, b: Any, camino: str = "", profundidad: int = 0) -> None:
    """Muestra en qué punto concreto difieren, sin volcar el JSON entero."""
    if profundidad > 4:
        return
    if isinstance(a, dict) and isinstance(b, dict):
        for clave in sorted(set(a) | set(b)):
            if clave not in a:
                print(f"      falta en original : {camino}{clave}")
            elif clave not in b:
                print(f"      falta en Python   : {camino}{clave}")
            else:
                _detallar(a[clave], b[clave], f"{camino}{clave}.", profundidad + 1)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            print(f"      {camino[:-1]}: {len(a)} elementos vs {len(b)}")
        elif a and b:
            _detallar(a[0], b[0], f"{camino}0.", profundidad + 1)
    elif a != b:
        print(f"      {camino[:-1]}: {str(a)[:50]!r} vs {str(b)[:50]!r}")


def main() -> int:
    print("\n  Python frente al sistema original")
    print("  " + "─" * 62)

    token_ts = entrar_original()
    if token_ts is None:
        print("  El backend TypeScript no responde en el puerto 4000.")
        print("  Arránquelo con:  npm --prefix backend run start:dev\n")
        return 2

    app = crear_app()
    limitador.enabled = False
    cliente = app.test_client()

    acceso = cliente.post(
        "/api/v1/auth/login", json={"email": CORREO, "password": CLAVE}
    ).get_json()
    token_py = (acceso.get("data") or {}).get("accessToken")
    if not token_py:
        print(f"  La aplicación Python no autenticó: {acceso}\n")
        return 1

    print(f"  Ambas sesiones abiertas como {CORREO}\n")

    rutas = [
        ("Perfil", "/auth/me"),
        ("Jornadas: listado", "/shifts?page=1&limit=10"),
        ("Jornadas: catálogo", "/shifts/options"),
        ("Jornadas: búsqueda", "/shifts?search=ma"),
        ("Jornadas: solo activas", "/shifts?status=ACTIVE"),
        ("Jornadas: orden por nombre", "/shifts?sortBy=name&sortOrder=asc"),
        ("Asignaturas: listado", "/subjects?page=1&limit=10"),
        ("Asignaturas: catálogo", "/subjects/options"),
        ("Asignaturas: búsqueda", "/subjects?search=cien"),
        ("Asignaturas: paginación", "/subjects?page=2&limit=3"),
        ("Asignaturas: código sugerido", "/subjects/next-code"),
    ]

    for etiqueta, ruta in rutas:
        comparar(etiqueta, ruta, cliente, token_py, token_ts)

    # El detalle exige un identificador real: se toma del listado
    listado = cliente.get(
        "/api/v1/subjects?page=1&limit=1", headers={"Authorization": f"Bearer {token_py}"}
    ).get_json()
    elementos = ((listado.get("data") or {}).get("items")) or []
    if elementos:
        comparar(
            "Asignaturas: detalle", f"/subjects/{elementos[0]['id']}", cliente, token_py, token_ts
        )

    print("\n  " + "─" * 62)
    if diferencias:
        print(f"  ✗ {diferencias} de {comprobadas} respuestas difieren.\n")
        return 1
    print(f"  ✓ Las {comprobadas} respuestas coinciden con el sistema original.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
