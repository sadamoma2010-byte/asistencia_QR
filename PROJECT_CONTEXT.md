# CONTEXTO COMPLETO DEL PROYECTO — Sistema de Asistencia Docente por QR

Este archivo contiene toda la información necesaria para entender el proyecto sin leer archivo por archivo.
Leerlo antes de cualquier modificación es **obligatorio**.

---

## 1. RESUMEN GENERAL

- **Nombre**: Sistema Web de Asistencia Docente por QR
- **Versión actual**: 3.7.0
- **Stack**: Python 3.x + Flask + SQLAlchemy 2.0 + PostgreSQL + Jinja2 + Tailwind CSS 3.x + JavaScript vanilla
- **Despliegue**: Render.com (free tier) con PostgreSQL
- **Origen**: Migrado desde un sistema NestJS + Prisma + React (los comentarios referencian los archivos originales)
- **Propósito**: Control de asistencia docente mediante escaneo de código QR con geolocalización

---

## 2. ESTRUCTURA DE ARCHIVOS

```
ASISTENCIA_QR_2026_SENA/
├── servidor.py                    # Punto de entrada: crea app Flask, sirve en dev/producción
├── init_db.py                     # Inicializa la BD ejecutando database.sql
├── database.sql                   # Esquema completo de PostgreSQL (tablas, datos iniciales, vistas, funciones)
├── .env / .env.example            # Variables de entorno (BD, JWT, CORS, timezone)
├── requirements.txt               # Dependencias de Python
├── render.yaml                    # Configuración de despliegue en Render.com
├── tailwind.config.js             # Configuración de Tailwind CSS
├── package.json                   # Solo para Tailwind CLI
├── build.sh                       # Script de build para Render
├── uploads/                       # Fotos legacy (migradas a BD en v3.4)
│
├── aplicacion/
│   ├── __init__.py                # Fábrica de Flask: crear_app() — registra blueprints, CORS, headers
│   ├── config.py                  # Configuración desde .env: Config, Desarrollo, Produccion
│   ├── extensiones.py             # SQLAlchemy (bd) y Flask-Limiter (limitador) — instancias globales
│   │
│   ├── modelos/                   # Modelos SQLAlchemy 2.0 (13 modelos, 6 enums)
│   │   ├── __init__.py            # Re-exporta todos los modelos y enums
│   │   ├── base.py                # Mixins: MarcasTiempo, BorradoLogico, ConEstado; utils: nuevo_id(), columna_uuid(), enum_sql()
│   │   ├── enumeraciones.py       # Enums: EstadoRegistro, TipoMarcacion, EstadoMarcacion, AccionAuditoria, TipoAjuste, NivelEducativo + etiquetas español
│   │   ├── acceso.py              # Rol, Permiso, RolPermiso, Usuario, SesionRefresco
│   │   ├── academico.py           # Asignatura, Docente, DocenteAsignatura, Grado, Curso, DocenteCurso, Jornada, Horario
│   │   └── operacion.py           # Marcacion, Auditoria, Ajuste
│   │
│   ├── comun/                     # Utilidades compartidas
│   │   ├── errores.py             # Excepciones HTTP: SolicitudInvalida(400), NoAutorizado(401), Prohibido(403), NoEncontrado(404), Conflicto(409) + manejadores globales
│   │   ├── respuestas.py          # Formato JSON: responder(), responder_error(), resultado_paginado()
│   │   ├── seguridad.py           # JWT, bcrypt, decoradores: @requiere_permisos, @requiere_roles, usuario_actual(), exigir_usuario()
│   │   ├── peticion.py            # ContextoPeticion: IP, user-agent, dispositivo detectado
│   │   ├── tiempo.py              # Funciones de fecha/hora: ahora(), clave_fecha(), clave_hora(), diferencia_minutos(), dia_semana(), iso()
│   │   ├── consultas.py           # Paginacion, aplicar_orden(), aplicar_busqueda(), paginar()
│   │   ├── auditoria.py           # Funcion anotar() para registrar en audit_logs
│   │   ├── crud.py                # CRUD genérico: crear(), actualizar(), listar(), eliminar() + liberar_claves_unicas()
│   │   ├── excel.py               # Exportación a Excel con openpyxl
│   │   ├── validaciones.py        # exigir_identificador() y otras validaciones
│   │   ├── red.py                 # direccion_local(), url_sugerida(), es_alcanzable_desde_fuera()
│   │   └── subidas.py             # Utilidades para fotos de docentes (normalización a WEBP)
│   │
│   ├── modulos/                   # Módulos de la API REST (14 blueprints bajo /api/v1)
│   │   ├── auth/                  # Login, refresh, logout, me, change-password
│   │   ├── usuarios/              # CRUD de usuarios
│   │   ├── roles/                 # CRUD de roles + asignación de permisos
│   │   ├── permisos/              # CRUD de permisos
│   │   ├── docentes/              # CRUD de docentes + fotos + asignación materias/cursos
│   │   ├── asignaturas/           # CRUD de asignaturas
│   │   ├── grados/                # CRUD de grados (Ley 115)
│   │   ├── cursos/                # CRUD de cursos
│   │   ├── jornadas/              # CRUD de jornadas
│   │   ├── horarios/              # CRUD de horarios
│   │   ├── asistencia/            # Registro de marcaciones (entrada/salida) + borrado
│   │   ├── reportes/              # Panel KPI + informe consolidado por docente
│   │   ├── auditoria/             # Consulta de bitácora
│   │   └── configuracion/         # Ajustes del sistema + configuración QR
│   │
│   └── web/                       # Páginas HTML (Blueprint "web" en raíz /)
│       ├── __init__.py
│       ├── rutas.py               # Rutas HTML: /, /login, /dashboard, /listados, /qr, /marcar, /escanear
│       ├── navegacion.py          # Menú lateral: estructura, iconos SVG, filtrado por permisos
│       ├── listados.py            # Definición de las 10 pantallas de listado (columnas, filtros, acciones)
│       └── formularios.py         # Definición de formularios CRUD (campos, validación, opciones)
│
├── aplicacion/plantillas/         # Templates Jinja2
│   ├── base.html                  # Layout raíz: fondo gradiente, orbes, toast, confirmación, carga JS
│   ├── panel.html                 # Layout administrativo: sidebar, header, cuenta de usuario
│   ├── login.html                 # Formulario de acceso
│   ├── inicio.html                # Landing pública
│   ├── dashboard.html             # Panel con KPIs, tendencia 7 días, actividad reciente
│   ├── listado.html               # Listado genérico: filtros + tabla + tarjetas móvil + paginación
│   ├── qr.html                    # Configuración QR: preview, URL, nombre, descarga
│   ├── marcar.html                # Marcación simple: reloj, horarios, botones entrada/salida
│   ├── escanear.html              # Escaneo QR: cámara + geolocalización + marcación
│   ├── sin-permiso.html           # Página 403
│   └── componentes/               # Componentes reutilizables (logo, iconos)
│
├── aplicacion/estaticos/js/       # JavaScript vanilla
│   ├── api.js                     # Cliente HTTP: get, post, patch, delete, subir, descargar
│   ├── interfaz.js                # UI: toasts, confirmación, filtros, validación de formularios
│   ├── listado.js                 # Controlador de listados: renderizado, paginación, orden, exportación
│   └── formulario.js              # Constructor de formularios dinámicos desde JSON
│
├── herramientas/                  # Scripts de utilería (no forman parte de la app)
│   ├── consola.py                 # Consola interactiva de SQLAlchemy
│   ├── migrar_fotos.py            # Migra fotos de disco a BD
│   ├── migrar_grados.py           # Migra grados legacy
│   ├── migrar_roles.py            # Migra roles legacy
│   └── probar_*.py                # Scripts de prueba de cada módulo
│
└── docker/                        # Configuración Docker (si existe)
```

---

## 3. MODELOS DE BASE DE DATOS

### 3.1 Tablas principales

| Modelo Python | Tabla SQL | Descripción |
|---|---|---|
| `Usuario` | `users` | Cuentas de acceso (email, password bcrypt, role_id) |
| `SesionRefresco` | `refresh_tokens` | Tokens JWT de refresco, hasheados con SHA-256 |
| `Rol` | `roles` | Perfiles de acceso (code único, name visible) |
| `Permiso` | `permissions` | Capacidades granulares formato `modulo.accion` |
| `RolPermiso` | `role_permissions` | Puente roles↔permisos |
| `Docente` | `teachers` | Personal docente (code DOC-XXXX, foto en BD) |
| `Asignatura` | `subjects` | Materias (code, color, weekly_hours) |
| `DocenteAsignatura` | `teacher_subjects` | Puente docentes↔asignaturas |
| `Grado` | `grades` | 14 grados Ley 115 (code, level enum, position) |
| `Curso` | `courses` | Grupos (grade_id, letter, name compuesto) |
| `DocenteCurso` | `teacher_courses` | Puente docentes↔cursos |
| `Jornada` | `shifts` | Franjas institucionales (Mañana/Tarde/Noche) |
| `Horario` | `schedules` | Franja de trabajo docente (día, hora entrada/salida, tolerancia) |
| `Marcacion` | `attendances` | **Registro de asistencia** (tipo entrada/salida, estado, geolocalización) |
| `Auditoria` | `audit_logs` | Bitácora de acciones (action, module, metadata JSONB) |
| `Ajuste` | `settings` | Parámetros del sistema (key/value, tipo, público/sistema) |

### 3.2 Mixins de los modelos (base.py)

Todos los modelos comparten patrones vía mixins:
- **`MarcasTiempo`**: `created_at` (server_default), `updated_at` (onupdate automático)
- **`BorradoLogico`**: `deleted_at` (nullable). **NUNCA se borra físicamente**
- **`ConEstado`**: `status` tipo `record_status` enum (ACTIVE/INACTIVE)

### 3.3 Enums (enumeraciones.py)

```python
EstadoRegistro: ACTIVE, INACTIVE
TipoMarcacion: CHECK_IN, CHECK_OUT
EstadoMarcacion: ON_TIME, LATE, EARLY_DEPARTURE
AccionAuditoria: CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE, LOGIN, LOGOUT, ATTENDANCE
TipoAjuste: STRING, NUMBER, BOOLEAN, JSON
NivelEducativo: PREESCOLAR, BASICA_PRIMARIA, BASICA_SECUNDARIA, MEDIA
```

### 3.4 Generación de IDs

Los UUID se generan en la aplicación con `nuevo_id()` = `str(uuid.uuid4())`. La BD también tiene `DEFAULT gen_random_uuid()` como respaldo para inserciones directas por SQL.

### 3.5 Restricciones importantes en BD

- Horarios: formato HH:MM válido, salida > entrada, tolerancia 0-120, día 0-6 o NULL
- Cursos: misma letra no se duplica en un grado (índice parcial WHERE deleted_at IS NULL)
- Correos: regex mínimo `^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$`
- Grados: position 1-30 (Ley 115: 14 posiciones reales)

---

## 4. FLUJO DE AUTENTICACIÓN

### 4.1 Login (`POST /api/v1/auth/login`)

1. Valida email + password con Pydantic
2. Busca usuario por email (debe existir, no eliminado, status ACTIVE)
3. Verifica bcrypt: `verificar_contrasena(clave, hash)` — acepta `$2b$` y `$2a$`
4. Si falla: incrementa `failed_login_attempts`, bloquea si > 5 intentos (15 min)
5. Si OK: genera access token (15 min) + refresh token (7 días)
6. Guarda refresh token hasheado (SHA-256) en `refresh_tokens`
7. Actualiza `last_login_at`
8. Auditoría: `LOGIN`

### 4.2 Tokens (seguridad.py)

- **Access token**: JWT HS256 con `{sub, email, role, type:"access", iat, exp, jti}`
- **Refresh token**: JWT HS256 con `{sub, email, role, type:"refresh", iat, exp, jti}`
- **Almacenamiento**: Access via `Authorization: Bearer ...` (API) o cookie de sesión (HTML pages)
- **Rotación**: Cada refresh genera uno nuevo y revoca el anterior
- **Hash de refresh**: SHA-256 (NO bcrypt — ver explicación en `huella_token()`)

### 4.3 Control de acceso (seguridad.py)

- **`usuario_actual()`**: Decodifica JWT, carga usuario + permisos de BD. Se cachea en `request`
- **`exigir_usuario()`**: Igual pero lanza 401 si no hay sesión
- **`@requiere_permisos("x", "y")`**: Exige al menos uno de los permisos. SUPER_ADMIN pasa siempre
- **`@requiere_roles("SUPER_ADMIN")`**: Exige rol específico. SUPER_ADMIN NO pasa automáticamente (segunda barrera)
- **`UsuarioAutenticado`**: Dataclass con `id, email, nombre_completo, rol_codigo, permisos[], docente_id`

### 4.4 Roles del sistema (4 iniciales)

| code | name | Permisos |
|---|---|---|
| `SUPER_ADMIN` | Rector(a) | Todos (74) |
| `ADMINISTRADOR` | Administrador(a) | 53 (sin permisos.delete, permissions.delete/create) |
| `COORDINADOR` | Coordinador(a) | 19 (académico + asistencia + reportes) |
| `DOCENTE` | Docente | 1 (`attendance.self`) |

### 4.5 Permisos (formato `modulo.accion`)

Módulos: `users, roles, permissions, teachers, subjects, grades, courses, shifts, schedules, attendance, reports, audit, settings, dashboard`

Acciones: `read, create, update, delete, activate, deactivate, export, reset-password, self`

---

## 5. FLUJO DE ASISTENCIA (EL CORREO DEL SISTEMA)

### 5.1 Registro (`POST /api/v1/attendance/register`)

El endpoint recibe:
```json
{
  "type": "CHECK_IN" | "CHECK_OUT",
  "teacherId": "uuid-opcional",
  "notes": "texto-opcional",
  "latitude": 4.123,
  "longitude": -74.123,
  "locationAccuracy": 15.5,
  "locationSource": "gps"
}
```

### 5.2 Reglas de negocio (servicio.py — `registrar()`)

| Regla | Descripción |
|---|---|
| **RN001** | El docente debe existir y no estar eliminado |
| **RN002** | Docente y su cuenta de usuario deben tener status ACTIVE |
| **RN003** | Debe existir un horario activo para el docente en el día actual (day_of_week matching o NULL) |
| **RN004** | No se admiten dos ENTRADAS consecutivas |
| **RN005** | No se admiten dos SALIDAS consecutivas |
| **RN006** | No hay SALIDA sin ENTRADA previa el mismo día |
| **RN007** | Si la entrada supera la tolerancia → estado = LATE |
| **RN008** | Dentro de la tolerancia → estado = ON_TIME |
| **RN009** | Toda marcación queda registrada en auditoría |
| **RN010** | Si `school.location_required = true`, el docente debe estar dentro del radio del colegio (Haversine) |

### 5.2.1 Validación geográfica (RN010)

**Configuración** (settings en BD):
- `school.location_latitude`: Latitud del colegio (decimal)
- `school.location_longitude`: Longitud del colegio (decimal)
- `school.location_radius_meters`: Radio máximo permitido (metros, default 200)
- `school.location_required`: `"true"` para activar validación

**Endpoint público**: `GET /api/v1/settings/location` → devuelve la config de ubicación (sin auth).

**Backend**: En `registrar()`, después de resolver el horario (RN003), se valida:
1. Si `location_required = true` y la ubicación está configurada, se calcula distancia Haversine
2. Si la distancia supera el radio → rechaza con HTTP 403 y mensaje de error
3. La validación se aplica tanto con lat/lng como sin ellos (en cuyo caso se rechaza)

**Frontend**: Las páginas `/marcar` y `/escanear` muestran:
- Indicador visual de si el usuario está dentro/fuera del radio del colegio
- Distancia actual en metros
- Badge verde (dentro) o rojo (fuera)

**Migración SQL**: `migracion_ubicacion_colegio.sql` — inserta los 4 settings nuevos

### 5.3 Resolución de horario (`_resolver_horario()`)

1. Busca horarios activos del docente para el día de semana actual (o day_of_week NULL = todos)
2. Exige que la jornada asociada esté activa
3. Calcula la distancia (en minutos) entre la hora actual y la hora de referencia del horario
4. Elige el horario **más cercano**
5. Si la distancia supera la **ventana de marcación** (±180 min por defecto) → rechaza

### 5.4 Evaluación de puntualidad (`_evaluar_puntualidad()`)

- **Entrada**: Si `diferencia > tolerance_minutes` → LATE, si no → ON_TIME
- **Salida**: Si `diferencia < -tolerance_minutes` → EARLY_DEPARTURE, si no → ON_TIME
- `minutes_diff` = hora_real - hora_esperada (positivo = tarde)

### 5.5 Datos guardados en Marcación

```python
Marcacion(
    id, teacher_id, schedule_id,
    type, status, date, registered_at,
    expected_time, minutes_diff,
    latitude, longitude, location_accuracy, location_source,
    ip_address, user_agent, device,
    notes, registered_by_id
)
```

### 5.6 Autor who registered

- `registered_by_id`: Si el docente marca su propia asistencia, es su propio user ID
- Si un admin marca por otro docente, es el ID del admin

---

## 6. SISTEMA QR

### 6.1 Generación de QR

- **Librería**: `segno` (server-side, NO JavaScript)
- **Endpoint**: `GET /qr/imagen.svg` o `GET /qr/imagen.png`
- **Corrección de errores**: Alta (`error="h"`) — apto para impresión
- **Ruta de imagen**: Embedida como `<img src="/qr/imagen.svg?url=...">`

### 6.2 Configuración QR (settings en BD)

- `qr.public_url`: URL que codifica el QR (debe contener `/marcar`)
- `qr.institution_name`: Nombre que se muestra al descargar
- La URL por defecto es `http://localhost:3000/marcar`

### 6.3 Flujo QR

1. Admin configura URL pública en Configuración → Código QR
2. Se imprime y pega en la institución
3. Docente escanea con teléfono → abre `/marcar`
4. Se autentica → ve sus horarios y puede marcar entrada/salida
5. También existe `/escanear` que usa la cámara del teléfono directamente

---

## 7. PÁGINAS WEB

### 7.1 Rutas HTML

| Ruta | Template | Requiere | Descripción |
|---|---|---|---|
| `/` | `inicio.html` | No | Landing pública; redirige a /dashboard si hay sesión |
| `/login` | `login.html` | No | Formulario de acceso |
| `/dashboard` | `dashboard.html` | `dashboard.read` | Panel con KPIs y tendencia |
| `/docentes` | `listado.html` | `teachers.read` | Listado de docentes |
| `/asignaturas` | `listado.html` | `subjects.read` | Listado de asignaturas |
| `/grados` | `listado.html` | `grades.read` | Listado de grados |
| `/cursos` | `listado.html` | `courses.read` | Listado de cursos |
| `/jornadas` | `listado.html` | `shifts.read` | Listado de jornadas |
| `/horarios` | `listado.html` | `schedules.read` | Listado de horarios |
| `/asistencia` | `listado.html` | `attendance.read` | Listado de marcaciones |
| `/usuarios` | `listado.html` | `users.read` | Listado de usuarios |
| `/roles` | `listado.html` | `roles.read` | Listado de roles |
| `/reportes` | `listado.html` | `reports.read` | Informe consolidado |
| `/qr` | `qr.html` | `settings.read` | Configuración del QR |
| `/qr/imagen.<fmt>` | Imagen SVG/PNG | `settings.read` | Genera imagen QR |
| `/marcar` | `marcar.html` | Sesión | Marcación simple (reloj + botones) |
| `/escanear` | `escanear.html` | Sesión | Escaneo QR con cámara + geolocalización |

### 7.2 Autenticación de páginas

- `con_sesion()` decorador: Redirige a `/login?redirect=...` si no hay sesión
- `con_sesion("permiso")`: Además verifica que el usuario tenga el permiso
- La sesión se almacena en cookie Flask con `SameSite=Lax`

### 7.3 Sistema de listados genérico

Una sola plantilla (`listado.html`) sirve 10 pantallas. La definición viene de `listados.py`:
- Columnas con tipos: `docente`, `asignatura`, `estado`, `fecha`, `hora`, `contador`, etc.
- Filtros: búsqueda, catálogos, opciones, fechas
- Acciones: crear, editar, eliminar, activar/desactivar, exportar, borrado múltiple
- El JS (`listado.js`) lee la definición de `<script id="definicion-vista">`

---

## 8. API REST (14 módulos)

Todas las rutas API están bajo el prefijo `/api/v1`.

### 8.1 Auth
- `POST /auth/login` → login con email/password, devuelve tokens
- `POST /auth/refresh` → renueva access token
- `POST /auth/logout` → revoca refresh token
- `GET /auth/me` → usuario actual
- `POST /auth/change-password`

### 8.2 Patrón CRUD genérico

Cada módulo sigue el mismo patrón (creado en `crud.py`):
- `GET /recurso` → listado paginado con filtros
- `GET /recurso/:id` → detalle
- `POST /recurso` → crear
- `PATCH /recurso/:id` → actualizar
- `PATCH /recurso/:id/activate` → activar
- `PATCH /recurso/:id/deactivate` → inactivar
- `DELETE /recurso/:id` → borrado lógico
- `GET /recurso/export` → exportar a Excel

### 8.3 Endpoints de asistencia

- `POST /attendance/register` — **CORE**: registra entrada/salida
- `GET /attendance/me/status` — estado actual del docente (puede entrada/salida)
- `GET /attendance/me/history` — historial del docente
- `GET /attendance` — listado admin (con filtros por docente, tipo, estado, fecha)
- `GET /attendance/export` — exportar a Excel
- `POST /attendance/bulk-delete` — borrar seleccionadas (SUPER_ADMIN)
- `POST /attendance/delete-by-teacher` — borrar por docente (SUPER_ADMIN)

### 8.4 Configuración QR

- `GET /settings/qr` → datos actuales del QR
- `PATCH /settings/qr` → actualizar URL y nombre
- `GET /settings/qr/history` → historial de cambios

### 8.4.1 Ubicación del colegio

- `GET /settings/location` → configuración de ubicación (público, sin auth)
- Devuelve: `{ latitude, longitude, radiusMeters, required, configured }`

### 8.5 Reportes

- `GET /reports/dashboard` → KPIs del día + tendencia 7 días + actividad reciente + top tardanzas
- `GET /reports/attendance` → informe consolidado por docente (paginado)
- `GET /reports/export` → resumen Excel
- `GET /reports/export/detail` → detalle Excel

---

## 9. FRONTEND

### 9.1 Stack

- **CSS**: Tailwind CSS 3.x (JIT, dark mode preparado pero desactivado en V1)
- **JS**: Vanilla JavaScript (sin framework), organizado en módulos IIFE
- **Iconos**: Inline SVG (sin librería externa)
- **Diseño**: CSS variables semánticas (`--color-primary`, `--color-success`, etc.), glass-card, orbs animados

### 9.2 Archivos JS

| Archivo | Líneas | Función |
|---|---|---|
| `api.js` | 91 | Cliente HTTP: fetch con manejo de 401, credenciales same-origin |
| `interfaz.js` | 273 | Toasts, confirmación, errores de formulario, filtros URL |
| `listado.js` | 641 | Renderizado de listados: tabla + tarjetas, paginación, sorting, export, borrado |
| `formulario.js` | 751 | Constructor de formularios dinámicos desde definición JSON |

### 9.3 Convenciones de diseño

- Gradiente institucional de fondo (`app-gradient`)
- Tarjetas con efecto glass (`glass-card`, `surface-card`)
- Orbes flotantes animados
- Colores semánticos: primary (indigo), success (green), warning (amber), destructive (red)
- Responsive: tabla en desktop, tarjetas en móvil
- Sin dependencias externas (no React, no jQuery)

---

## 10. CONFIGURACIÓN

### 10.1 Variables de entorno (.env)

| Variable | Default | Descripción |
|---|---|---|
| `DATABASE_URL` | (requerida) | Cadena de conexión PostgreSQL |
| `NODE_ENV` | development | Entorno (development/production) |
| `API_PORT` | 4000 | Puerto del servidor |
| `API_PREFIX` | api/v1 | Prefijo de la API |
| `JWT_ACCESS_SECRET` | (dev) | Secreto para firmar access tokens |
| `JWT_REFRESH_SECRET` | (dev) | Secreto para firmar refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | 15m | Caducidad access token |
| `JWT_REFRESH_EXPIRES_IN` | 7d | Caducidad refresh token |
| `SESSION_SECRET` | (igual que access) | Clave de cookie Flask |
| `BCRYPT_ROUNDS` | 12 | Rondas de hash bcrypt |
| `APP_TIMEZONE` | America/Bogota | Zona horaria institucional |
| `SEED_ADMIN_EMAIL` | admin@datly.local | Email del usuario admin inicial |

### 10.2 Settings en BD (tabla settings)

| key | tipo | group | Descripción |
|---|---|---|---|
| `qr.public_url` | STRING | qr | URL que codifica el QR |
| `qr.institution_name` | STRING | qr | Nombre institucional en el QR |
| `attendance.default_tolerance_minutes` | NUMBER | attendance | Tolerancia por defecto |
| `attendance.window_minutes` | NUMBER | attendance | Ventana de marcación (±min) |
| `app.timezone` | STRING | general | Zona horaria (is_system=true) |
| `app.institution_short_name` | STRING | general | Nombre corto para header |
| `school.location_latitude` | STRING | school | Latitud del colegio (decimal) |
| `school.location_longitude` | STRING | school | Longitud del colegio (decimal) |
| `school.location_radius_meters` | NUMBER | school | Radio máximo en metros (default 200) |
| `school.location_required` | STRING | school | `"true"` para activar validación de ubicación |

---

## 11. ERRORES CONOCIDOS (BUGS)

### Alta prioridad

1. **N+1 en serializadores de listados**: Los serializadores acceden a relaciones lazy-loaded sin eager loading. Aunque las relaciones tienen `lazy="joined"`, esto solo funciona cuando el padre se carga directamente, no cuando se accede desde otro objeto. Los módulos afectados: docentes, usuarios, horarios, asistencia, reportes.

2. ~~**Bug de truncación en `liberar_claves_unicas()`**~~ — **CORREGIDO** (v3.6.0)

### Media prioridad

3. ~~**API prefix hardcodeado**~~ — **CORREGIDO** (v3.6.0) — Ahora usa `current_app.config["PREFIJO_API"]`.

4. **Stale `rol.name` en JWT** — Si se renombra un rol, el JWT viejo lleva el nombre anterior. El control de acceso siempre consulta BD, así que es cosmético.

5. **Sin CSRF formal** — Depende de `SameSite=Lax` + JSON Content-Type. Funciona pero no es una protección explícita.

### Baja prioridad

6. **Múltiples queries en dashboard** — Cada KPI es una query separada; podría ser una sola agregada.

7. **`RolPermiso.created_at` sin `server_default`** — Depende de que el código siempre lo setee.

---

## 12. DECISIONES PENDIENTES (PENDIENTES.md)

| # | Tema | Default |
|---|---|---|
| 1 | Dominio público QR | `http://localhost:3000/marcar` |
| 2 | Zona horaria | America/Bogota |
| 3 | Tolerancia | 10 min |
| 4 | Días laborales | Un horario por docente+jornada+día |
| 5 | Ventana marcación | ±180 min |
| 6 | Salida anticipada | Informativo, no bloquea |
| 7 | Código docente | DOC-0001 auto |
| 13 | Motor BD | PostgreSQL 16 |
| 18 | Estudiantes | Fuera de alcance |

**Fuera de alcance V1**: WhatsApp, correos automáticos, nómina, reconocimiento facial, firma digital, offline.

---

## 13. DESPLIEGUE

### Render.com (render.yaml)
- Web service Python free tier
- PostgreSQL free tier (asistencia_qr-db)
- Build: `pip install -r requirements.txt && python init_db.py`
- Start: `python servidor.py --produccion`

### Desarrollo local
```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
CONFIGURAR-BASE-DE-DATOS.bat  # genera .env con la URL de BD
.venv\Scripts\python servidor.py
# → http://localhost:4000
# → http://localhost:4000/api/v1/health
```

---

## 14. CONVENCIONES DE CÓDIGO

### Python
- **Estilo**: PEP 8 con docstrings en español
- **Tipado**: Type hints completos (Python 3.10+), `from __future__ import annotations`
- **Nombres**: snake_case para Python, camelCase para JSON (API compatible con el frontend JS original)
- **Imports**: Organizados por secciones, relativos dentro de `aplicacion/`
- **Strings**: Siempre en español (mensajes de error, etiquetas, descripciones)

### JavaScript
- **Estilo**: IIFE modules (`const X = (function() { ... })()`)
- **Nombres**: camelCase
- **API**: Siempre via el módulo `Api` con base URL `/api/v1`
- **Errores**: Se muestran con `Interfaz.aviso()`

### Base de datos
- **UUIDs**: Generados en la app, no en BD (excepto seeds SQL)
- **Borrado**: SIEMPRE lógico (`deleted_at`). Nunca DELETE físico
- **Cadenas**: En inglés los nombres de columna SQL (compatibilidad con el sistema original Prisma)
- **Enums**: Nombres en inglés (`CHECK_IN`, `ACTIVE`), etiquetas en español

---

## 15. NOTAS PARA FUTURAS MODIFICACIONES

1. **Antes de crear un nuevo módulo**: Revisar `aplicacion/modulos/docentes/` como referencia
2. **Antes de crear una nueva pantalla**: Revisar `listados.py` y `formularios.py`
3. **Al modificar modelos**: Verificar que `database.sql` esté sincronizado
4. **Al cambiar la API**: Actualizar `api.js` si es necesario
5. **Al tocar asistencia**: Las reglas RN001-RN009 están en `servicio.py` — documentar cualquier cambio
6. **Búsqueda de texto**: Usar `aplicar_busqueda()` de `consultas.py` — nunca concatenar strings en WHERE
7. **Paginación**: Siempre usar `paginar()` de `consultas.py` — respeta los límites
8. **Exportación**: Seguir el patrón de `excel.py` con `Columna()` y `construir()`
9. **Auditoría**: Cada acción relevante debe llamar a `auditoria.anotar()`
10. **Fecha/hora**: SIEMPRE usar funciones de `tiempo.py` — nunca `datetime.now()` directo

---

## 16. PENDIENTES (v3.7.0)

### Tareas pendientes por completar

| # | Tarea | Estado |
|---|---|---|
| 1 | **Configurar coordenadas del colegio** — Ejecutar `migracion_ubicacion_colegio.sql` y colocar lat/lng reales en `school.location_latitude` y `school.location_longitude` | Pendiente |
| 2 | **Activar validación de ubicación** — Cambiar `school.location_required` a `"true"` una vez verificadas las coordenadas | Pendiente |
| 3 | **Verificación humana del sistema** — Probar end-to-end con un docente real: registrar entrada/salida, verificar que la validación de ubicación funcione correctamente, revisar que las marcaciones se guarden con lat/lng | Pendiente |
| 4 | **Crear cuentas de usuario para los docentes importados** — Hecho: 41 docentes tienen usuario (rol `DOCENTE`, clave = documento, debe cambiar contraseña). Se sincroniza a Render vía `seed_sincronizacion.py` al arranque | Completado |
| 5 | **Probar en dispositivo móvil** — Verificar que la geolocalización funcione en Android/iOS (permisos de ubicación, precisión GPS) | Pendiente |
| 6 | **Documentar en el README** — Agregar instrucciones de configuración de ubicación del colegio | Pendiente |

### Notas de implementación

- La validación de ubicación es **opcional** por defecto (`school.location_required = false`)
- Se recomienda probar primero con la validación desactivada para verificar que las coordenadas se capturen correctamente
- El radio por defecto es 200 metros — puede ajustarse en `school.location_radius_meters`
- Las páginas `/marcar` y `/escanear` muestran el estado de ubicación (dentro/fuera) en tiempo real
- **Importación de docentes (v3.7.0)**: Se importaron 41 docentes desde `BASE DE DATOS DOCENTES Y DIRECTIVOS IED LOS LAURELES 2026.xlsx` a la tabla `docentes` (esquema local activo, columnas en español). Script: `importar_docentes.py`. Coincidencia por número de documento.
- **Cuentas de usuario (v3.7.0)**: Cada docente tiene un usuario con rol `DOCENTE`, clave inicial = número de documento, `must_change_password = true`. Script: `crear_usuarios_docentes.py` (local, español).
- **Seed para Render (v3.7.0)**: Los 41 docentes se sincronizan en el esquema inglés (`teachers` + `users`) de forma idempotente vía `seed_sincronizacion.py` + `seed_docentes.json`. Se ejecuta **al arrancar** la app (`servidor.py`) y en el build (`init_db.py`), con autocommit por fila e inserción adaptada a las columnas existentes. Regenerar el JSON: `generar_seed_json.py`.
