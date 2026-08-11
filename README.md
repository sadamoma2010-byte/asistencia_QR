# Sistema Web de Asistencia Docente por QR

Plataforma SaaS para el control de asistencia docente mediante un **único código QR institucional**.
Registra entradas y salidas, detecta tardanzas automáticamente, gestiona horarios y jornadas,
genera reportes exportables a Excel y mantiene auditoría completa de todas las acciones.

---

## Stack

| Capa | Tecnología |
|---|---|
| Aplicación | **Python 3.12 + Flask 3**, un solo proceso para páginas y API |
| Interfaz | **HTML + Jinja2 + CSS (Tailwind) + JavaScript**, sin dependencias de terceros |
| Base de datos | PostgreSQL 16 |
| ORM | SQLAlchemy 2 |
| Validación | pydantic v2 |
| Auth | JWT + token de refresco con rotación, bcrypt |
| Autorización | RBAC (roles + permisos granulares) |
| Informes | openpyxl (Excel), segno (códigos QR), Pillow (fotografías) |

> La versión en TypeScript (NestJS + Next.js) se conserva en `backend/` y
> `frontend/`. Sirve de referencia y es contra la que se contrastan las
> respuestas de la versión Python. Ver [`MIGRACION-A-PYTHON.md`](MIGRACION-A-PYTHON.md).

---

## Arquitectura

```
ASISTENCIA_QR_2026_SENA/
├── servidor.py           arranque
├── aplicacion/
│   ├── config.py         configuración por variables de entorno
│   ├── extensiones.py    base de datos y límite de peticiones
│   ├── modelos/          13 modelos SQLAlchemy
│   ├── comun/            respuestas, errores, seguridad, paginación,
│   │                     tiempo, auditoría, Excel, subidas
│   ├── modulos/          12 módulos: auth, usuarios, roles, permisos,
│   │                     docentes, asignaturas, jornadas, horarios,
│   │                     asistencia, reportes, auditoría, configuración
│   ├── web/              rutas de las páginas y navegación
│   ├── plantillas/       15 pantallas en Jinja2
│   └── estaticos/        CSS compilado y JavaScript propio
├── herramientas/         comprobaciones ejecutables
├── database.sql          estructura completa de la base
├── backend/ frontend/    versión anterior en TypeScript (referencia)
└── docker-compose.yml
```

Cada módulo conserva la separación que tenía en NestJS: `rutas.py` por
controlador, `servicio.py` por servicio y `esquemas.py` por DTO.

---

## Requisitos

| | |
|---|---|
| Python | 3.12 o superior |
| PostgreSQL | 16 o superior, en marcha |
| Node.js | solo para recompilar el CSS (opcional) |

## Instalación

### 1. Dependencias

```bash
python -m venv .venv
```

```bash
.venv\Scripts\pip install -r requirements.txt
```

### 2. Base de datos

Un solo comando deja PostgreSQL listo: crea la base, ejecuta [`database.sql`](database.sql),
escribe la conexión en `backend/.env` y traspasa los datos que hubiera de una instalación
anterior.

```powershell
.\scripts\configurar-postgres.ps1
```

Pide la contraseña de PostgreSQL en la terminal. No queda escrita en el código: se guarda
únicamente en `backend/.env`, que está excluido del repositorio.

<details>
<summary>Hacerlo manualmente</summary>

```bash
createdb -U postgres asistencia_qr
psql -U postgres -d asistencia_qr -f database.sql
```

Luego escriba la conexión en `backend/.env`:

```
DATABASE_URL=postgresql://usuario:contrasena@localhost:5432/asistencia_qr?schema=public
```

La aplicación lee esa misma conexión: no hay que configurarla dos veces.
</details>

### 3. Arranque

Lo más sencillo es doble clic en **`INICIAR-APLICACION.bat`**. Comprueba que PostgreSQL
esté encendido y que el entorno de Python esté instalado, levanta la aplicación en su
propia ventana, espera a que responda y abre el navegador.

Lo mismo desde la terminal:

```bash
npm run dev
```

Para apagarlo:

```bash
npm run stop
```

O directamente, si prefiere ver los registros:

```bash
.venv\Scripts\python servidor.py
```

Para producción, con un servidor preparado para ello:

```bash
.venv\Scripts\python servidor.py --produccion
```

### Recompilar el CSS

Solo hace falta si se tocan las plantillas y aparecen clases de Tailwind nuevas:

```bash
npm run estilos
```

| Servicio | Dirección |
|---|---|
| Aplicación | http://localhost:3000 |
| API | http://localhost:4000/api/v1 |
| Swagger | http://localhost:4000/api/docs |

> Las dos ventanas que abre el arranque **son los servidores**. Si se cierran, la
> aplicación deja de responder y el navegador mostrará que no puede conectar.

### Con Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Levanta PostgreSQL, la API y el frontend. Las migraciones y el seed se ejecutan solos.

## Operaciones sobre la base de datos

| Comando | Efecto |
|---|---|
| `npm --prefix backend run prisma:studio` | Explorar los datos en el navegador |
| `npm --prefix backend run seed` | Reponer roles, permisos y datos iniciales |
| `npm --prefix backend run db:migrar-datos` | Traspasar datos desde una base SQLite anterior |
| `npm --prefix backend run db:verificar` | Comprobar tablas, vistas, funciones y restricciones |
| `npm --prefix backend run db:pruebas` | Ciclo alta/consulta/modificación/baja contra la API |
| `npm --prefix backend run db:reset` | Reconstruir la base desde cero (**borra todo**) |

`db:pruebas` necesita el backend en marcha. Crea un registro de prueba, lo consulta,
lo modifica, lo da de baja, comprueba que la auditoría anotó quién hizo cada paso y
retira lo que creó.

La estructura completa está documentada en [`BASE-DE-DATOS.md`](BASE-DE-DATOS.md), con el
diagrama entidad-relación y la descripción de cada tabla.

---

## Comprobaciones

Todas se ejecutan contra la base real y retiran lo que crean.

| Comando | Qué verifica |
|---|---|
| `.venv\Scripts\python herramientas\verificar_modelos.py` | Que los 13 modelos casen con las tablas |
| `.venv\Scripts\python herramientas\probar_auth.py` | Sesión, tokens, rotación y bloqueo por intentos |
| `.venv\Scripts\python herramientas\probar_pantallas.py` | Que las 15 pantallas respondan con su contenido |
| `.venv\Scripts\python herramientas\probar_reglas.py` | Las reglas de negocio RN001 a RN009 |
| `.venv\Scripts\python herramientas\probar_crud.py` | Alta, edición, relaciones y baja en cada módulo |
| `.venv\Scripts\python herramientas\comparar_api.py` | Que cada respuesta sea igual a la del sistema anterior |

La última necesita el backend TypeScript en marcha (`npm --prefix backend run start:dev`).
Llama a las dos aplicaciones y contrasta sus respuestas campo por campo.

---

## Usuario inicial (seed)

| Campo | Valor |
|---|---|
| Correo | `admin@datly.local` |
| Password | `Admin123*` |
| Rol | `SUPER_ADMIN` |
| Estado | `ACTIVO` |

> Cambie la contraseña en el primer ingreso en un entorno real.

---

## Flujo del QR institucional

1. El administrador configura la **URL pública** del QR en `Configuración → Código QR`.
2. El sistema genera un QR único institucional (descargable en PNG y SVG) apuntando a `/marcar`.
3. El docente escanea el QR desde su celular → autenticación → **Panel Docente**.
4. El docente pulsa **Registrar Entrada** o **Registrar Salida**.
5. El backend valida las reglas de negocio (RN001–RN009), calcula puntualidad y registra auditoría.

---

## Reglas de negocio implementadas

| Código | Regla | Implementación |
|---|---|---|
| RN001 | Usuario activo puede registrar | `AttendanceService.register()` |
| RN002 | Usuario inactivo no puede registrar | `AttendanceService.register()` |
| RN003 | Horario obligatorio | `AttendanceService.resolveSchedule()` |
| RN004 | No doble entrada consecutiva | `AttendanceService.register()` |
| RN005 | No doble salida consecutiva | `AttendanceService.register()` |
| RN006 | No salida sin entrada | `AttendanceService.register()` |
| RN007 | Supera tolerancia = `TARDE` | `AttendanceService.evaluatePunctuality()` |
| RN008 | Dentro de horario = `PUNTUAL` | `AttendanceService.evaluatePunctuality()` |
| RN009 | Toda acción genera auditoría | `AuditInterceptor` + `AuditService` |

---

## Seguridad

- JWT de acceso (15 min) + Refresh Token rotativo persistido y hasheado (7 días).
- `bcrypt` (12 rounds) para contraseñas.
- RBAC con permisos granulares por módulo (`users.create`, `attendance.read`, …).
- Guards globales: `JwtAuthGuard` + `PermissionsGuard`.
- Validación estricta de DTOs (`whitelist`, `forbidNonWhitelisted`).
- Rate limit específico en login (5 intentos / minuto) y bloqueo temporal de cuenta.
- Sanitización de entradas y `helmet` en la capa HTTP.
- Soft delete obligatorio en todas las entidades.

### Credenciales

Ningún dato de conexión vive en el código. Todo se lee de variables de entorno:

| Variable | Contenido |
|---|---|
| `DATABASE_URL` | Servidor, puerto, base, usuario y contraseña de PostgreSQL |
| `JWT_ACCESS_SECRET` | Clave de firma del token de acceso |
| `JWT_REFRESH_SECRET` | Clave de firma del token de renovación |

Se definen en `backend/.env`, excluido del repositorio por `.gitignore`. La plantilla
`backend/.env.example` sí está versionada, con valores de ejemplo sin ningún secreto real.

Para producción, cambie ambos secretos JWT: los valores de la plantilla son públicos.

---

## API

Base: `/api/v1` — Swagger en `/api/docs`

```
/auth        /users       /roles      /permissions   /teachers   /subjects
/shifts      /schedules   /attendance /reports       /audit      /settings
```

Contrato REST estándar por módulo:

```
GET    /module              Listado paginado (server side)
GET    /module/:id          Detalle
POST   /module              Crear
PATCH  /module/:id          Actualizar
DELETE /module/:id          Soft delete
PATCH  /module/:id/activate    Activar
PATCH  /module/:id/deactivate  Inactivar
GET    /module/export       Exportación a Excel
```

---

## Base de datos

La estructura completa, con el diagrama entidad-relación y la función de cada tabla,
está en [`BASE-DE-DATOS.md`](BASE-DE-DATOS.md).

| Aspecto | Comportamiento |
|---|---|
| **Concurrencia** | PostgreSQL admite escrituras simultáneas con control de versiones: varios docentes pueden marcar a la vez sin bloquearse. |
| **Enumeraciones** | Tipos `ENUM` nativos. La base rechaza cualquier estado fuera de la lista. |
| **Campo JSON** | `audit_logs.metadata` es JSONB con índice GIN: se puede buscar dentro del detalle de cada evento. |
| **Búsquedas** | `ILIKE` ignora mayúsculas incluso con tildes: «Ángela» coincide con «ángela». |
| **Integridad** | Claves foráneas y restricciones `CHECK` en el motor, no solo en la aplicación. |
| **Respaldo** | `pg_dump -U postgres asistencia_qr > respaldo.sql` |

### Reconstruir la base

[`database.sql`](database.sql) crea todo desde cero: tipos, tablas, claves, restricciones,
índices, vistas, funciones y datos iniciales.

```bash
createdb -U postgres asistencia_qr
psql -U postgres -d asistencia_qr -f database.sql
```

## Publicar cambios en GitHub

La primera vez, para autenticarse (abre el navegador; sus datos los escribe
usted en la página de GitHub):

```powershell
.\scripts\conectar-github.ps1
```

Después, cada vez que quiera publicar un cambio:

```powershell
.\scripts\publicar.ps1 "descripción del cambio"
```

Ese único comando calcula el número de versión, escribe su registro en
[`versiones/`](versiones/), confirma los cambios, crea la etiqueta y lo envía
a GitHub. Antes de subir nada comprueba que no se filtren el archivo `.env`,
la base de datos ni las fotografías de los docentes.

| Comando | Efecto |
|---|---|
| `.\scripts\publicar.ps1 "arreglo"` | 1.0.0 → 1.0.1 |
| `.\scripts\publicar.ps1 "función nueva" -Tipo menor` | 1.0.1 → 1.1.0 |
| `.\scripts\publicar.ps1 "cambio de fondo" -Tipo mayor` | 1.1.0 → 2.0.0 |
| `.\scripts\publicar.ps1 "entrega" -ConCopia` | Añade un `.zip` de esa versión |
| `.\scripts\publicar.ps1 "prueba" -SinEnviar` | Solo local, sin subir |

Ver [`versiones/README.md`](versiones/README.md) para el detalle.

## Pendientes de definición

Ver [`PENDIENTES.md`](PENDIENTES.md).
