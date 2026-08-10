@echo off
chcp 65001 >nul
title Configurar PostgreSQL
cd /d "%~dp0"

echo.
echo   ==================================================
echo     Configurar la base de datos PostgreSQL
echo   ==================================================
echo.
echo   Este proceso hace todo de una vez:
echo.
echo     1. Comprueba la conexion con PostgreSQL
echo     2. Crea la base de datos  asistencia_qr
echo     3. Ejecuta database.sql (tablas, vistas, datos)
echo     4. Guarda la conexion en backend\.env
echo     5. Traspasa los datos de la base anterior
echo.
echo   Se le pedira la contrasena de PostgreSQL.
echo   Se usa en memoria y se borra al terminar.
echo.
echo   --------------------------------------------------
echo.
pause

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\configurar-postgres.ps1"

echo.
echo   Si termino correctamente, avise para verificar el sistema.
echo.
pause
