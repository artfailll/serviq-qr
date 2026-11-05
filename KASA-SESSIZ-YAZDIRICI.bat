@echo off
title Serviq Kasa - Sessiz Termal Yazici Modu
chcp 65001 >nul
echo ===================================================
echo   SERVIQ - SESSIZ TERMAL YAZICI (DIYALOGSUZ) MODU
echo ===================================================
echo.
echo Chrome sessiz yazdirma moduyla baslatiliyor...
echo.
echo Bu mod acikken:
echo 1) Garson telefondan siparis girip fis bastiginda,
echo 2) Kasa ekraninda "Fis" veya "Adisyon" butonuna basildiginda,
echo termal yazici HICBIR ONAY PENCERESI ACMADAN fişi
echo dogrudan ve otomatik olarak basar.
echo.

set "CHROME_PATH="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined CHROME_PATH (
  start "" "%CHROME_PATH%" --kiosk-printing --app="https://serviq.com.tr/kasa?isletme=sezgin-usta-doner"
) else (
  start "" chrome.exe --kiosk-printing --app="https://serviq.com.tr/kasa?isletme=sezgin-usta-doner"
)
exit
