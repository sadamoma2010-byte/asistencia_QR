<#
.SYNOPSIS
    Enciende la aplicación: backend, frontend y navegador.

.DESCRIPTION
    Deja el sistema listo para usar en un solo paso:

      1. Comprueba que la conexión a PostgreSQL esté configurada
      2. Comprueba que el motor PostgreSQL esté escuchando
      3. Enciende el backend y el frontend, cada uno en su ventana
      4. Espera a que ambos respondan de verdad
      5. Abre el navegador en la pantalla de acceso

    Si algo falta, lo dice antes de encender nada y explica cómo resolverlo.

    Las ventanas que abre son independientes: la aplicación sigue en marcha
    aunque se cierre esta. Para apagarla, ciérrelas o use .\scripts\detener.ps1

.PARAMETER SinNavegador
    Enciende los servidores pero no abre el navegador.

.EXAMPLE
    .\scripts\iniciar.ps1
#>

[CmdletBinding()]
param(
  [switch]$SinNavegador
)

$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Paso($t) { Write-Host ("  > " + $t) -ForegroundColor Cyan }
function Bien($t) { Write-Host ("  OK " + $t) -ForegroundColor Green }
function Alto($t) { Write-Host ("  x  " + $t) -ForegroundColor Red }
function Nota($t) { Write-Host ("     " + $t) -ForegroundColor DarkGray }

Write-Host ''
Write-Host '  Iniciar la aplicacion' -ForegroundColor White
Write-Host '  ---------------------' -ForegroundColor DarkGray
Write-Host ''

# ── Un puerto ocupado significa que ese servidor ya está en marcha ──
function PuertoActivo([int]$puerto) {
  $cliente = New-Object Net.Sockets.TcpClient
  try {
    $tarea = $cliente.ConnectAsync('127.0.0.1', $puerto)
    if ($tarea.Wait(700)) { return $true }
    return $false
  } catch { return $false }
  finally { $cliente.Dispose() }
}

# ── Comprobar que la conexión esté configurada ──────────────────────
$entorno = Join-Path $raiz 'backend\.env'
if (-not (Test-Path $entorno)) {
  Alto 'Falta backend\.env: la base de datos no esta configurada.'
  Nota 'Ejecute primero CONFIGURAR-BASE-DE-DATOS.bat'
  Write-Host ''
  exit 1
}

$conexion = (Get-Content $entorno | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', ''
if (-not $conexion) {
  Alto 'backend\.env no define DATABASE_URL.'
  Nota 'Ejecute CONFIGURAR-BASE-DE-DATOS.bat para regenerarlo.'
  Write-Host ''
  exit 1
}
if ($conexion -notmatch '^postgresql://') {
  Alto 'DATABASE_URL no apunta a PostgreSQL.'
  Nota 'Ejecute CONFIGURAR-BASE-DE-DATOS.bat para rehacer la conexion.'
  Write-Host ''
  exit 1
}
Bien 'conexion a PostgreSQL configurada'

# ── Comprobar que el motor esté encendido ───────────────────────────
$puertoBase = 5432
if ($conexion -match ':(\d+)/') { $puertoBase = [int]$Matches[1] }

if (-not (PuertoActivo $puertoBase)) {
  Alto "PostgreSQL no responde en el puerto $puertoBase."
  Nota 'El servicio esta detenido. Para encenderlo, en una ventana como'
  Nota 'administrador ejecute:'
  Nota ''
  Nota '   net start postgresql-x64-16'
  Nota ''
  Nota 'Si el nombre no coincide, vealo con:  Get-Service *postgres*'
  Write-Host ''
  exit 1
}
Bien "motor PostgreSQL escuchando en el puerto $puertoBase"

# ── Encender lo que no esté ya en marcha ────────────────────────────
$apiViva = PuertoActivo 4000
$webViva = PuertoActivo 3000

if ($apiViva) {
  Nota 'el backend ya estaba en marcha'
} else {
  Paso 'Encendiendo el backend'
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/k', 'title Backend - Asistencia QR && npm --prefix backend run start:dev' `
    -WorkingDirectory $raiz | Out-Null
}

if ($webViva) {
  Nota 'el frontend ya estaba en marcha'
} else {
  Paso 'Encendiendo el frontend'
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/k', 'title Frontend - Asistencia QR && npm --prefix frontend run dev' `
    -WorkingDirectory $raiz | Out-Null
}

# ── Esperar a que respondan de verdad, no solo a que abra el puerto ──
Paso 'Esperando a que respondan'

function Responde($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
    return $r.StatusCode -eq 200
  } catch { return $false }
}

$limite = (Get-Date).AddSeconds(120)
$apiOk = $false
$webOk = $false

while ((Get-Date) -lt $limite) {
  if (-not $apiOk) { $apiOk = Responde 'http://localhost:4000/api/v1/health' }
  if (-not $webOk) { $webOk = Responde 'http://localhost:3000/login' }
  if ($apiOk -and $webOk) { break }
  Start-Sleep -Seconds 2
}

Write-Host ''
if ($apiOk) { Bien 'backend  http://localhost:4000' } else { Alto 'el backend no respondio a tiempo' }
if ($webOk) { Bien 'frontend http://localhost:3000' } else { Alto 'el frontend no respondio a tiempo' }

if (-not ($apiOk -and $webOk)) {
  Write-Host ''
  Nota 'Revise las ventanas que se abrieron: ahi aparece el motivo.'
  Nota 'La primera vez puede tardar mas de lo normal al compilar.'
  Write-Host ''
  exit 1
}

# ── Abrir el navegador ──────────────────────────────────────────────
if (-not $SinNavegador) {
  Start-Process 'http://localhost:3000/login' | Out-Null
}

Write-Host ''
Write-Host '  La aplicacion esta lista' -ForegroundColor Green
Write-Host ''
Write-Host '     http://localhost:3000' -ForegroundColor White
Write-Host ''
Nota 'Usuario     admin@datly.local'
Nota 'Contrasena  Admin123*'
Write-Host ''
Nota 'Se abrieron dos ventanas negras: son los servidores.'
Nota 'Dejelas abiertas mientras use la aplicacion.'
Write-Host ''
