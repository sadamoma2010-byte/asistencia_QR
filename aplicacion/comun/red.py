"""
Dirección del servidor en la red local.

El código QR lo escanean docentes con su teléfono, y un teléfono nunca puede
resolver `localhost`: esa palabra apunta al propio teléfono, no al equipo que
sirve la aplicación. Para que el QR funcione de verdad tiene que llevar la
dirección del servidor dentro de la red del centro.

Aquí se averigua esa dirección para poder sugerirla.
"""

from __future__ import annotations

import socket
from ipaddress import ip_address


def direccion_local() -> str | None:
    """
    Dirección del equipo en la red local, o None si no se puede determinar.

    Se abre un conector UDP hacia una dirección externa. No se envía nada: el
    sistema operativo elige la interfaz de salida y de ahí se lee la dirección
    real, que es más fiable que resolver el nombre del equipo.
    """
    conector = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        conector.settimeout(0.4)
        conector.connect(("8.8.8.8", 80))
        direccion = conector.getsockname()[0]
    except OSError:
        return None
    finally:
        conector.close()

    try:
        candidata = ip_address(direccion)
    except ValueError:
        return None

    # Una dirección de bucle no sirve para nada fuera del propio equipo
    if candidata.is_loopback:
        return None
    return direccion


def url_sugerida(puerto: int, ruta: str = "/marcar") -> str:
    """Dirección completa que debería llevar el QR."""
    anfitrion = direccion_local() or "localhost"
    return f"http://{anfitrion}:{puerto}{ruta}"


def es_alcanzable_desde_fuera(url: str) -> bool:
    """
    Comprueba si la dirección serviría desde otro dispositivo.

    `localhost` y `127.0.0.1` solo funcionan en el propio equipo: un QR con esa
    dirección se escanea sin problema, pero el teléfono no llega a ninguna parte.
    """
    if not url:
        return False
    minuscula = url.lower()
    return not any(x in minuscula for x in ("localhost", "127.0.0.1", "[::1]"))
