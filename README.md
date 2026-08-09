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
| Base de datos | SQLite (archivo local, sin servidor) |
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

## Puesta en marcha

No hace falta instalar ni configurar un servidor de base de datos: SQLite guarda
todo en `backend/prisma/data/app.db`, que se crea solo al aplicar las migraciones.

### Opción A — Local

```bash
# 1. Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy   # crea el archivo app.db y las tablas
npm run seed                # roles, permisos, usuario inicial y jornadas
npm run start:dev           # http://localhost:4000

# 2. Frontend (otra terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

### Opción B — Docker

```bash
cp .env.example .env
docker compose up -d --build
```

- Frontend: http://localhost:3000
- API: http://localhost:4000/api/v1
- Swagger: http://localhost:4000/api/docs

Las migraciones y el seed se ejecutan automáticamente al levantar el backend.
El archivo SQLite persiste en el volumen `sqlite_data`.

### Reiniciar la base de datos desde cero

```bash
cd backend && npx prisma migrate reset --force
```

### Inspeccionar los datos

```bash
cd backend && npx prisma studio
```

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

---

## API

Base: `/api/v1` — Swagger en `/api/docs`

```
/auth        /users       /roles      /permissions   /teachers
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

## Nota sobre SQLite

La persistencia se implementó sobre SQLite por decisión del cliente. Implicaciones
que conviene tener presentes:

| Aspecto | Comportamiento |
|---|---|
| **Concurrencia de escritura** | SQLite admite un único escritor a la vez. Con muchos docentes marcando en el mismo instante pueden aparecer esperas o errores `SQLITE_BUSY`. |
| **Enumeraciones** | No existen `ENUM` nativos: los estados se guardan como texto y se validan contra `src/common/enums.ts`. |
| **Campo JSON** | `AuditLog.metadata` se almacena serializado y se deserializa al leerlo. |
| **Búsquedas** | `LIKE` ignora mayúsculas solo en ASCII. «Ángela» no coincide con «ángela»; los nombres sin tilde funcionan normalmente. |
| **Respaldo** | Copiar `backend/prisma/data/app.db` con el servicio detenido es un respaldo completo. |

Migrar más adelante a PostgreSQL requiere cambiar `provider` en `schema.prisma`,
restituir los tipos nativos y las enumeraciones, y regenerar las migraciones.
La capa de servicios no cambia.

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
