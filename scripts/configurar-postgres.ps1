<#
.SYNOPSIS
    Deja el proyecto funcionando sobre PostgreSQL, con los datos migrados.

.DESCRIPTION
    Hace todo el proceso de una vez:

      1. Pide la contraseña de PostgreSQL (se escribe aquí, no viaja a ningún sitio)
      2. Comprueba la conexión
      3. Crea la base de datos si no existe
      4. Ejecuta database.sql para levantar toda la estructura
      5. Escribe DATABASE_URL en backend/.env
      6. Traspasa los datos de la base SQLite anterior
      7. Verifica que todo cuadre

    Si el paso de conexión falla, no toca nada más.

.PARAMETER Usuario
    Usuario de PostgreSQL. Por defecto 'postgres'.

.PARAMETER BaseDatos
    Nombre de la base. Por defecto 'asistencia_qr'.

.PARAMETER SinMigrarDatos
    Crea la estructura pero no traspasa los datos de SQLite.

.EXAMPLE
    .\scripts\configurar-postgres.ps1
#>

[CmdletBinding()]
param(
  [string]$Usuario = 'postgres',
  [string]$BaseDatos = 'asistencia_qr',
  [string]$Servidor = 'localhost',
  [int]$Puerto = 5432,
  [switch]$SinMigrarDatos
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
      Nota 'Si solo quiere migrar los datos a la estructura existente, ejecute:'
      Nota '  npm --prefix backend run db:migrar-datos'
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
  Paso 'Escribiendo la conexion en backend/.env'
  Add-Type -AssemblyName System.Web
  $usuarioEnc = [System.Web.HttpUtility]::UrlEncode($Usuario)
  $claveEnc   = [System.Web.HttpUtility]::UrlEncode($plana)
  $url = "postgresql://${usuarioEnc}:${claveEnc}@${Servidor}:${Puerto}/${BaseDatos}?schema=public"

  $envFile = Join-Path $raiz 'backend\.env'
  $contenido = if (Test-Path $envFile) { [System.IO.File]::ReadAllText($envFile) } else { '' }

  if ($contenido -match '(?m)^DATABASE_URL=') {
    $contenido = [regex]::Replace($contenido, '(?m)^DATABASE_URL=.*$', "DATABASE_URL=$url")
  } else {
    $contenido = "DATABASE_URL=$url`r`n" + $contenido
  }

  # Ruta a la base SQLite de origen, que necesita el traspaso de datos
  $sqliteUrl = 'SQLITE_URL=file:./data/app.db'
  if ($contenido -match '(?m)^SQLITE_URL=') {
    $contenido = [regex]::Replace($contenido, '(?m)^SQLITE_URL=.*$', $sqliteUrl)
  } else {
    $contenido = $contenido.TrimEnd() + "`r`n`r`n# Base anterior, solo para el traspaso de datos`r`n$sqliteUrl`r`n"
  }

  [System.IO.File]::WriteAllText($envFile, $contenido, (New-Object System.Text.UTF8Encoding($false)))
  Bien 'backend/.env actualizado'
  Nota 'La contrasena queda solo en ese archivo, excluido del repositorio.'

  # ── 5. Cliente de Prisma ───────────────────────────────────────
  Paso 'Generando el cliente de Prisma'
  Push-Location (Join-Path $raiz 'backend')
  & npx prisma generate 2>&1 | Out-Null
  Pop-Location
  Bien 'cliente generado'

  # ── 6. Traspaso de datos ───────────────────────────────────────
  $bd = Join-Path $raiz 'backend\prisma\data\app.db'

  if ($SinMigrarDatos) {
    Nota 'Se omite el traspaso de datos por peticion.'
  } elseif (-not (Test-Path $bd)) {
    Nota 'No hay base SQLite anterior: no hay datos que traspasar.'
  } else {
    Write-Host ''
    Paso 'Traspasando los datos de la base anterior'
    Push-Location (Join-Path $raiz 'backend')
    & npx prisma generate --schema prisma/schema.sqlite.prisma 2>&1 | Out-Null
    & npm run db:migrar-datos
    $resultado = $LASTEXITCODE
    Pop-Location

    if ($resultado -ne 0) {
      Write-Host ''
      Alto 'El traspaso de datos no se completo. La estructura si quedo creada.'
      exit 1
    }
  }

  # ── Resumen ────────────────────────────────────────────────────
  Write-Host ''
  Bien 'PostgreSQL configurado y listo'
  Write-Host ''
  Nota "Base de datos : $BaseDatos en ${Servidor}:${Puerto}"
  Nota 'Acceso        : admin@datly.local / Admin123*'
  Write-Host ''
  Nota 'Arranque:'
  Nota '  npm --prefix backend run start:dev'
  Nota '  npm --prefix frontend run dev'
  Write-Host ''
}
finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  $plana = $null
  [System.GC]::Collect()
}
