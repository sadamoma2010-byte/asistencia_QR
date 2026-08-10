@echo off
chcp 65001 >nul
title Iniciar Asistencia QR
cd /d "%~dp0"

echo.
echo   ==================================================
echo     Sistema de Asistencia Docente por QR
echo   ==================================================
echo.
echo   Encendiendo la aplicacion...
echo.
echo   Se abriran dos ventanas negras: son los servidores.
echo   Dejelas abiertas mientras use la aplicacion.
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar.ps1"

echo.
pause
