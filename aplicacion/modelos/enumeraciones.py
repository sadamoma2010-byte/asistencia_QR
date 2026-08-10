"""
Enumeraciones del dominio.

Sustituye a `common/enums.ts`. Los valores coinciden exactamente con las
etiquetas de los tipos ENUM nativos que ya existen en PostgreSQL, así que
SQLAlchemy lee y escribe sin necesidad de conversión alguna.

Heredan de `str` para que se serialicen solas al convertir a JSON, igual que
hacía Prisma.
"""

from __future__ import annotations

from enum import Enum


class EstadoRegistro(str, Enum):
    """Tipo `record_status`."""

    ACTIVO = "ACTIVE"
    INACTIVO = "INACTIVE"


class TipoMarcacion(str, Enum):
    """Tipo `attendance_type`."""

    ENTRADA = "CHECK_IN"
    SALIDA = "CHECK_OUT"


class EstadoMarcacion(str, Enum):
    """Tipo `attendance_status`."""

    PUNTUAL = "ON_TIME"          # RN008
    TARDE = "LATE"               # RN007
    SALIDA_ANTICIPADA = "EARLY_DEPARTURE"


class AccionAuditoria(str, Enum):
    """Tipo `audit_action`."""

    CREAR = "CREATE"
    ACTUALIZAR = "UPDATE"
    ELIMINAR = "DELETE"
    ACTIVAR = "ACTIVATE"
    DESACTIVAR = "DEACTIVATE"
    ENTRAR = "LOGIN"
    SALIR = "LOGOUT"
    ASISTENCIA = "ATTENDANCE"


class TipoAjuste(str, Enum):
    """Tipo `setting_type`."""

    TEXTO = "STRING"
    NUMERO = "NUMBER"
    BOOLEANO = "BOOLEAN"
    JSON = "JSON"


# ── Etiquetas en español, para la interfaz y las exportaciones ──────
# Se indexan por el valor almacenado, no por el miembro, porque es lo que
# llega desde la base y desde los parámetros de consulta.

ETIQUETA_ESTADO_MARCACION = {
    "ON_TIME": "Puntual",
    "LATE": "Tarde",
    "EARLY_DEPARTURE": "Salida anticipada",
}

ETIQUETA_TIPO_MARCACION = {
    "CHECK_IN": "Entrada",
    "CHECK_OUT": "Salida",
}

ETIQUETA_ACCION_AUDITORIA = {
    "CREATE": "Creación",
    "UPDATE": "Actualización",
    "DELETE": "Eliminación",
    "ACTIVATE": "Activación",
    "DEACTIVATE": "Inactivación",
    "LOGIN": "Inicio de sesión",
    "LOGOUT": "Cierre de sesión",
    "ATTENDANCE": "Asistencia",
}

ETIQUETA_ESTADO_REGISTRO = {
    "ACTIVE": "Activo",
    "INACTIVE": "Inactivo",
}
