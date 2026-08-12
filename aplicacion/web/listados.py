"""
Definición de las pantallas de listado.

Las diez pantallas comparten estructura: filtros arriba, tabla en escritorio,
tarjetas en móvil y paginación abajo. Aquí se describe qué cambia en cada una
—columnas, filtros y acciones— y una sola plantilla las pinta todas.

Los datos se piden a la API ya verificada, no se vuelven a consultar aquí: así
la pantalla y cualquier otro consumidor ven exactamente lo mismo.
"""

from __future__ import annotations

from typing import Any

from ..comun.seguridad import usuario_actual
from ..modelos.acceso import ROL_CONTROL_TOTAL


def _columna(campo: str, etiqueta: str, **extra: Any) -> dict:
    return {"campo": campo, "etiqueta": etiqueta, **extra}


DEFINICIONES: dict[str, dict] = {
    "docentes": {
        "recurso": "teachers",
        "titulo": "Docentes",
        "descripcion": "Administre la información de los docentes y su vínculo con las cuentas de acceso.",
        "singular": "docente",
        "permiso": "teachers",
        "ordenar": "lastName",
        "columnas": [
            _columna("docente", "Docente", tipo="docente", ordenable="lastName"),
            _columna("code", "Código", tipo="insignia", ordenable="code"),
            _columna("document", "Documento", ordenable="document"),
            _columna("subjects", "Asignaturas", tipo="asignaturas"),
            _columna("_count.schedules", "Horarios", tipo="contador"),
            _columna("status", "Estado", tipo="estado", ordenable="status"),
        ],
        "filtros": [
            {"tipo": "busqueda", "campo": "search", "texto": "Buscar por código, nombre o documento"},
            {"tipo": "estado"},
            {"tipo": "catalogo", "campo": "shiftId", "recurso": "shifts", "texto": "Todas las jornadas"},
        ],
    },
    "asignaturas": {
        "recurso": "subjects",
        "titulo": "Asignaturas",
        "descripcion": "Cree las materias de la institución y asigne qué docentes las dictan.",
        "singular": "asignatura",
        "permiso": "subjects",
        "ordenar": "name",
        "columnas": [
            _columna("asignatura", "Asignatura", tipo="asignatura", ordenable="name"),
            _columna("description", "Descripción", tipo="texto"),
            _columna("weeklyHours", "Horas/semana", tipo="horas", ordenable="weeklyHours"),
            _columna("_count.teachers", "Docentes", tipo="contador"),
            _columna("_count.schedules", "Horarios", tipo="contador"),
            _columna("status", "Estado", tipo="estado", ordenable="status"),
        ],
        "filtros": [
            {"tipo": "busqueda", "campo": "search", "texto": "Buscar por código, nombre o descripción"},
            {"tipo": "estado"},
            {"tipo": "catalogo", "campo": "teacherId", "recurso": "teachers", "texto": "Todos los docentes"},
        ],
    },
    "jornadas": {
        "recurso": "shifts",
        "titulo": "Jornadas",
        "descripcion": "Franjas institucionales sobre las que se arman los horarios.",
        "singular": "jornada",
        "permiso": "shifts",
        "ordenar": "name",
        "columnas": [
            _columna("name", "Jornada", tipo="destacado", ordenable="name"),
            _columna("description", "Descripción", tipo="texto"),
            _columna("_count.schedules", "Horarios", tipo="contador"),
            _columna("status", "Estado", tipo="estado", ordenable="status"),
        ],
        "filtros": [
            {"tipo": "busqueda", "campo": "search", "texto": "Buscar por nombre o descripción"},
            {"tipo": "estado"},
        ],
    },
    "horarios": {
        "recurso": "schedules",
        "titulo": "Horarios",
        "descripcion": "Franja de trabajo de cada docente: contra ella se mide la puntualidad.",
        "singular": "horario",
        "permiso": "schedules",
        "ordenar": "dayOfWeek",
        "columnas": [
            _columna("teacher", "Docente", tipo="docente_anidado"),
            _columna("shift.name", "Jornada", tipo="anidado"),
            _columna("subject", "Asignatura", tipo="asignatura_anidada"),
            _columna("dayName", "Día", ordenable="dayOfWeek"),
            _columna("horas", "Horario", tipo="horas_rango", ordenable="checkInTime"),
            _columna("toleranceMinutes", "Tolerancia", tipo="minutos"),
            _columna("status", "Estado", tipo="estado", ordenable="status"),
        ],
        "filtros": [
            {"tipo": "busqueda", "campo": "search", "texto": "Buscar por docente, jornada o asignatura"},
            {"tipo": "catalogo", "campo": "teacherId", "recurso": "teachers", "texto": "Todos los docentes"},
            {"tipo": "catalogo", "campo": "shiftId", "recurso": "shifts", "texto": "Todas las jornadas"},
            {"tipo": "estado"},
        ],
    },
    "asistencia": {
        "recurso": "attendance",
        "titulo": "Asistencia",
        "descripcion": "Consulte, filtre y exporte las marcaciones registradas.",
        "singular": "marcación",
        "permiso": "attendance",
        "ordenar": "registeredAt",
        "solo_lectura": True,
        # Selección por casillas para el borrado múltiple, reservado al
        # SUPER_ADMIN. Aquí se eliminan marcaciones concretas.
        "borrado": {
            "ruta": "/attendance/bulk-delete",
            "campo": "ids",
            "clave_fila": "id",
            "titulo": "Eliminar marcaciones",
            "unidad": "marcación",
            "unidades": "marcaciones",
        },
        "columnas": [
            _columna("teacher", "Docente", tipo="docente_anidado"),
            _columna("date", "Fecha", tipo="fecha", ordenable="date"),
            _columna("registeredAt", "Hora", tipo="hora", ordenable="registeredAt"),
            _columna("type", "Tipo", tipo="tipo_marcacion", ordenable="type"),
            _columna("status", "Estado", tipo="estado_marcacion", ordenable="status"),
            _columna("expectedTime", "Esperada", tipo="texto"),
            _columna("minutesDiff", "Diferencia", tipo="diferencia", ordenable="minutesDiff"),
        ],
        "filtros": [
            {"tipo": "busqueda", "campo": "search", "texto": "Buscar por docente"},
            {"tipo": "catalogo", "campo": "teacherId", "recurso": "teachers", "texto": "Todos los docentes"},
            {"tipo": "opciones", "campo": "type", "texto": "Entradas y salidas",
             "opciones": [("CHECK_IN", "Entradas"), ("CHECK_OUT", "Salidas")]},
            {"tipo": "opciones", "campo": "status", "texto": "Todos los estados",
             "opciones": [("ON_TIME", "Puntual"), ("LATE", "Tarde"),
                          ("EARLY_DEPARTURE", "Salida anticipada")]},
            {"tipo": "fecha", "campo": "dateFrom", "texto": "Desde"},
            {"tipo": "fecha", "campo": "dateTo", "texto": "Hasta"},
        ],
    },
    "reportes": {
        "recurso": "reports/attendance",
        "titulo": "Reportes",
        "descripcion": "Resumen consolidado de asistencia por docente.",
        "singular": "docente",
        "permiso": "reports",
        "solo_lectura": True,
        "sin_ordenar": True,
        # Aquí cada fila es un docente, no una marcación: al eliminar se borran
        # todas sus marcaciones del periodo que muestren los filtros.
        "borrado": {
            "ruta": "/attendance/delete-by-teacher",
            "campo": "teacherIds",
            "clave_fila": "teacherId",
            "titulo": "Eliminar marcaciones de los docentes seleccionados",
            "unidad": "docente",
            "unidades": "docentes",
            "con_periodo": True,
        },
        "exportaciones": [
            ("/reports/export", "Resumen"),
            ("/reports/export/detail", "Detalle"),
        ],
        "columnas": [
            _columna("code", "Código", tipo="insignia"),
            _columna("fullName", "Docente", tipo="destacado"),
            _columna("shifts", "Jornadas", tipo="texto"),
            _columna("totalRecords", "Marcaciones", tipo="contador"),
            _columna("onTime", "Puntuales", tipo="contador_exito"),
            _columna("late", "Tardanzas", tipo="contador_alerta"),
            _columna("totalLateMinutes", "Minutos", tipo="minutos"),
            _columna("punctualityRate", "Puntualidad", tipo="porcentaje"),
        ],
        "filtros": [
            {"tipo": "catalogo", "campo": "teacherId", "recurso": "teachers", "texto": "Todos los docentes"},
            {"tipo": "catalogo", "campo": "shiftId", "recurso": "shifts", "texto": "Todas las jornadas"},
            {"tipo": "fecha", "campo": "dateFrom", "texto": "Desde"},
            {"tipo": "fecha", "campo": "dateTo", "texto": "Hasta"},
        ],
    },
    "usuarios": {
        "recurso": "users",
        "titulo": "Usuarios",
        "descripcion": "Cuentas de acceso al sistema y su rol.",
        "singular": "usuario",
        "permiso": "users",
        "ordenar": "lastName",
        "columnas": [
            _columna("usuario", "Usuario", tipo="usuario"),
            _columna("document", "Documento", ordenable="document"),
            _columna("role.name", "Rol", tipo="insignia_anidada"),
            _columna("lastLoginAt", "Último acceso", tipo="fecha_hora"),
            _columna("status", "Estado", tipo="estado", ordenable="status"),
        ],
        "filtros": [
            {"tipo": "busqueda", "campo": "search", "texto": "Buscar por nombre, correo o documento"},
            {"tipo": "catalogo", "campo": "roleId", "recurso": "roles", "texto": "Todos los roles"},
            {"tipo": "estado"},
        ],
    },
    "roles": {
        "recurso": "roles",
        "titulo": "Roles",
        "descripcion": "Perfiles de acceso y los permisos que conceden.",
        "singular": "rol",
        "permiso": "roles",
        "ordenar": "name",
        "columnas": [
            _columna("name", "Rol", tipo="destacado", ordenable="name"),
            _columna("code", "Identificador", tipo="codigo"),
            _columna("description", "Descripción", tipo="texto"),
            _columna("_count.users", "Usuarios", tipo="contador"),
            _columna("_count.permissions", "Permisos", tipo="contador"),
            _columna("isSystem", "Del sistema", tipo="si_no"),
            _columna("status", "Estado", tipo="estado", ordenable="status"),
        ],
        "filtros": [
            {"tipo": "busqueda", "campo": "search", "texto": "Buscar por nombre o descripción"},
            {"tipo": "estado"},
        ],
    },
    "permisos": {
        "recurso": "permissions",
        "titulo": "Permisos",
        "descripcion": "Catálogo de capacidades granulares del sistema.",
        "singular": "permiso",
        "permiso": "permissions",
        "ordenar": "module",
        "columnas": [
            _columna("code", "Código", tipo="codigo", ordenable="code"),
            _columna("name", "Permiso", tipo="destacado", ordenable="name"),
            _columna("module", "Módulo", tipo="insignia", ordenable="module"),
            _columna("_count.roles", "Roles", tipo="contador"),
            _columna("isSystem", "Del sistema", tipo="si_no"),
            _columna("status", "Estado", tipo="estado", ordenable="status"),
        ],
        "filtros": [
            {"tipo": "busqueda", "campo": "search", "texto": "Buscar por código, nombre o módulo"},
            {"tipo": "estado"},
        ],
    },
    "auditoria": {
        "recurso": "audit",
        "titulo": "Auditoría",
        "descripcion": "Trazabilidad completa: usuario, acción, fecha, hora, IP y dispositivo (RN009).",
        "singular": "registro",
        "permiso": "audit",
        "solo_lectura": True,
        "ordenar": "createdAt",
        "columnas": [
            _columna("evento", "Evento", tipo="evento"),
            _columna("action", "Acción", tipo="accion", ordenable="action"),
            _columna("module", "Módulo", tipo="insignia", ordenable="module"),
            _columna("createdAt", "Fecha y hora", tipo="fecha_hora", ordenable="createdAt"),
            _columna("ipAddress", "IP", tipo="texto"),
        ],
        "filtros": [
            {"tipo": "busqueda", "campo": "search", "texto": "Buscar por descripción, usuario o módulo"},
            {"tipo": "fecha", "campo": "dateFrom", "texto": "Desde"},
            {"tipo": "fecha", "campo": "dateTo", "texto": "Hasta"},
            {"tipo": "opciones", "campo": "action", "texto": "Todas las acciones",
             "opciones": [("CREATE", "Creación"), ("UPDATE", "Actualización"),
                          ("DELETE", "Eliminación"), ("ACTIVATE", "Activación"),
                          ("DEACTIVATE", "Inactivación"), ("LOGIN", "Inicio de sesión"),
                          ("LOGOUT", "Cierre de sesión"), ("ATTENDANCE", "Asistencia")]},
        ],
    },
}


def construir(nombre: str) -> dict:
    """Definición de la pantalla, con las acciones que el usuario puede ejecutar."""
    from . import formularios

    definicion = dict(DEFINICIONES[nombre])
    usuario = usuario_actual()
    permiso = definicion["permiso"]

    definicion["nombre"] = nombre
    definicion["formulario"] = formularios.para(nombre)
    # Sin formulario declarado no se ofrece alta ni edición: el botón llevaría
    # a una pantalla que no existe.
    tiene_formulario = definicion["formulario"] is not None

    definicion["puede"] = {
        "crear": tiene_formulario
        and bool(usuario and usuario.tiene(f"{permiso}.create"))
        and not definicion.get("solo_lectura"),
        "editar": tiene_formulario
        and bool(usuario and usuario.tiene(f"{permiso}.update"))
        and not definicion.get("solo_lectura"),
        "reiniciar_clave": nombre == "usuarios"
        and bool(usuario and usuario.tiene("users.reset-password")),
        "eliminar": bool(usuario and usuario.tiene(f"{permiso}.delete"))
        and not definicion.get("solo_lectura"),
        "activar": bool(usuario and usuario.tiene(f"{permiso}.activate"))
        and not definicion.get("solo_lectura"),
        "exportar": bool(usuario and usuario.tiene(f"{permiso}.export")),
        # El borrado múltiple de marcaciones está reservado al SUPER_ADMIN.
        # No basta con tener el permiso: el rol es una segunda barrera, y el
        # servidor la vuelve a comprobar aunque aquí se dijera que sí.
        "borrado_multiple": bool(
            definicion.get("borrado") and usuario and usuario.rol_codigo == ROL_CONTROL_TOTAL
        ),
    }
    return definicion
