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

> El sistema estuvo escrito en TypeScript (NestJS + Next.js) hasta la versión
> 2.1.1. La reescritura se verificó respuesta a respuesta contra aquella
> versión antes de retirarla; el detalle está en
> [`MIGRACION-A-PYTHON.md`](MIGRACION-A-PYTHON.md). Si hiciera falta
> consultarla, sigue en el historial: `git checkout v2.1.1`.

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
├── scripts/              arranque, parada, base de datos y publicación
├── database.sql          estructura completa de la base
└── .env                  conexión y secretos (fuera del repositorio)
```

Las fotografías de los docentes se guardan **dentro de la base de datos**, no
en el disco: así viajan con el respaldo y no quedan archivos huérfanos al dar
de baja a alguien.

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

Doble clic en **`CONFIGURAR-BASE-DE-DATOS.bat`**. Crea la base, ejecuta
[`database.sql`](database.sql) y escribe la conexión en `.env`.

Pide la contraseña de PostgreSQL en la terminal. No queda escrita en el código: se guarda
únicamente en `.env`, que está excluido del repositorio.

<details>
<summary>Hacerlo manualmente</summary>

```bash
createdb -U postgres asistencia_qr
psql -U postgres -d asistencia_qr -f database.sql
```

Luego escriba la conexión en `.env`:

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
| Aplicación | http://localhost:4000 |
| API | http://localhost:4000/api/v1 |

> La ventana que abre el arranque **es el servidor**. Si se cierra, la
> aplicación deja de responder y el navegador mostrará que no puede conectar.

---

## Base de datos

La estructura completa está documentada en [`BASE-DE-DATOS.md`](BASE-DE-DATOS.md), con el
diagrama entidad-relación y la descripción de cada tabla. La fuente de verdad es
[`database.sql`](database.sql): 13 tablas, 5 tipos enumerados, 50 índices, 2 vistas
y 2 funciones.

Para reconstruirla desde cero (**borra todo**):

```bash
dropdb -U postgres asistencia_qr
```

y a continuación `CONFIGURAR-BASE-DE-DATOS.bat`.

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
| `.venv\Scripts\python herramientas\probar_qr.py` | Que el QR lleve a una dirección alcanzable y sirva a todos |
| `.venv\Scripts\python herramientas\probar_borrado.py` | Borrado múltiple, sus barreras y su rastro en auditoría |
| `.venv\Scripts\python herramientas\probar_fotos.py` | Que la fotografía se guarde en la base y se sirva bien |

Y una utilidad que solo se ejecuta una vez, al actualizar desde una versión
anterior a la 3.4:

```bash
.venv\Scripts\python herramientas\migrar_fotos.py
```

Añade las columnas de la fotografía y traslada a la base las imágenes que
estuvieran en `uploads/teachers/`.

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

Es **un solo código para toda la institución**: no hay uno por docente.

1. El administrador abre `Código QR`. La pantalla detecta la dirección de este equipo
   en la red y la propone; basta con guardarla.
2. El sistema genera el QR (descargable en PNG y SVG) apuntando a `/marcar`.
3. Se imprime y se coloca en el punto de acceso.
4. Cualquier docente lo escanea, entra con su cuenta y el sistema reconoce de quién
   se trata: cada uno llega a su propia pantalla.
5. Pulsa **Registrar entrada** o **Registrar salida**.
6. Se validan las reglas RN001–RN009, se calcula la puntualidad y queda auditado.

> La dirección del QR **no puede ser `localhost`**: en un celular esa palabra
> apunta al propio celular. Tiene que ser la dirección del equipo en la red del
> centro, y los teléfonos deben estar en esa misma red. La pantalla avisa si la
> dirección configurada no serviría.

> Para marcar, cada docente necesita una **cuenta de acceso vinculada** a su ficha.
> Se asigna en `Docentes → Editar → Cuenta de acceso`.

---

## Reglas de negocio implementadas

Todas viven en `aplicacion/modulos/asistencia/servicio.py` y se comprueban con
`herramientas/probar_reglas.py`.

| Código | Regla | Función |
|---|---|---|
| RN001 | El docente debe existir | `registrar()` |
| RN002 | Docente o cuenta inactivos no pueden marcar | `registrar()` |
| RN003 | Debe existir un horario aplicable | `_resolver_horario()` |
| RN004 | No se admiten dos entradas seguidas | `_validar_secuencia()` |
| RN005 | No se admiten dos salidas seguidas | `_validar_secuencia()` |
| RN006 | No hay salida sin entrada previa | `_validar_secuencia()` |
| RN007 | Supera la tolerancia = `TARDE` | `_evaluar_puntualidad()` |
| RN008 | Dentro de la tolerancia = `PUNTUAL` | `_evaluar_puntualidad()` |
| RN009 | Toda acción queda auditada | `comun/auditoria.py` |

---

## Seguridad

- Token de acceso (15 min) y token de refresco rotativo (7 días), guardado con su
  huella SHA-256 y revocado al usarse.
- `bcrypt` con 12 rondas para las contraseñas.
- RBAC con permisos granulares por módulo (`users.create`, `attendance.read`, …).
- Doble barrera en las acciones reservadas: `@requiere_permisos` y `@requiere_roles`.
  El SUPER_ADMIN supera la primera automáticamente, la segunda no.
- Validación estricta de la entrada: un campo no declarado hace que la petición se
  rechace, no que se ignore.
- Límite de intentos de acceso (5 por minuto) y bloqueo temporal de la cuenta.
- Cookie de sesión `HttpOnly` y `SameSite=Lax`, para que un sitio ajeno no pueda
  provocar peticiones autenticadas desde el navegador.
- Sanitización de entradas y `helmet` en la capa HTTP.
- Soft delete obligatorio en todas las entidades.

### Credenciales

Ningún dato de conexión vive en el código. Todo se lee de variables de entorno:

| Variable | Contenido |
|---|---|
| `DATABASE_URL` | Servidor, puerto, base, usuario y contraseña de PostgreSQL |
| `JWT_ACCESS_SECRET` | Clave de firma del token de acceso |
| `JWT_REFRESH_SECRET` | Clave de firma del token de renovación |

Se definen en `.env`, excluido del repositorio por `.gitignore`. La plantilla
`.env.example` sí está versionada, con valores de ejemplo sin ningún secreto real.

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
