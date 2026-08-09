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
| 6 | **Salida anticipada** | Se registra como `SALIDA_ANTICIPADA` (informativo, no bloquea) | `AttendanceService.evaluatePunctuality()` |
| 7 | **Nomenclatura de código docente** | `DOC-0001` autoincremental sugerido, editable | Módulo Docentes |
| 8 | **Logo institucional** | Placeholder SVG con marca del sistema | `frontend/public/logo.svg` |
| 9 | **Política de expiración de contraseña** | No implementada (fuera de alcance V1) | — |
| 10 | **Retención de registros de auditoría** | Sin purga automática | — |
| 11 | **Marcación en días no laborales / festivos** | Permitida; queda sin horario asociado ⇒ bloqueada por RN003 | Requiere calendario institucional si se desea |
| 12 | **Rotación del QR institucional** | El QR es único y permanente; cambiar la URL regenera el QR y queda registrado en auditoría | Módulo QR |
| 13 | **Motor de base de datos** | SQLite (solicitado por el cliente, reemplaza a PostgreSQL del brief inicial) | `backend/prisma/schema.prisma` |
| 14 | **Volumen de marcaciones simultáneas** | SQLite permite un solo escritor a la vez. Si se prevén más de ~20 marcaciones por minuto conviene volver a PostgreSQL | Ver «Nota sobre SQLite» en el README |
| 15 | **Política de respaldo** | No automatizada. El respaldo es copiar `backend/prisma/data/app.db` con el servicio detenido | — |

## Fuera de alcance V1 (confirmado en el brief)

Geolocalización obligatoria · WhatsApp · Correos automáticos · Nómina · Integración con sistemas
académicos · Reconocimiento facial · Firma digital · Modo offline.

## Dark mode

La arquitectura está preparada (variables CSS en `:root` y `.dark`, `class` strategy en Tailwind,
tokens semánticos en todos los componentes). **No se activa el toggle en V1** según el brief.
