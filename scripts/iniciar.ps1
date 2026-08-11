<#
.SYNOPSIS
    Enciende la aplicación y abre el navegador.

.DESCRIPTION
    Deja el sistema listo para usar en un solo paso:

      1. Comprueba que la conexión a PostgreSQL esté configurada
      2. Comprueba que el motor PostgreSQL esté escuchando
      3. Comprueba que el entorno de Python esté instalado
      4. Enciende la aplicación en su propia ventana
      5. Espera a que responda de verdad
      6. Abre el navegador en la pantalla de acceso

    Si algo falta, lo dice antes de encender nada y explica cómo resolverlo.

    La ventana que abre es independiente: la aplicación sigue en marcha
    aunque se cierre esta. Para apagarla, ciérrela o use .\scripts\detener.ps1

.PARAMETER SinNavegador
    Enciende el servidor pero no abre el navegador.

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

# ── Un puerto ocupado significa que ya está en marcha ───────────────
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
$entorno = Join-Path $raiz '.env'
if (-not (Test-Path $entorno)) {
  Alto 'Falta el archivo .env: la base de datos no esta configurada.'
  Nota 'Ejecute primero CONFIGURAR-BASE-DE-DATOS.bat'
  Write-Host ''
  exit 1
}

$conexion = (Get-Content $entorno | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', ''
if (-not $conexion -or $conexion -notmatch '^postgresql://') {
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

# ── Comprobar el entorno de Python ──────────────────────────────────
$python = Join-Path $raiz '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
  Alto 'Falta el entorno de Python.'
  Nota 'Creelo con:'
  Nota ''
  Nota '   python -m venv .venv'
  Nota '   .venv\Scripts\pip install -r requirements.txt'
  Write-Host ''
  exit 1
}
Bien 'entorno de Python instalado'

# ── Encender ────────────────────────────────────────────────────────
if (PuertoActivo 4000) {
  Nota 'la aplicacion ya estaba en marcha'
} else {
  Paso 'Encendiendo la aplicacion'
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/k', 'title Asistencia QR - Python && .venv\Scripts\python.exe servidor.py' `
    -WorkingDirectory $raiz | Out-Null
}

# ── Esperar a que responda de verdad ────────────────────────────────
Paso 'Esperando a que responda'

function Responde($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
    return $r.StatusCode -eq 200
  } catch { return $false }
}

$limite = (Get-Date).AddSeconds(90)
$listo = $false
while ((Get-Date) -lt $limite) {
  if (Responde 'http://localhost:4000/login') { $listo = $true; break }
  Start-Sleep -Seconds 2
}

Write-Host ''
if (-not $listo) {
  Alto 'la aplicacion no respondio a tiempo'
  Write-Host ''
  Nota 'Revise la ventana que se abrio: ahi aparece el motivo.'
  Write-Host ''
  exit 1
}
Bien 'aplicacion  http://localhost:4000'

if (-not $SinNavegador) {
  Start-Process 'http://localhost:4000/login' | Out-Null
}

Write-Host ''
Write-Host '  La aplicacion esta lista' -ForegroundColor Green
Write-Host ''
Write-Host '     http://localhost:4000' -ForegroundColor White
Write-Host ''
Nota 'Usuario     admin@datly.local'
Nota 'Contrasena  Admin123*'
Write-Host ''
Nota 'Se abrio una ventana negra: es el servidor.'
Nota 'Dejela abierta mientras use la aplicacion.'
Write-Host ''
