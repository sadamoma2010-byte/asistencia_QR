"""
Modelos de datos.

Sustituye a `backend/prisma/schema.prisma` y al cliente generado por Prisma.

Los 13 modelos se mapean contra las tablas que ya existen en PostgreSQL. No se
crean ni se alteran estructuras: `database.sql` sigue siendo la única fuente
de la definición de la base.
"""

from .academico import Asignatura, Docente, DocenteAsignatura, Horario, Jornada
from .acceso import Permiso, Rol, RolPermiso, SesionRefresco, Usuario
from .base import BorradoLogico, ConEstado, MarcasTiempo, nuevo_id
from .enumeraciones import (
    ETIQUETA_ACCION_AUDITORIA,
    ETIQUETA_ESTADO_MARCACION,
    ETIQUETA_ESTADO_REGISTRO,
    ETIQUETA_TIPO_MARCACION,
    AccionAuditoria,
    EstadoMarcacion,
    EstadoRegistro,
    TipoAjuste,
    TipoMarcacion,
)
from .operacion import Ajuste, Auditoria, Marcacion

__all__ = [
    # Acceso
    "Usuario",
    "SesionRefresco",
    "Rol",
    "Permiso",
    "RolPermiso",
    # Académico
    "Docente",
    "Asignatura",
    "DocenteAsignatura",
    "Jornada",
    "Horario",
    # Operación
    "Marcacion",
    "Auditoria",
    "Ajuste",
    # Enumeraciones
    "EstadoRegistro",
    "TipoMarcacion",
    "EstadoMarcacion",
    "AccionAuditoria",
    "TipoAjuste",
    "ETIQUETA_ESTADO_MARCACION",
    "ETIQUETA_TIPO_MARCACION",
    "ETIQUETA_ACCION_AUDITORIA",
    "ETIQUETA_ESTADO_REGISTRO",
    # Base
    "MarcasTiempo",
    "BorradoLogico",
    "ConEstado",
    "nuevo_id",
]
