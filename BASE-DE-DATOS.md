# Estructura de la base de datos

Motor: **PostgreSQL 14 o superior** · 13 tablas · 5 tipos enumerados · 2 vistas · 2 funciones

El archivo [`database.sql`](database.sql) reconstruye todo desde cero. Se genera a partir de
los modelos de `aplicacion/modelos/`, que reflejan la estructura definida
del esquema.

---

## Diagrama de relaciones

```mermaid
erDiagram
    ROLES ||--o{ USERS : "asigna perfil a"
    ROLES ||--o{ ROLE_PERMISSIONS : "tiene"
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : "concedido en"

    USERS ||--o| TEACHERS : "es cuenta de"
    USERS ||--o{ REFRESH_TOKENS : "mantiene sesión"
    USERS ||--o{ AUDIT_LOGS : "ejecuta"

    TEACHERS ||--o{ TEACHER_SUBJECTS : "dicta"
    SUBJECTS ||--o{ TEACHER_SUBJECTS : "impartida por"

    TEACHERS ||--o{ SCHEDULES : "trabaja en"
    SHIFTS   ||--o{ SCHEDULES : "agrupa"
    SUBJECTS ||--o{ SCHEDULES : "se dicta en"

    TEACHERS  ||--o{ ATTENDANCES : "marca"
    SCHEDULES ||--o{ ATTENDANCES : "evalúa"

    ROLES {
        uuid id PK
        varchar code UK
        varchar name UK
        varchar description
        boolean is_system
        enum status
        timestamptz deleted_at
    }

    PERMISSIONS {
        uuid id PK
        varchar code UK "modulo.accion"
        varchar name
        varchar module
        boolean is_system
        enum status
    }

    ROLE_PERMISSIONS {
        uuid role_id PK_FK
        uuid permission_id PK_FK
    }

    USERS {
        uuid id PK
        varchar first_name
        varchar last_name
        varchar document UK
        varchar email UK
        varchar password "hash bcrypt"
        enum status
        uuid role_id FK
        smallint failed_login_attempts
        timestamptz locked_until
        timestamptz deleted_at
    }

    REFRESH_TOKENS {
        uuid id PK
        varchar token_hash
        uuid user_id FK
        timestamptz expires_at
        timestamptz revoked_at
    }

    TEACHERS {
        uuid id PK
        varchar code UK
        varchar first_name
        varchar last_name
        varchar document UK
        varchar email UK
        varchar photo_url
        bytea photo
        enum status
        uuid user_id FK_UK
        timestamptz deleted_at
    }

    SUBJECTS {
        uuid id PK
        varchar code UK
        varchar name
        smallint weekly_hours
        varchar color
        enum status
    }

    TEACHER_SUBJECTS {
        uuid teacher_id PK_FK
        uuid subject_id PK_FK
    }

    SHIFTS {
        uuid id PK
        varchar name UK
        varchar description
        enum status
    }

    SCHEDULES {
        uuid id PK
        uuid teacher_id FK
        uuid shift_id FK
        uuid subject_id FK
        smallint day_of_week "0-6, null = todos"
        varchar check_in_time "HH:mm"
        varchar check_out_time "HH:mm"
        smallint tolerance_minutes
        enum status
    }

    ATTENDANCES {
        uuid id PK
        uuid teacher_id FK
        uuid schedule_id FK
        enum type "CHECK_IN / CHECK_OUT"
        enum status "ON_TIME / LATE / EARLY_DEPARTURE"
        date date
        timestamptz registered_at
        varchar expected_time
        smallint minutes_diff
        varchar ip_address
        timestamptz deleted_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        varchar user_email "copia histórica"
        varchar user_name "copia histórica"
        enum action
        varchar module
        varchar description
        varchar ip_address
        jsonb metadata
        timestamptz created_at
    }

    SETTINGS {
        uuid id PK
        varchar key UK
        text value
        enum type
        varchar group
        boolean is_public
        boolean is_system
    }
```

---

## Tablas

### Acceso y autorización

#### `roles`
Perfiles de acceso al sistema. Los cuatro iniciales tienen los códigos
`SUPER_ADMIN`, `ADMINISTRADOR`, `COORDINADOR` y `DOCENTE`.

El rol tiene dos identidades separadas a propósito: `code` es lo que consulta
el control de acceso y no cambia nunca; `name` es la etiqueta visible y puede
editarse. Así la institución puede llamar «Rector(a)» a quien tiene el control
total sin que nadie pierda permisos.

| Campo | Tipo | Función |
|---|---|---|
| `id` | UUID PK | Identificador |
| `code` | VARCHAR(40) único | Identificador interno del rol, estable |
| `name` | VARCHAR(60) único | Nombre visible, editable |
| `description` | VARCHAR(300) | Alcance del rol |
| `is_system` | BOOLEAN | Si es `true`, no puede eliminarse |
| `status` | ENUM | ACTIVE / INACTIVE |

#### `permissions`
Catálogo de capacidades con formato `modulo.accion`, por ejemplo `teachers.create`.
Son 62 permisos repartidos en 12 módulos.

| Campo | Tipo | Función |
|---|---|---|
| `code` | VARCHAR(80) único | Identificador que comprueban los guards |
| `module` | VARCHAR(60) | Agrupación para la matriz de asignación |
| `is_system` | BOOLEAN | Protege los permisos base de ser borrados |

#### `role_permissions`
Tabla puente entre roles y permisos. Su clave primaria es la pareja de ambos, lo que
impide asignar dos veces el mismo permiso a un rol.

#### `users`
Cuentas de acceso. La contraseña se guarda como hash bcrypt de 12 rondas; nunca en claro.

| Campo | Tipo | Función |
|---|---|---|
| `email` | VARCHAR(180) único | Identificador de ingreso |
| `password` | VARCHAR(255) | Hash bcrypt |
| `failed_login_attempts` | SMALLINT | Intentos fallidos consecutivos |
| `locked_until` | TIMESTAMPTZ | Bloqueo temporal tras 5 fallos |
| `must_change_password` | BOOLEAN | Obliga a cambiarla al entrar |
| `role_id` | UUID FK → roles | Perfil asignado |

#### `refresh_tokens`
Sesiones activas. El token se guarda hasheado y se rota en cada renovación: si alguien
reutiliza uno anterior, se detecta.

---

### Docencia

#### `teachers`
Personal sujeto al control de asistencia. Puede vincularse con una cuenta de `users`
para que el docente marque su propia asistencia desde el QR.

| Campo | Tipo | Función |
|---|---|---|
| `code` | VARCHAR(40) único | Código institucional, ej. DOC-0001 |
| `photo_url` | VARCHAR(300) | Dirección desde la que se sirve la fotografía |
| `photo` | BYTEA | La fotografía, normalizada a WEBP de 512×512 |
| `photo_mime` | VARCHAR(40) | Tipo de la imagen guardada |
| `user_id` | UUID FK único | Cuenta de acceso; `null` si no marca por sí mismo |

#### `subjects`
Asignaturas que se imparten.

| Campo | Tipo | Función |
|---|---|---|
| `code` | VARCHAR(40) único | Código, ej. MAT-101 |
| `weekly_hours` | SMALLINT | Intensidad horaria semanal |
| `color` | VARCHAR(7) | Color hexadecimal de identificación visual |

#### `teacher_subjects`
Qué asignaturas dicta cada docente. Relación muchos a muchos: un docente imparte varias
materias y una materia la dictan varios docentes.

---

### Control horario

#### `shifts`
Jornadas institucionales: Mañana, Tarde, Noche.

#### `schedules`
Franja de trabajo de un docente. **Es la referencia contra la que se mide la puntualidad.**

| Campo | Tipo | Función |
|---|---|---|
| `teacher_id` | UUID FK | Docente |
| `shift_id` | UUID FK | Jornada |
| `subject_id` | UUID FK | Asignatura; debe estar entre las que dicta el docente |
| `day_of_week` | SMALLINT | 0 = domingo … 6 = sábado. `null` aplica a todos los días |
| `check_in_time` | VARCHAR(5) | Hora de entrada esperada, HH:mm |
| `check_out_time` | VARCHAR(5) | Hora de salida esperada, HH:mm |
| `tolerance_minutes` | SMALLINT | Margen antes de marcar tarde (RN007) |

Restricciones en la base: formato HH:mm válido, salida posterior a entrada, día entre
0 y 6, tolerancia entre 0 y 120 minutos.

#### `attendances`
Marcaciones de entrada y salida. **Es la evidencia del sistema**, por eso la eliminación
es lógica y está reservada al rol con control total (`SUPER_ADMIN`).

| Campo | Tipo | Función |
|---|---|---|
| `type` | ENUM | CHECK_IN o CHECK_OUT |
| `status` | ENUM | ON_TIME, LATE o EARLY_DEPARTURE |
| `date` | DATE | Fecha local, sin hora, para agrupar por día |
| `registered_at` | TIMESTAMPTZ | Instante exacto del registro |
| `expected_time` | VARCHAR(5) | Hora que marcaba el horario |
| `minutes_diff` | SMALLINT | Positivo llegó tarde, negativo se anticipó |
| `ip_address`, `device` | VARCHAR | Desde dónde se marcó |

---

### Trazabilidad y parámetros

#### `audit_logs`
Bitácora de toda acción del sistema (RN009).

| Campo | Tipo | Función |
|---|---|---|
| `user_id` | UUID FK | Quién actuó |
| `user_email`, `user_name` | VARCHAR | Copia del dato en el momento del hecho |
| `action` | ENUM | CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE, LOGIN, LOGOUT, ATTENDANCE |
| `metadata` | JSONB | Detalle estructurado, consultable con operadores JSON |

El correo y el nombre se **copian** en lugar de leerse por la relación: si el usuario se
elimina más adelante, el evento sigue siendo legible. Una bitácora que dice «usuario
eliminado hizo X» no sirve como evidencia.

#### `settings`
Parámetros editables sin desplegar código: URL del QR, zona horaria, tolerancia por
defecto, ventana de marcación. Los marcados `is_public` se leen sin autenticación.

---

## Elementos propios de PostgreSQL

### Tipos enumerados

`record_status`, `attendance_type`, `attendance_status`, `audit_action` y `setting_type`.
La base rechaza cualquier valor fuera de la lista, cosa que con columnas de texto libre
dependía solo de la aplicación.

### Índices parciales

Casi toda consulta filtra por `deleted_at IS NULL`. Un índice parcial cubre únicamente
esas filas:

```sql
CREATE INDEX "teachers_vigentes_idx" ON "teachers" ("status") WHERE "deleted_at" IS NULL;
```

Ocupa menos y se recorre más rápido, porque los registros eliminados no entran en él.

### Índice GIN sobre JSONB

```sql
CREATE INDEX "audit_logs_metadata_idx" ON "audit_logs" USING GIN ("metadata");
```

Permite buscar dentro del detalle de la auditoría, por ejemplo todas las eliminaciones
que afectaron a más de 5 registros.

### Vistas

| Vista | Para qué sirve |
|---|---|
| `v_asistencia_detallada` | Marcaciones con docente, jornada y asignatura ya resueltos, sin repetir los JOIN en cada informe |
| `v_resumen_docente` | Totales y porcentaje de puntualidad por docente, base de los reportes |

### Funciones

| Función | Para qué sirve |
|---|---|
| `fn_evaluar_puntualidad(hora, esperada, tolerancia)` | Devuelve LATE u ON_TIME aplicando RN007 y RN008 |
| `fn_diferencia_minutos(hora_a, hora_b)` | Diferencia en minutos entre dos horas HH:mm |

La aplicación aplica la misma regla; tenerla también en la base permite recalcular o
auditar marcaciones directamente con SQL.

---

## Reglas que la base hace cumplir

Además de las validaciones de la aplicación, estas viven en el motor. Si algún día otro
programa escribe en estas tablas, los datos siguen siendo coherentes.

| Restricción | Qué impide |
|---|---|
| `schedules_salida_posterior` | Horarios con salida anterior a la entrada |
| `schedules_check_in_time_formato` | Horas que no sean HH:mm de 24 horas |
| `schedules_dia_valido` | Días fuera del rango 0–6 |
| `schedules_tolerancia_valida` | Tolerancias negativas o mayores a 120 minutos |
| `subjects_color_formato` | Colores que no sean hexadecimales #RRGGBB |
| `users_correo_formato` | Correos sin arroba o sin dominio |
| `users_intentos_no_negativos` | Contadores de intentos en negativo |

### Comportamiento al eliminar

| Relación | Al borrar el padre |
|---|---|
| `users` → `refresh_tokens` | CASCADE: las sesiones desaparecen con la cuenta |
| `teachers` → `schedules` | CASCADE: los horarios no sobreviven al docente |
| `teachers` → `attendances` | RESTRICT: **no se puede** borrar un docente con marcaciones |
| `schedules` → `attendances` | SET NULL: la marcación se conserva sin su horario |
| `subjects` → `schedules` | SET NULL: el horario queda sin asignatura |
| `users` → `audit_logs` | SET NULL: el evento permanece aunque el usuario se elimine |

RESTRICT en asistencia es deliberado: las marcaciones son la evidencia y no deben
desaparecer como efecto colateral de otra operación.

---

## Consultas de ejemplo

```sql
-- Puntualidad del mes por docente
SELECT docente, total_marcaciones, tardanzas, porcentaje_puntualidad
FROM v_resumen_docente
ORDER BY porcentaje_puntualidad ASC;

-- Marcaciones tardías de la semana
SELECT fecha, docente, asignatura, hora_esperada, diferencia_minutos
FROM v_asistencia_detallada
WHERE estado = 'LATE' AND fecha >= CURRENT_DATE - 7
ORDER BY fecha DESC;

-- Quién eliminó marcaciones y cuántas (usa el índice GIN)
SELECT created_at, user_name, description, metadata->>'cantidad' AS cantidad
FROM audit_logs
WHERE action = 'DELETE' AND module = 'Asistencia'
ORDER BY created_at DESC;

-- Docentes sin horario: no podrán marcar (RN003)
SELECT t.code, t.first_name || ' ' || t.last_name AS docente
FROM teachers t
LEFT JOIN schedules s ON s.teacher_id = t.id AND s.deleted_at IS NULL
WHERE t.deleted_at IS NULL AND t.status = 'ACTIVE' AND s.id IS NULL;
```
