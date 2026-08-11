<#
.SYNOPSIS
    Deja la base de datos PostgreSQL creada y conectada.

.DESCRIPTION
    Hace todo el proceso de una vez:

      1. Pide la contraseña de PostgreSQL (se escribe aquí, no viaja a ningún sitio)
      2. Comprueba la conexión
      3. Crea la base de datos si no existe
      4. Ejecuta database.sql para levantar toda la estructura
      5. Escribe DATABASE_URL en el archivo .env

    Si el paso de conexión falla, no toca nada más.

.PARAMETER Usuario
    Usuario de PostgreSQL. Por defecto 'postgres'.

.PARAMETER BaseDatos
    Nombre de la base. Por defecto 'asistencia_qr'.

.EXAMPLE
    .\scripts\configurar-postgres.ps1
#>

[CmdletBinding()]
param(
  [string]$Usuario = 'postgres',
  [string]$BaseDatos = 'asistencia_qr',
  [string]$Servidor = 'localhost',
  [int]$Puerto = 5432
)

$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Paso($t) { Write-Host ("  > " + $t) -ForegroundColor Cyan }
function Bien($t) { Write-Host ("  OK " + $t) -ForegroundColor Green }
function Alto($t) { Write-Host ("  x  " + $t) -ForegroundColor Red }
function Nota($t) { Write-Host ("     " + $t) -ForegroundColor DarkGray }

Write-Host ''
Write-Host '  Configurar PostgreSQL' -ForegroundColor White
Write-Host '  ---------------------' -ForegroundColor DarkGray
Write-Host ''

# ── Localizar las herramientas de PostgreSQL ─────────────────────
$bin = $null
$base = Join-Path $env:ProgramFiles 'PostgreSQL'
if (Test-Path $base) {
  $candidatos = Get-ChildItem $base -Directory | Sort-Object Name -Descending
  foreach ($c in $candidatos) {
    $ruta = Join-Path $c.FullName 'bin'
    if (Test-Path (Join-Path $ruta 'psql.exe')) { $bin = $ruta; break }
  }
}

if (-not $bin) {
  Alto 'No se encontro psql.exe.'
  Nota 'Instale PostgreSQL desde https://www.postgresql.org/download/windows/'
  exit 1
}
Nota "Herramientas: $bin"

$psql     = Join-Path $bin 'psql.exe'
$createdb = Join-Path $bin 'createdb.exe'

# ── Contraseña ───────────────────────────────────────────────────
Write-Host ''
$segura = Read-Host "  Contrasena de PostgreSQL (usuario '$Usuario')" -AsSecureString
$plana = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura))

if ([string]::IsNullOrWhiteSpace($plana)) {
  Alto 'No se ingreso ninguna contrasena.'
  exit 1
}

# psql lee la contrasena de esta variable; se limpia al terminar
$env:PGPASSWORD = $plana

try {
  # ── 1. Conexion ────────────────────────────────────────────────
  Write-Host ''
  Paso 'Comprobando la conexion'
  & $psql -U $Usuario -h $Servidor -p $Puerto -d postgres -c 'SELECT 1' 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Alto 'No fue posible conectar. Revise la contrasena y que el servicio este activo.'
    exit 1
  }
  $version = (& $psql -U $Usuario -h $Servidor -p $Puerto -d postgres -tAc 'SHOW server_version' 2>$null).Trim()
  Bien "conectado a PostgreSQL $version"

  # ── 2. Base de datos ───────────────────────────────────────────
  Paso "Preparando la base '$BaseDatos'"
  $existe = & $psql -U $Usuario -h $Servidor -p $Puerto -d postgres -tAc `
    "SELECT 1 FROM pg_database WHERE datname='$BaseDatos'" 2>$null

  if ($existe -eq '1') {
    Nota 'Ya existe. Se usara la base actual.'
    $tablas = & $psql -U $Usuario -h $Servidor -p $Puerto -d $BaseDatos -tAc `
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>$null
    if ([int]$tablas -gt 0) {
      Write-Host ''
      Alto "La base '$BaseDatos' ya contiene $tablas tabla(s)."
      Nota 'Para reconstruirla desde cero, primero eliminela:'
      Nota "  dropdb -U $Usuario $BaseDatos"
      Nota 'y despues vuelva a ejecutar este guion.'
      Write-Host ''
      exit 1
    }
  } else {
    & $createdb -U $Usuario -h $Servidor -p $Puerto -E UTF8 $BaseDatos 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Alto 'No fue posible crear la base.'; exit 1 }
    Bien "base '$BaseDatos' creada"
  }

  # ── 3. Estructura ──────────────────────────────────────────────
  Paso 'Creando la estructura con database.sql'
  $sql = Join-Path $raiz 'database.sql'
  if (-not (Test-Path $sql)) { Alto 'No se encontro database.sql en la raiz.'; exit 1 }

  $salida = & $psql -U $Usuario -h $Servidor -p $Puerto -d $BaseDatos -v ON_ERROR_STOP=1 -f $sql 2>&1
  if ($LASTEXITCODE -ne 0) {
    Alto 'database.sql fallo:'
    $salida | Select-Object -Last 12 | ForEach-Object { Nota $_ }
    exit 1
  }

  $t = & $psql -U $Usuario -h $Servidor -p $Puerto -d $BaseDatos -tAc `
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>$null
  $v = & $psql -U $Usuario -h $Servidor -p $Puerto -d $BaseDatos -tAc `
    "SELECT COUNT(*) FROM information_schema.views WHERE table_schema='public'" 2>$null
  Bien "estructura creada: $($t.Trim()) tablas, $($v.Trim()) vistas"

  # ── 4. Cadena de conexion en .env ──────────────────────────────
  Paso 'Escribiendo la conexion en .env'
  Add-Type -AssemblyName System.Web
  $usuarioEnc = [System.Web.HttpUtility]::UrlEncode($Usuario)
  $claveEnc   = [System.Web.HttpUtility]::UrlEncode($plana)
  $url = "postgresql://${usuarioEnc}:${claveEnc}@${Servidor}:${Puerto}/${BaseDatos}?schema=public"

  $envFile = Join-Path $raiz '.env'
  $contenido = if (Test-Path $envFile) { [System.IO.File]::ReadAllText($envFile) } else { '' }

  if ($contenido -match '(?m)^DATABASE_URL=') {
    $contenido = [regex]::Replace($contenido, '(?m)^DATABASE_URL=.*$', "DATABASE_URL=$url")
  } else {
    $contenido = "DATABASE_URL=$url`r`n" + $contenido
  }

  [System.IO.File]::WriteAllText($envFile, $contenido, (New-Object System.Text.UTF8Encoding($false)))
  Bien '.env actualizado'
  Nota 'La contrasena queda solo en ese archivo, excluido del repositorio.'

  # ── Resumen ────────────────────────────────────────────────────
  Write-Host ''
  Bien 'PostgreSQL configurado y listo'
  Write-Host ''
  Nota "Base de datos : $BaseDatos en ${Servidor}:${Puerto}"
  Nota 'Acceso        : admin@datly.local / Admin123*'
  Write-Host ''
  Nota 'Arranque:'
  Nota '  INICIAR-APLICACION.bat'
  Write-Host ''
}
finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  $plana = $null
  [System.GC]::Collect()
}
