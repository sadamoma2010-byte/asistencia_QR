"""
Contexto de la petición para la auditoría.

Sustituye a `common/utils/request.util.ts`. Las etiquetas de dispositivo deben
coincidir carácter a carácter con las que ya hay en la bitácora, para que el
histórico y los registros nuevos se lean igual.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from flask import request


@dataclass(frozen=True)
class ContextoPeticion:
    """Equivale a `RequestContext`."""

    ip: str | None = None
    agente: str | None = None
    dispositivo: str | None = None


def detectar_dispositivo(agente: str) -> str:
    """Etiqueta legible del dispositivo a partir del user agent."""
    ua = agente.lower()

    if "iphone" in ua:
        plataforma = "iPhone"
    elif "ipad" in ua:
        plataforma = "iPad"
    elif "android" in ua:
        plataforma = "Android"
    elif "windows" in ua:
        plataforma = "Windows"
    elif "mac os" in ua:
        plataforma = "macOS"
    elif "linux" in ua:
        plataforma = "Linux"
    else:
        plataforma = "Desconocido"

    if "edg/" in ua:
        navegador = "Edge"
    elif "chrome" in ua and "edg/" not in ua:
        navegador = "Chrome"
    elif "firefox" in ua:
        navegador = "Firefox"
    elif "safari" in ua:
        navegador = "Safari"
    else:
        navegador = "Navegador"

    if re.search(r"mobile|iphone|android", ua):
        clase = "Móvil"
    elif re.search(r"ipad|tablet", ua):
        clase = "Tablet"
    else:
        clase = "Escritorio"

    return f"{clase} · {plataforma} · {navegador}"[:120]


def contexto() -> ContextoPeticion:
    """Extrae IP, agente y dispositivo de la petición en curso."""
    reenviada = request.headers.get("X-Forwarded-For")
    ip = reenviada.split(",")[0].strip() if reenviada else request.remote_addr

    agente = request.headers.get("User-Agent")

    return ContextoPeticion(
        # `::ffff:` es el prefijo de las direcciones IPv4 mapeadas sobre IPv6
        ip=ip.replace("::ffff:", "")[:60] if ip else None,
        agente=agente[:400] if agente else None,
        dispositivo=detectar_dispositivo(agente) if agente else None,
    )
