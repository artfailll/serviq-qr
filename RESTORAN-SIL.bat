@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Serviq - Restoran Silme ve Kaldirma

set "INSTALL_ROOT=%USERPROFILE%\Serviq"
set "REPO_DIR=%INSTALL_ROOT%\serviq-qr"

echo.
echo ==========================================
echo      SERVIQ - RESTORAN KALDIRMA
echo ==========================================
echo.
echo Mevcut restoranlar ve ID'leri masaustunuzdeki
echo "KURULU-RESTORANLAR.txt" dosyasinda yer almaktadir.
echo.

if not exist "%REPO_DIR%" (
  echo HATA: Serviq kurulum klasoru bulunamadi: "%REPO_DIR%"
  pause
  exit /b 1
)

cd /d "%REPO_DIR%"
if errorlevel 1 (
  echo HATA: Serviq klasorune gecilemedi.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo HATA: Node.js bulunamadi.
  pause
  exit /b 1
)

set "DEL_ID=%~1"
if not defined DEL_ID set /p "DEL_ID=Silinecek Restoran ID (or. test1): "

if not defined DEL_ID (
  echo.
  echo HATA: Isletme ID bos birakilamaz.
  pause
  exit /b 1
)

echo.
node scripts\deprovision.cjs "%DEL_ID%"
set "RESULT=%ERRORLEVEL%"

if not "%RESULT%"=="0" (
  echo.
  echo Islem tamamlanamadi veya iptal edildi.
  pause
  exit /b %RESULT%
)

echo.
pause
exit /b 0
