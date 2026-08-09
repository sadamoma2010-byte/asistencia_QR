<#
.SYNOPSIS
    Primer envío del proyecto a GitHub.

.DESCRIPTION
    Se ejecuta una sola vez. Abre el navegador para que usted inicie sesión en
    GitHub; la contraseña la escribe usted en la página de GitHub, no aquí.

    Una vez hecho esto, Windows recuerda el acceso y todas las publicaciones
    siguientes con publicar.ps1 funcionan sin volver a pedir nada.

.EXAMPLE
    .\scripts\conectar-github.ps1
#>

$ErrorActionPreference = 'Stop'
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

$remoto = git remote get-url origin 2>$null
if (-not $remoto) {
  Alto 'No hay repositorio remoto configurado.'
  Nota 'Configurelo con:'
  Nota '  git remote add origin https://github.com/USUARIO/REPOSITORIO.git'
  exit 1
}

Nota "Repositorio: $remoto"
Write-Host ''
Paso 'Enviando el proyecto'
Nota 'Se abrira una ventana del navegador para que inicie sesion en GitHub.'
Nota 'Escriba sus datos alli: no se guardan en este proyecto.'
Write-Host ''

git push -u origin main --follow-tags

if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Alto 'El envio no se completo.'
  Write-Host ''
  Nota 'Causas habituales:'
  Nota '  1. El repositorio no existe todavia en GitHub. Creelo primero,'
  Nota '     vacio, sin README ni .gitignore.'
  Nota '  2. El repositorio ya tiene commits. En ese caso ejecute:'
  Nota '       git pull origin main --allow-unrelated-histories'
  Nota '       git push -u origin main --follow-tags'
  Nota '  3. La cuenta no tiene permiso de escritura en ese repositorio.'
  Write-Host ''
  exit 1
}

Write-Host ''
Bien 'Proyecto publicado en GitHub'
Write-Host ''
Nota 'A partir de ahora, para publicar cada cambio:'
Nota '  .\scripts\publicar.ps1 "lo que cambio"'
Write-Host ''
