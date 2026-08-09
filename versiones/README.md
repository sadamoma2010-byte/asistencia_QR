# Versiones del proyecto

Cada vez que se publica un cambio se genera aquí un archivo `vX.Y.Z.md` con el
registro de esa versión: qué cambió, quién lo hizo, cuándo y con qué commit.

## Cómo publicar una versión

```powershell
.\scripts\publicar.ps1 "descripción del cambio"
```

El script se encarga de todo: sube el número de versión, escribe el registro en
esta carpeta, confirma los cambios en git, crea la etiqueta y lo envía a GitHub.

### Tipo de versión

El número sigue el formato `MAYOR.MENOR.PARCHE`. Por defecto sube el parche.

```powershell
.\scripts\publicar.ps1 "corrección del cálculo de tolerancia"              # 1.0.0 → 1.0.1
.\scripts\publicar.ps1 "módulo de asignaturas" -Tipo menor                 # 1.0.1 → 1.1.0
.\scripts\publicar.ps1 "rediseño del modelo de datos" -Tipo mayor          # 1.1.0 → 2.0.0
```

- **parche** — correcciones y ajustes que no cambian cómo se usa el sistema
- **menor** — funcionalidad nueva que no rompe lo existente
- **mayor** — cambios que obligan a modificar datos o configuración

### Copia completa del código

Cada versión queda etiquetada en git, así que el código exacto de cualquier
versión se recupera con:

```bash
git checkout v1.0.0
```

Si además necesita un archivo comprimido con el proyecto de esa versión:

```powershell
.\scripts\publicar.ps1 "entrega para revisión" -ConCopia
```

Eso deja un `.zip` junto al registro. No se hace por defecto porque duplicaría
el proyecto entero en cada publicación y el repositorio crecería sin necesidad:
git ya guarda todo el historial de forma comprimida.

## Qué NO se versiona

Por seguridad y tamaño, quedan fuera del repositorio:

| Excluido | Motivo |
|---|---|
| `backend/.env`, `frontend/.env.local` | Contienen las claves de firma de sesión |
| `backend/prisma/data/` | Base de datos con contraseñas cifradas de usuarios |
| `backend/uploads/` | Fotografías de docentes (datos personales) |
| `node_modules/`, `dist/`, `.next/` | Se regeneran al instalar y compilar |

Los archivos `.env.example` sí están versionados: sirven de plantilla sin
exponer ningún valor real.
