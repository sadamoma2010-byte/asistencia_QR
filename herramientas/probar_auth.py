"""
Prueba del módulo de autenticación portado a Python.

Comprueba lo más delicado del cambio de lenguaje: que los hashes bcrypt que
generó Node siguen siendo válidos leídos desde Python, y que el ciclo de
sesión completo se comporta igual que en el sistema original.

    .venv\\Scripts\\python herramientas\\probar_auth.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from flask import Flask

from aplicacion.comun.errores import registrar_manejadores
from aplicacion.config import obtener_config
from aplicacion.extensiones import bd, limitador
from aplicacion.modulos.auth.rutas import bp as bp_auth

CORREO = "admin@datly.local"
CLAVE = "Admin123*"

fallos = 0


def comprobar(etiqueta: str, obtenido, esperado=None, bien: bool | None = None) -> None:
    global fallos
    correcto = bien if bien is not None else (obtenido == esperado)
    if not correcto:
        fallos += 1
    marca = " " if correcto else "✗"
    print(f"  {marca} {etiqueta:<44}{obtenido}")


def crear() -> Flask:
    ajustes = obtener_config()
    app = Flask(__name__)
    app.config.from_object(ajustes)
    app.config["PREFIJO_API"] = ajustes.PREFIJO_API
    bd.init_app(app)
    limitador.init_app(app)
    # El límite de intentos estorba en una prueba automatizada
    limitador.enabled = False
    app.register_blueprint(bp_auth, url_prefix=ajustes.PREFIJO_API)
    registrar_manejadores(app)
    return app


def main() -> int:
    app = crear()
    cliente = app.test_client()
    base = app.config["PREFIJO_API"]

    print("\n  Autenticación portada a Python")
    print("  " + "─" * 56)

    # ── Credenciales correctas ───────────────────────────────────────
    r = cliente.post(f"{base}/auth/login", json={"email": CORREO, "password": CLAVE})
    cuerpo = r.get_json()
    comprobar("Login con credenciales correctas", f"HTTP {r.status_code}", "HTTP 200")
    comprobar("El sobre de respuesta", str(cuerpo.get("success")), "True")

    datos = cuerpo.get("data") or {}
    usuario = datos.get("user") or {}
    comprobar("Hash bcrypt de Node aceptado", "sí" if datos.get("accessToken") else "NO", "sí")
    comprobar("Usuario devuelto", usuario.get("fullName"), "Super Admin")
    rol = usuario.get("role") or {}
    comprobar("Rol (identificador interno)", rol.get("code"), "SUPER_ADMIN")
    comprobar("Rol (nombre visible)", bool(rol.get("name")), bien=bool(rol.get("name")))
    comprobar("Permisos cargados", len(usuario.get("permissions", [])), bien=len(usuario.get("permissions", [])) > 50)
    comprobar("Vigencia del token", datos.get("expiresIn"), "15m")

    acceso = datos.get("accessToken")
    refresco = datos.get("refreshToken")
    cabecera = {"Authorization": f"Bearer {acceso}"}

    # ── Credenciales incorrectas ─────────────────────────────────────
    r = cliente.post(f"{base}/auth/login", json={"email": CORREO, "password": "ClaveQueNoEs1*"})
    comprobar("Contraseña incorrecta rechazada", f"HTTP {r.status_code}", "HTTP 401")
    comprobar("Mensaje uniforme", r.get_json().get("message"), "Credenciales incorrectas")

    r = cliente.post(f"{base}/auth/login", json={"email": "nadie@datly.local", "password": "x"})
    comprobar("Correo inexistente: mismo mensaje", r.get_json().get("message"), "Credenciales incorrectas")

    # ── Validación de entrada ────────────────────────────────────────
    r = cliente.post(f"{base}/auth/login", json={"email": "esto-no-es-un-correo", "password": "x"})
    comprobar("Correo mal formado rechazado", f"HTTP {r.status_code}", "HTTP 400")

    r = cliente.post(f"{base}/auth/login", json={"email": CORREO, "password": CLAVE, "extra": 1})
    comprobar("Campo no declarado rechazado", f"HTTP {r.status_code}", "HTTP 400")

    # ── Perfil con token ─────────────────────────────────────────────
    r = cliente.get(f"{base}/auth/me", headers=cabecera)
    comprobar("Perfil con token válido", f"HTTP {r.status_code}", "HTTP 200")
    comprobar("Correo del perfil", (r.get_json().get("data") or {}).get("email"), CORREO)

    # Cliente aparte: el primero conserva la cookie de sesión del navegador,
    # que es una vía de acceso legítima para las páginas HTML.
    anonimo = app.test_client()
    r = anonimo.get(f"{base}/auth/me")
    comprobar("Perfil sin sesión rechazado", f"HTTP {r.status_code}", "HTTP 401")

    r = anonimo.get(f"{base}/auth/me", headers={"Authorization": "Bearer no-es-un-token"})
    comprobar("Token inventado rechazado", f"HTTP {r.status_code}", "HTTP 401")

    # ── Refresco con rotación ────────────────────────────────────────
    # Sin cookie, para que el token venga solo del cuerpo de la petición
    r = anonimo.post(f"{base}/auth/refresh", json={"refreshToken": refresco})
    comprobar("Refresco de sesión", f"HTTP {r.status_code}", "HTTP 200")
    nuevo = (r.get_json().get("data") or {}).get("refreshToken")
    comprobar("Se emite un token distinto", "sí" if nuevo and nuevo != refresco else "NO", "sí")

    otro = app.test_client()
    r = otro.post(f"{base}/auth/refresh", json={"refreshToken": refresco})
    comprobar("El token usado queda revocado", f"HTTP {r.status_code}", "HTTP 401")

    r = otro.post(f"{base}/auth/refresh", json={"refreshToken": nuevo})
    comprobar("El token nuevo sí sirve", f"HTTP {r.status_code}", "HTTP 200")

    # ── Cierre de sesión ─────────────────────────────────────────────
    r = cliente.post(f"{base}/auth/logout", headers=cabecera)
    comprobar("Cierre de sesión", f"HTTP {r.status_code}", "HTTP 200")

    print("  " + "─" * 56)
    if fallos:
        print(f"  ✗ {fallos} comprobación(es) fallaron.\n")
        return 1
    print("  ✓ Todas las comprobaciones pasaron.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
