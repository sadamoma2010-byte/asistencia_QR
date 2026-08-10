# Migración a Python

Reescritura completa del sistema de **TypeScript** (NestJS + Next.js) a
**Python + HTML + CSS + JavaScript**, conservando intactos el comportamiento,
la base de datos y la presentación.

---

## Qué cambia y qué no

| | Antes | Ahora |
|---|---|---|
| Servidor | NestJS 10 (TypeScript) | **Flask 3** (Python 3.12) |
| Interfaz | Next.js 15 + React 19 | **Jinja2 + HTML + CSS + JavaScript** |
| Base de datos | PostgreSQL 16 | **PostgreSQL 16 — sin cambios** |
| Estructura de tablas | 13 tablas | **las mismas 13 tablas, sin migrar nada** |
| Aspecto visual | Tailwind + Shadcn | **las mismas clases Tailwind** |
| Procesos | 2 (API + frontend) | **1 solo proceso** |

La base de datos no se toca: `database.sql` sigue siendo válido y los datos
permanecen donde están. La aplicación Python se conecta a la estructura que ya
existe.

---

## Equivalencia de librerías

### Servidor

| TypeScript | Python | Por qué |
|---|---|---|
| `@nestjs/core`, `@nestjs/common` | `Flask` | Enrutado por *blueprints* en lugar de módulos y controladores. |
| `@nestjs/platform-express` | `Werkzeug` | Servidor WSGI subyacente. |
| Interceptor `TransformInterceptor` | `comun/respuestas.py` | Mismo sobre `{success, statusCode, data, timestamp}`. |
| `AllExceptionsFilter` | `comun/errores.py` | Mismo cuerpo de error `{success, statusCode, message, errors, path, timestamp}`. |
| `helmet` | cabeceras en `comun/seguridad.py` | Las mismas cabeceras de protección. |
| `@nestjs/throttler` | `Flask-Limiter` | Límite de intentos de acceso. |
| `cors` | `Flask-Cors` | Mismos orígenes permitidos. |

### Datos

| TypeScript | Python | Por qué |
|---|---|---|
| Prisma Client | `SQLAlchemy 2.0` | ORM con tipado y consultas componibles. |
| `schema.prisma` | `modelos/` | Modelos declarativos mapeados a las tablas existentes. |
| `mode: 'insensitive'` | `ilike()` | Prisma traducía a `ILIKE`; aquí se usa directamente. |
| `Json @db.JsonB` | `JSONB` de SQLAlchemy | Mismo tipo de columna. |
| `Prisma.DbNull` | `None` | En SQLAlchemy la ausencia de valor ya es `NULL`. |
| `$transaction` | `session.begin()` | Misma atomicidad. |

### Validación

| TypeScript | Python | Por qué |
|---|---|---|
| `class-validator` + `class-transformer` | `pydantic v2` | Declaración por tipos, con conversión y mensajes de error. |
| `ValidationPipe` (whitelist, forbidNonWhitelisted) | `model_config = ConfigDict(extra='forbid')` | Rechaza campos no declarados, igual que antes. |
| `Zod` (frontend) | `pydantic` + validación en JavaScript | El servidor sigue siendo la autoridad. |

### Seguridad

| TypeScript | Python | Por qué |
|---|---|---|
| `@nestjs/jwt` | `PyJWT` | Mismos tokens: acceso 15 min, refresco 7 días. |
| `bcrypt` (Node) | `bcrypt` (Python) | **Mismo algoritmo y mismo formato de hash**: las contraseñas actuales siguen siendo válidas sin reiniciar ninguna. |
| `@nestjs/passport` + estrategia JWT | `comun/seguridad.py` | Decorador que valida el token y carga el usuario. |
| `PermissionsGuard` | `@requiere_permisos(...)` | SUPER_ADMIN pasa automáticamente. |
| `RolesGuard` | `@requiere_roles(...)` | SUPER_ADMIN **no** pasa automáticamente: se conserva la doble barrera. |

### Utilidades

| TypeScript | Python | Por qué |
|---|---|---|
| `ExcelJS` | `openpyxl` | Mismas hojas, encabezados y anchos de columna. |
| `sharp` | `Pillow` | Fotografías a 512×512 WEBP, rotación EXIF y recorte centrado. |
| `multer` | `request.files` de Flask | Mismos límites de tamaño y tipo. |
| `date-fns-tz` | `zoneinfo` (biblioteca estándar) | Misma zona horaria institucional. |
| `@nestjs/swagger` | `apispec` + `flask-swagger-ui` | La documentación sigue en `/api/docs`. |

### Interfaz

| TypeScript | Python / JavaScript | Por qué |
|---|---|---|
| Next.js App Router | Rutas Flask + plantillas Jinja2 | Las páginas se generan en el servidor. |
| React | HTML + JavaScript propio | Sin dependencias de terceros. |
| Tailwind CSS | **Tailwind CSS (sin cambios)** | Se reutilizan literalmente las mismas clases, así que el aspecto es idéntico. |
| Shadcn UI / Radix | Componentes propios en JavaScript | Diálogos, desplegables y avisos emergentes. |
| TanStack Query | `fetch` + `estaticos/js/api.js` | Peticiones, estados de carga y refresco. |
| React Hook Form | `estaticos/js/formularios.js` | Validación y envío. |
| Framer Motion | Transiciones CSS | Mismas duraciones y curvas. |
| Lucide React | Iconos SVG incrustados | Los mismos iconos, ya sin la librería. |

---

## Estructura del proyecto

```
aplicacion/
  __init__.py          fábrica de la aplicación
  config.py            configuración por variables de entorno
  extensiones.py       base de datos, límite de peticiones
  modelos/             13 modelos SQLAlchemy
  esquemas/            validación con pydantic
  comun/               respuestas, errores, paginación, tiempo, seguridad
  modulos/             12 módulos, uno por cada uno del sistema original
  plantillas/          15 pantallas en Jinja2
  estaticos/           CSS y JavaScript
```

Cada módulo conserva la misma separación que tenía en NestJS:

| NestJS | Python |
|---|---|
| `*.controller.ts` | `rutas.py` |
| `*.service.ts` | `servicio.py` |
| `dto/*.dto.ts` | `esquemas.py` |

---

## Cómo se comprobó

No se dio nada por bueno leyendo el código. Cada afirmación de esta página está
respaldada por una comprobación que puede volver a ejecutarse.

| Comprobación | Comando | Resultado |
|---|---|---|
| Los modelos casan con las tablas reales | `python herramientas/verificar_modelos.py` | 13 de 13 |
| La sesión funciona como antes | `python herramientas/probar_auth.py` | 21 de 21 |
| **Cada respuesta es igual a la del original** | `python herramientas/comparar_api.py` | **42 de 42** |
| Las pantallas responden con su contenido | `python herramientas/probar_pantallas.py` | 15 de 15 |
| Las reglas RN001–RN009 se comportan igual | `python herramientas/probar_reglas.py` | 9 de 9 |

`comparar_api.py` es la comprobación central: levanta la aplicación Python,
llama al backend TypeScript original y contrasta ambas respuestas campo por
campo. Solo se toleran dos clases de diferencia, y ambas están justificadas:

- **Marcas de tiempo y tokens**, que no pueden coincidir entre dos ejecuciones.
- **El orden de los empates**, allí donde el original no define ninguno: una
  relación sin `orderBy` o un listado ordenado por una columna con valores
  repetidos. En esos casos se compara el conjunto de datos, no la secuencia.

---

## Fallos del sistema original encontrados por el camino

Portar obliga a leer cada regla con lupa, y eso destapó tres defectos que
llevaban tiempo en la versión TypeScript. Los tres se corrigieron **en los dos
sistemas**, no solo en el nuevo.

**1 · La auditoría no distinguía «sin detalle» de «detalle vacío».**
Se escribía el valor JSON `null` en lugar de dejar la columna vacía, así que
una consulta por eventos con detalle devolvía también los que no lo tenían.
Afectaba a 128 registros.

**2 · La rotación de tokens de sesión no servía de nada.**
El token de refresco se guardaba con bcrypt, que trunca su entrada a 72 bytes.
Un JWT ocupa 276 y sus primeros 72 son idénticos para todos los tokens de un
mismo usuario, de modo que un token revocado seguía validando contra cualquier
sesión posterior. Sustituido por SHA-256 con comparación en tiempo constante.

**3 · El código sugerido para un docente nuevo ya estaba ocupado.**
`/teachers/next-code` ordenaba los códigos como texto y tomaba el mayor, que
tras cualquier baja era uno con sufijo (`DOC-0007.DEL.1786282119238`).
`Number()` sobre eso da `NaN`, y la sugerencia caía siempre en `DOC-0001`.
Pedir el código sugerido y usarlo devolvía «Ya existe un docente con ese
código».

Además se añadió un **desempate estable** en todos los listados. Sin él, dos
filas con la misma clave de orden pueden intercambiarse entre consultas, y al
paginar eso hace que una fila aparezca en dos páginas y otra en ninguna.

---

## Lo que se conserva sin tocar

- Las 13 tablas, con sus claves, restricciones, índices, vistas y funciones
- Las contraseñas ya registradas (mismo algoritmo bcrypt)
- Las fotografías subidas y sus rutas
- Los 155 registros de auditoría
- Las reglas de negocio RN001 a RN009, verificadas una a una
- La paleta, el degradado de fondo, la tipografía y el diseño adaptable
- Las direcciones de la API (`/api/v1/...`), para no romper nada que las consuma
