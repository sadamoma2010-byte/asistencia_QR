# Sistema Web de Asistencia Docente por QR

Plataforma SaaS para el control de asistencia docente mediante un **único código QR institucional**.
Registra entradas y salidas, detecta tardanzas automáticamente, gestiona horarios y jornadas,
genera reportes exportables a Excel y mantiene auditoría completa de todas las acciones.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3, Shadcn UI, React Hook Form, Zod, TanStack Query 5, Framer Motion, Lucide React |
| Backend | NestJS 10, TypeScript, Passport JWT, Swagger, ExcelJS |
| Base de datos | PostgreSQL 14+ |
| ORM | Prisma 5 |
| Auth | JWT + Refresh Token (rotación), bcrypt |
| Autorización | RBAC (Roles + Permisos granulares) |
| Infraestructura | Docker + Docker Compose |

---

## Arquitectura

```
ASISTENCIA_QR_2026_SENA/
├── backend/            API REST NestJS + Prisma
│   ├── prisma/         Schema, migraciones y seed
│   └── src/
│       ├── common/     Guards, decorators, filtros, interceptores, DTOs base
│       ├── prisma/     PrismaService
│       └── modules/    auth, users, roles, permissions, teachers,
│                       shifts, schedules, attendance, reports, audit, settings
├── frontend/           Next.js 15 App Router
│   └── src/
│       ├── app/        Rutas (login, dashboard, marcar)
│       ├── components/ ui / shared / layout / dashboard / attendance / reports / forms
│       ├── lib/        API client, utils, validaciones Zod
│       └── hooks/      TanStack Query hooks
└── docker-compose.yml
```

---

## Requisitos

| | |
|---|---|
| Node.js | 20 o superior |
| PostgreSQL | 14 o superior, en marcha |

## Instalación

### 1. Dependencias

```bash
npm --prefix backend install
npm --prefix frontend install
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

Y genere el cliente:

```bash
npm --prefix backend run prisma:generate
```
</details>

### 3. Frontend

```bash
cp frontend/.env.example frontend/.env.local
```

### 4. Arranque

Lo más sencillo es doble clic en **`INICIAR-APLICACION.bat`**. Comprueba que PostgreSQL
esté encendido, levanta backend y frontend en sus propias ventanas, espera a que ambos
respondan y abre el navegador.

Lo mismo desde la terminal:

```bash
npm run dev
```

Para apagarlo:

```bash
npm run stop
```

O cada servidor por separado, si prefiere ver sus registros:

```bash
npm --prefix backend run start:dev     # http://localhost:4000
npm --prefix frontend run dev          # http://localhost:3000
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
