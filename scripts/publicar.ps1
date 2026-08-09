<#
.SYNOPSIS
    Publica una versión del proyecto: registro, commit, etiqueta y envío a GitHub.

.DESCRIPTION
    Reúne en un solo paso lo que debe ocurrir cada vez que se entrega un cambio:

      1. Comprueba que no se vayan a subir archivos sensibles
      2. Calcula el número de la nueva versión
      3. Escribe el registro en versiones\vX.Y.Z.md
      4. Confirma los cambios en git y crea la etiqueta
      5. Envía todo a GitHub

    Si algo falla a mitad, no deja el repositorio a medias: revierte lo hecho.

.PARAMETER Descripcion
    Qué cambió en esta versión. Aparece en el registro y en el mensaje del commit.

.PARAMETER Tipo
    parche (por defecto), menor o mayor.

.PARAMETER ConCopia
    Además del registro, guarda un .zip con el código de esta versión.

.PARAMETER SinEnviar
    Hace todo en local sin enviar a GitHub. Útil para revisar antes de publicar.

.EXAMPLE
    .\scripts\publicar.ps1 "corrección del cálculo de tolerancia"

.EXAMPLE
    .\scripts\publicar.ps1 "módulo de asignaturas" -Tipo menor
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Descripcion,

  [ValidateSet('parche', 'menor', 'mayor')]
  [string]$Tipo = 'parche',

  [switch]$ConCopia,
  [switch]$SinEnviar
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Paso($texto)  { Write-Host ("  > " + $texto) -ForegroundColor Cyan }
function Bien($texto)  { Write-Host ("  OK " + $texto) -ForegroundColor Green }
function Alto($texto)  { Write-Host ("  x  " + $texto) -ForegroundColor Red }
function Nota($texto)  { Write-Host ("     " + $texto) -ForegroundColor DarkGray }

Write-Host ''
Write-Host '  Publicar version' -ForegroundColor White
Write-Host '  ----------------' -ForegroundColor DarkGray
Write-Host ''

# ── 1. Comprobaciones previas ────────────────────────────────────
if (-not (Test-Path '.git')) {
  Alto 'Esta carpeta no es un repositorio git.'
  exit 1
}

$cambios = git status --porcelain
if (-not $cambios) {
  Nota 'No hay cambios pendientes. No se publica nada.'
  exit 0
}

# Ningún archivo sensible debe llegar al repositorio, ni siquiera por descuido
Paso 'Comprobando que no se suban archivos sensibles'
$prohibidos = @('backend/.env', 'frontend/.env.local', 'backend/prisma/data/app.db')
$rastreados = git ls-files
$fuga = $prohibidos | Where-Object { $rastreados -contains $_ }

if ($fuga) {
  Alto 'Hay archivos sensibles a punto de subirse:'
  $fuga | ForEach-Object { Nota $_ }
  Nota 'Retirelos con: git rm --cached <archivo>'
  exit 1
}
Bien 'sin archivos sensibles'

# ── 2. Numero de version ─────────────────────────────────────────
$ultima = git tag --list 'v*' --sort=-v:refname | Select-Object -First 1
if ($ultima -match '^v(\d+)\.(\d+)\.(\d+)$') {
  $mayor = [int]$Matches[1]; $menor = [int]$Matches[2]; $parche = [int]$Matches[3]
} else {
  $mayor = 1; $menor = 0; $parche = -1   # la primera publicacion sera v1.0.0
}

switch ($Tipo) {
  'mayor'  { $mayor++; $menor = 0; $parche = 0 }
  'menor'  { $menor++; $parche = 0 }
  'parche' { $parche++ }
}

$version = "v$mayor.$menor.$parche"
Paso ("Version: " + $(if ($ultima) { "$ultima -> $version" } else { "$version (primera)" }))

# ── 3. Registro de la version ────────────────────────────────────
Paso 'Escribiendo el registro'

$carpeta = Join-Path $raiz 'versiones'
if (-not (Test-Path $carpeta)) { New-Item -ItemType Directory -Path $carpeta | Out-Null }

$fecha  = Get-Date -Format 'dd/MM/yyyy HH:mm'
$autor  = git config user.name
$correo = git config user.email

# Resumen de lo que cambia, agrupado por area del proyecto
$modificados = git status --porcelain | ForEach-Object { $_.Substring(3).Trim('"') }
$porArea = @{}
foreach ($f in $modificados) {
  $area = switch -Regex ($f) {
    '^backend/prisma/'  { 'Base de datos' }
    '^backend/'         { 'Backend' }
    '^frontend/'        { 'Frontend' }
    '^scripts/'         { 'Automatizacion' }
    '^versiones/'       { 'Documentacion' }
    default             { 'Proyecto' }
  }
  if (-not $porArea.ContainsKey($area)) { $porArea[$area] = @() }
  $porArea[$area] += $f
}

$lineas = @()
$lineas += "# $version"
$lineas += ''
$lineas += "**$Descripcion**"
$lineas += ''
$lineas += "| | |"
$lineas += "|---|---|"
$lineas += "| Fecha | $fecha |"
$lineas += "| Autor | $autor ($correo) |"
$lineas += "| Tipo | $Tipo |"
$lineas += "| Archivos | $($modificados.Count) |"
$lineas += ''
$lineas += '## Cambios'
$lineas += ''
foreach ($area in $porArea.Keys | Sort-Object) {
  $lineas += "### $area"
  $lineas += ''
  foreach ($f in $porArea[$area] | Sort-Object) { $lineas += "- ``$f``" }
  $lineas += ''
}
$lineas += '## Recuperar esta version'
$lineas += ''
$lineas += '```bash'
$lineas += "git checkout $version"
$lineas += '```'

$archivo = Join-Path $carpeta "$version.md"
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($archivo, ($lineas -join "`n"), $utf8)
Bien "versiones\$version.md"

# ── 4. Copia comprimida (opcional) ───────────────────────────────
if ($ConCopia) {
  Paso 'Generando copia comprimida'
  $zip = Join-Path $carpeta "$version.zip"
  $temp = Join-Path $env:TEMP "asistencia-$version"

  if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
  New-Item -ItemType Directory -Path $temp | Out-Null

  # Solo lo versionado: nunca secretos, base de datos ni dependencias
  foreach ($f in git ls-files) {
    $destino = Join-Path $temp $f
    $dir = Split-Path -Parent $destino
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Copy-Item $f $destino -Force
  }

  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path (Join-Path $temp '*') -DestinationPath $zip
  Remove-Item $temp -Recurse -Force
  Bien ("versiones\$version.zip  (" + [math]::Round((Get-Item $zip).Length / 1MB, 2) + " MB)")
}

# ── 5. Commit y etiqueta ─────────────────────────────────────────
Paso 'Confirmando los cambios'
git add -A | Out-Null

$mensaje = "$version - $Descripcion"
git commit -q -m $mensaje
if ($LASTEXITCODE -ne 0) { Alto 'No fue posible confirmar los cambios.'; exit 1 }

git tag -a $version -m $mensaje
if ($LASTEXITCODE -ne 0) {
  Alto "La etiqueta $version ya existe."
  git reset -q --soft HEAD~1     # deshace el commit, conserva los archivos
  exit 1
}
Bien "commit y etiqueta $version"

# ── 6. Envio a GitHub ────────────────────────────────────────────
if ($SinEnviar) {
  Write-Host ''
  Nota 'Modo local: no se envio nada a GitHub.'
  Nota "Para enviarlo: git push origin main --follow-tags"
  Write-Host ''
  exit 0
}

$remoto = git remote 2>$null
if (-not $remoto) {
  Write-Host ''
  Alto 'No hay un repositorio remoto configurado.'
  Nota 'Configurelo con:'
  Nota '  git remote add origin https://github.com/USUARIO/REPOSITORIO.git'
  Write-Host ''
  exit 1
}

Paso 'Enviando a GitHub'
git push origin main --follow-tags
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Alto 'El envio fallo. El commit y la etiqueta quedaron guardados en local.'
  Nota 'Revise su autenticacion con GitHub y reintente con:'
  Nota '  git push origin main --follow-tags'
  Write-Host ''
  exit 1
}

Write-Host ''
Bien "Version $version publicada"
Nota (git remote get-url origin)
Write-Host ''
