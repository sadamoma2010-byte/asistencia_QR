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
from urllib.parse import quote

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


def _ordenar_listas(valor: Any) -> Any:
    """
    Ordena las listas por su contenido, para comparar conjuntos.

    Se usa donde el sistema original no define ningún orden: relaciones sin
    `orderBy` y listados cuya clave de orden tiene empates. Ahí dos ejecuciones
    del propio original pueden devolver órdenes distintos, así que exigir el
    mismo orden sería exigir algo que ni él garantiza. Lo que sí debe coincidir
    es el conjunto de datos.
    """
    if isinstance(valor, dict):
        return {k: _ordenar_listas(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return sorted(
            (_ordenar_listas(v) for v in valor), key=lambda x: json.dumps(x, sort_keys=True)
        )
    return valor


def comparar(
    etiqueta: str,
    ruta: str,
    cliente,
    token_py: str,
    token_ts: str | None,
    orden_indiferente: bool = False,
) -> None:
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

    if orden_indiferente and _ordenar_listas(a) == _ordenar_listas(b):
        print(f"    {etiqueta:<40}mismos datos, orden de empates distinto")
        return

    diferencias += 1
    print(f"  ✗ {etiqueta:<40}difiere")
    _detallar(a, b)


def _detallar(a: Any, b: Any, camino: str = "", profundidad: int = 0) -> None:
    """Muestra en qué punto concreto difieren, sin volcar el JSON entero."""
    if profundidad > 8:
        print(f"      {camino[:-1]}: difiere por debajo del nivel mostrado")
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
            return
        # Solo se detallan los índices que realmente difieren
        for indice, (x, y) in enumerate(zip(a, b)):
            if x != y:
                _detallar(x, y, f"{camino}{indice}.", profundidad + 1)
    elif a != b:
        print(f"      {camino[:-1]}: {str(a)[:60]!r} vs {str(b)[:60]!r}")


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

    # El tercer valor marca las rutas donde el original no define el orden:
    # relaciones sin `orderBy` o claves de orden con empates.
    rutas = [
        ("Perfil", "/auth/me", False),
        ("Usuarios: listado", "/users?page=1&limit=10", False),
        ("Usuarios: búsqueda", "/users?search=a", False),
        ("Usuarios: orden por correo", "/users?sortBy=email&sortOrder=asc", False),
        ("Roles: listado", "/roles?page=1&limit=10", False),
        ("Roles: catálogo", "/roles/options", False),
        ("Permisos: listado", "/permissions?page=1&limit=20", False),
        ("Permisos: agrupados", "/permissions/grouped", False),
        ("Permisos: módulos", "/permissions/modules", False),
        ("Docentes: listado", "/teachers?page=1&limit=10", True),
        ("Docentes: catálogo", "/teachers/options", False),
        ("Docentes: búsqueda", "/teachers?search=a", True),
        ("Docentes: código sugerido", "/teachers/next-code", False),
        ("Jornadas: listado", "/shifts?page=1&limit=10", False),
        ("Jornadas: catálogo", "/shifts/options", False),
        ("Jornadas: búsqueda", "/shifts?search=ma", False),
        ("Jornadas: solo activas", "/shifts?status=ACTIVE", False),
        ("Jornadas: orden por nombre", "/shifts?sortBy=name&sortOrder=asc", False),
        ("Asignaturas: listado", "/subjects?page=1&limit=10", False),
        ("Asignaturas: catálogo", "/subjects/options", False),
        ("Asignaturas: búsqueda", "/subjects?search=cien", False),
        ("Asignaturas: paginación", "/subjects?page=2&limit=3", False),
        ("Asignaturas: código sugerido", "/subjects/next-code", False),
        ("Horarios: listado", "/schedules?page=1&limit=10", True),
        ("Horarios: por hora de entrada", "/schedules?sortBy=checkInTime&sortOrder=asc", True),
        ("Asistencia: listado", "/attendance?page=1&limit=10", False),
        ("Asistencia: por tipo", "/attendance?type=CHECK_IN", False),
        ("Asistencia: por estado", "/attendance?status=ON_TIME", False),
        ("Asistencia: por fechas", "/attendance?dateFrom=2026-08-01&dateTo=2026-08-31", False),
        ("Auditoría: listado", "/audit?page=1&limit=10", False),
        ("Auditoría: módulos", "/audit/modules", False),
        ("Auditoría: por acción", "/audit?action=LOGIN&limit=5", False),
        ("Auditoría: búsqueda", "/audit?search=" + quote("sesión") + "&limit=5", False),
        ("Configuración: listado", "/settings", False),
        ("Configuración: públicos", "/settings/public", False),
        ("Configuración: QR", "/settings/qr", False),
        ("Reportes: panel", "/reports/dashboard", False),
        ("Reportes: por docente", "/reports/attendance?page=1&limit=10", False),
    ]

    for etiqueta, ruta, indiferente in rutas:
        comparar(etiqueta, ruta, cliente, token_py, token_ts, indiferente)

    # Los detalles exigen identificadores reales: se toman de los listados
    for etiqueta, coleccion, indiferente in (
        ("Asignaturas: detalle", "subjects", True),
        ("Docentes: detalle", "teachers", True),
        ("Roles: detalle", "roles", True),
        ("Horarios: detalle", "schedules", False),
    ):
        listado = cliente.get(
            f"/api/v1/{coleccion}?page=1&limit=1",
            headers={"Authorization": f"Bearer {token_py}"},
        ).get_json()
        elementos = ((listado.get("data") or {}).get("items")) or []
        if elementos:
            comparar(
                etiqueta,
                f"/{coleccion}/{elementos[0]['id']}",
                cliente,
                token_py,
                token_ts,
                indiferente,
            )

    print("\n  " + "─" * 62)
    if diferencias:
        print(f"  ✗ {diferencias} de {comprobadas} respuestas difieren.\n")
        return 1
    print(f"  ✓ Las {comprobadas} respuestas coinciden con el sistema original.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
