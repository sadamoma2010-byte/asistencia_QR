# PENDIENTE DE DEFINICIÓN

Decisiones que dependen del cliente. El sistema quedó implementado con un valor por defecto
razonable y **configurable** en cada caso, para no bloquear la puesta en producción.

| # | Tema | Valor por defecto implementado | Dónde se cambia |
|---|---|---|---|
| 1 | **Dominio público del QR** | `http://localhost:3000/marcar` | `Configuración → Código QR` (Setting `qr.public_url`) |
| 2 | **Zona horaria institucional** | `America/Bogota` (UTC-5) | Variable `APP_TIMEZONE` + Setting `app.timezone` |
| 3 | **Tolerancia por defecto** | 10 minutos | Setting `attendance.default_tolerance_minutes` y por horario |
| 4 | **Días laborales del horario** | Un horario por docente + jornada + día de semana (opcional: `null` = todos los días) | Módulo Horarios |
| 5 | **Ventana de marcación** | ±180 min respecto a la hora del horario más cercano | Setting `attendance.window_minutes` |
| 6 | **Salida anticipada** | Se registra como `SALIDA_ANTICIPADA` (informativo, no bloquea) | `aplicacion/modulos/asistencia/servicio.py` |
| 7 | **Nomenclatura de código docente** | `DOC-0001` asignado automáticamente | `aplicacion/modulos/docentes/servicio.py` |
| 8 | **Logo institucional** | SVG propio con la marca del sistema | `aplicacion/plantillas/componentes/logo.html` |
| 9 | **Política de expiración de contraseña** | No implementada (fuera de alcance V1) | — |
| 10 | **Retención de registros de auditoría** | Sin purga automática | — |
| 11 | **Marcación en días no laborales / festivos** | Permitida; queda sin horario asociado ⇒ bloqueada por RN003 | Requiere calendario institucional si se desea |
| 12 | **Rotación del QR institucional** | El QR es único y permanente; cambiar la URL regenera el QR y queda registrado en auditoría | Módulo QR |
| 13 | **Motor de base de datos** | PostgreSQL 16 | `database.sql` y `aplicacion/modelos/` |
| 14 | **Volumen de marcaciones simultáneas** | PostgreSQL admite escritura concurrente sin límite práctico para este caso | — |
| 15 | **Política de respaldo** | No automatizada. El respaldo se hace con `pg_dump -U postgres asistencia_qr` | — |
| 16 | **Grados que ofrece la institución** | Los catorce de la Ley 115; prejardín y jardín llegan inactivos por no ser obligatorios | Módulo Grados |
| 17 | **Cursos por grado** | Un grupo «A» en cada grado activo. Las demás letras se abren según la matrícula | Módulo Cursos |
| 18 | **Estudiantes** | Fuera de alcance: el sistema controla la asistencia docente, no la matrícula. El cupo del curso es informativo | — |

## Fuera de alcance V1 (confirmado en el brief)

Geolocalización obligatoria · WhatsApp · Correos automáticos · Nómina · Integración con sistemas
académicos · Reconocimiento facial · Firma digital · Modo offline.

## Dark mode

La arquitectura está preparada (variables CSS en `:root` y `.dark`, `class` strategy en Tailwind,
tokens semánticos en todos los componentes). **No se activa el toggle en V1** según el brief.
