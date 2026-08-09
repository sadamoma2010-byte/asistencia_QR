<#
.SYNOPSIS
    Primer envío del proyecto a GitHub.

.DESCRIPTION
    Se ejecuta una sola vez. Abre el navegador para que usted inicie sesión en
    GitHub; la contraseña la escribe usted en la página de GitHub, no aquí.

    Una vez hecho, Windows recuerda el acceso y todas las publicaciones
    siguientes con publicar.ps1 funcionan sin volver a pedir nada.

    Resuelve por sí mismo los tropiezos habituales del primer envío:
    repositorio con contenido previo, rama con otro nombre o remoto ausente.

.EXAMPLE
    .\scripts\conectar-github.ps1
#>

$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Paso($t) { Write-Host ("  > " + $t) -ForegroundColor Cyan }
function Bien($t) { Write-Host ("  OK " + $t) -ForegroundColor Green }
function Alto($t) { Write-Host ("  x  " + $t) -ForegroundColor Red }
function Nota($t) { Write-Host ("     " + $t) -ForegroundColor DarkGray }

Write-Host ''
Write-Host '  Conectar el proyecto con GitHub' -ForegroundColor White
Write-Host '  -------------------------------' -ForegroundColor DarkGray
Write-Host ''

# ── Comprobaciones previas ───────────────────────────────────────
if (-not (Test-Path '.git')) {
  Alto 'Esta carpeta no es un repositorio git.'
  exit 1
}

$remoto = git remote get-url origin 2>$null
if (-not $remoto) {
  Alto 'No hay repositorio remoto configurado.'
  Nota 'Configurelo con:'
  Nota '  git remote add origin https://github.com/USUARIO/REPOSITORIO.git'
  exit 1
}
Nota "Repositorio: $remoto"

# El gestor de credenciales de Windows es quien abre el navegador
$helper = git config --global credential.helper
if (-not $helper) {
  Paso 'Activando el gestor de credenciales de Windows'
  git config --global credential.helper manager 2>&1 | Out-Null
  Bien 'activado'
}

# Nada que enviar si hay cambios sin confirmar
$pendientes = git status --porcelain
if ($pendientes) {
  Paso 'Guardando los cambios pendientes antes de enviar'
  git add -A 2>&1 | Out-Null
  git commit -q -m 'Ajustes previos al primer envio a GitHub' 2>&1 | Out-Null
  Bien 'cambios confirmados'
}

Write-Host ''
Paso 'Enviando el proyecto a GitHub'
Nota 'Si aparece una ventana del navegador, inicie sesion alli.'
Write-Host ''

git push -u origin main --follow-tags
$resultado = $LASTEXITCODE

if ($resultado -eq 0) {
  Write-Host ''
  Bien 'Proyecto publicado en GitHub'
  Nota ($remoto -replace '\.git$', '')
  Write-Host ''
  Nota 'A partir de ahora, para publicar cada cambio:'
  Nota '  .\scripts\publicar.ps1 "lo que cambio"'
  Write-Host ''
  exit 0
}

# ── El envio fallo: se intenta identificar por que ───────────────
Write-Host ''
Alto 'El envio no se completo.'
Write-Host ''

# Caso frecuente: el repositorio remoto ya tiene commits (README inicial)
Paso 'Comprobando si el repositorio ya tiene contenido'
$remotas = git ls-remote --heads origin 2>$null

if ($LASTEXITCODE -ne 0) {
  Nota 'No fue posible leer el repositorio. Revise que:'
  Nota '  1. El repositorio exista en GitHub con ese nombre exacto.'
  Nota '  2. Su cuenta tenga permiso de escritura sobre el.'
  Nota '  3. Haya completado el inicio de sesion en el navegador.'
  Write-Host ''
  exit 1
}

if ($remotas) {
  Nota 'El repositorio ya tiene contenido. Se fusionara con el suyo.'
  Write-Host ''
  Paso 'Fusionando el historial remoto'
  git pull origin main --allow-unrelated-histories --no-rebase -q

  if ($LASTEXITCODE -ne 0) {
    Alto 'La fusion dejo conflictos que hay que resolver a mano.'
    Nota 'Vea los archivos en conflicto con:  git status'
    Write-Host ''
    exit 1
  }

  Paso 'Reintentando el envio'
  git push -u origin main --follow-tags

  if ($LASTEXITCODE -eq 0) {
    Write-Host ''
    Bien 'Proyecto publicado en GitHub'
    Nota ($remoto -replace '\.git$', '')
    Write-Host ''
    exit 0
  }
}

Write-Host ''
Alto 'No fue posible publicar.'
Nota 'Reintente ejecutando de nuevo este archivo.'
Write-Host ''
exit 1
