<#
.SYNOPSIS
    Apaga la aplicación: cierra el backend y el frontend.

.DESCRIPTION
    Localiza qué proceso ocupa cada puerto y lo cierra. No toca PostgreSQL:
    el motor de base de datos es un servicio de Windows y sigue en marcha.

.EXAMPLE
    .\scripts\detener.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'

function Bien($t) { Write-Host ("  OK " + $t) -ForegroundColor Green }
function Nota($t) { Write-Host ("     " + $t) -ForegroundColor DarkGray }

Write-Host ''
Write-Host '  Detener la aplicacion' -ForegroundColor White
Write-Host '  ---------------------' -ForegroundColor DarkGray
Write-Host ''

# Cada servidor se identifica por el puerto que ocupa. El 3000 solo lo usaba
# el frontend en Next.js; se conserva para poder apagar una sesion antigua.
foreach ($p in @(@{ n = 'frontend anterior'; puerto = 3000 }, @{ n = 'aplicacion'; puerto = 4000 })) {
  $conexiones = Get-NetTCPConnection -LocalPort $p.puerto -State Listen -ErrorAction SilentlyContinue
  if (-not $conexiones) {
    Nota ("el " + $p.n + " no estaba en marcha")
    continue
  }
  foreach ($id in ($conexiones.OwningProcess | Select-Object -Unique)) {
    try {
      Stop-Process -Id $id -Force -ErrorAction Stop
      Bien ($p.n + " detenido (puerto " + $p.puerto + ")")
    } catch {
      Nota ("no se pudo detener el proceso " + $id + " del " + $p.n)
    }
  }
}

Write-Host ''
Nota 'PostgreSQL sigue encendido: es un servicio de Windows.'
Write-Host ''
