@echo off
chcp 65001 >nul
title Subir el proyecto a GitHub
cd /d "%~dp0"

echo.
echo   ============================================
echo     Subir el proyecto a GitHub
echo   ============================================
echo.
echo   Se abrira una ventana del navegador para que
echo   inicie sesion en GitHub.
echo.
echo   Su contrasena la escribe usted en la pagina de
echo   GitHub. No se guarda en este proyecto.
echo.
echo   --------------------------------------------
echo.
pause

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\conectar-github.ps1"

echo.
pause
