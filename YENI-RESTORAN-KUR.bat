@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Serviq - Yeni Restoran Kurulumu

set "REPO_URL=https://github.com/artfailll/serviq-qr.git"
set "INSTALL_ROOT=%USERPROFILE%\Serviq"
set "REPO_DIR=%INSTALL_ROOT%\serviq-qr"
set "SCRIPT_DIR=%~dp0"

echo.
echo ==========================================
echo       SERVIQ - YENI RESTORAN KURULUMU
echo ==========================================
echo.

REM BAT dosyasi tek basina masaustunden calistirilirsa depoyu indir.
if exist "%SCRIPT_DIR%yeni-musteri.cjs" goto repo_ready

where git >nul 2>nul
if errorlevel 1 (
  echo HATA: Git bulunamadi. Git for Windows kurun: https://git-scm.com/download/win
  pause
  exit /b 1
)

if not exist "%INSTALL_ROOT%" mkdir "%INSTALL_ROOT%"
if not exist "%REPO_DIR%\.git" (
  echo Serviq GitHub deposu indiriliyor...
  git clone --branch feature/windows-restaurant-setup-bat "%REPO_URL%" "%REPO_DIR%"
  if errorlevel 1 (
    echo HATA: Depo indirilemedi. Ozel depo icin GitHub oturumunuzu kontrol edin.
    pause
    exit /b 1
  )
) else (
  echo Depo zaten mevcut: "%REPO_DIR%"
  git -C "%REPO_DIR%" status --porcelain >nul
  for /f "delims=" %%S in ('git -C "%REPO_DIR%" status --porcelain') do (
    echo HATA: Proje klasorunde yerel degisiklikler var. Otomatik guncelleme guvenli degil.
    echo Degisiklikleri yedekleyip temizledikten sonra tekrar calistirin.
    pause
    exit /b 1
  )
  echo Guncel kurulum dalina geciliyor...
  git -C "%REPO_DIR%" fetch origin feature/windows-restaurant-setup-bat
  if errorlevel 1 (
    echo HATA: GitHub'dan guncelleme alinamadi.
    pause
    exit /b 1
  )
  git -C "%REPO_DIR%" checkout feature/windows-restaurant-setup-bat
  if errorlevel 1 (
    echo HATA: Kurulum dalina gecilemedi.
    pause
    exit /b 1
  )
  git -C "%REPO_DIR%" pull --ff-only origin feature/windows-restaurant-setup-bat
  if errorlevel 1 (
    echo HATA: Kurulum dosyalari guncellenemedi.
    pause
    exit /b 1
  )
)
set "SCRIPT_DIR=%REPO_DIR%\"

:repo_ready
cd /d "%SCRIPT_DIR%"
if errorlevel 1 (
  echo HATA: Proje klasorune gecilemedi.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo HATA: Node.js bulunamadi. LTS surumunu kurun: https://nodejs.org/
  pause
  exit /b 1
)

if exist ".env" goto env_ready
if not exist ".env.example" goto env_template_missing

:configure_env
echo.
echo Ilk kurulum - Firebase ayarlari terminalden girilecek.
echo Firebase Console ^> Proje Ayarlari ^> Web uygulamasi bolumunden alabilirsin.
echo.
set "FB_API_KEY="
set /p "FB_API_KEY=Firebase API key: "
set "FB_DATABASE_URL="
set /p "FB_DATABASE_URL=Firebase Realtime Database URL (https://...): "
set "FB_PROJECT_ID="
set /p "FB_PROJECT_ID=Firebase Project ID: "
if not defined FB_API_KEY (
  echo HATA: Firebase API key bos olamaz.
  pause
  exit /b 1
)
if not defined FB_DATABASE_URL (
  echo HATA: Firebase Database URL bos olamaz.
  pause
  exit /b 1
)
if not defined FB_PROJECT_ID (
  echo HATA: Firebase Project ID bos olamaz.
  pause
  exit /b 1
)
echo %FB_DATABASE_URL%| findstr /b /i "https://" >nul
if errorlevel 1 (
  echo HATA: Database URL https:// ile baslamali.
  pause
  exit /b 1
)
> ".env" echo VITE_FIREBASE_API_KEY=%FB_API_KEY%
>> ".env" echo VITE_FIREBASE_DATABASE_URL=%FB_DATABASE_URL%
>> ".env" echo VITE_FIREBASE_PROJECT_ID=%FB_PROJECT_ID%
set "FB_AUTH_DOMAIN="
set /p "FB_AUTH_DOMAIN=Firebase Auth Domain (opsiyonel, Enter gec): "
set "FB_STORAGE_BUCKET="
set /p "FB_STORAGE_BUCKET=Firebase Storage Bucket (opsiyonel, Enter gec): "
set "FB_SENDER_ID="
set /p "FB_SENDER_ID=Firebase Messaging Sender ID (opsiyonel, Enter gec): "
set "FB_APP_ID="
set /p "FB_APP_ID=Firebase App ID (opsiyonel, Enter gec): "
if defined FB_AUTH_DOMAIN echo VITE_FIREBASE_AUTH_DOMAIN=%FB_AUTH_DOMAIN%>> ".env"
if defined FB_STORAGE_BUCKET echo VITE_FIREBASE_STORAGE_BUCKET=%FB_STORAGE_BUCKET%>> ".env"
if defined FB_SENDER_ID echo VITE_FIREBASE_MESSAGING_SENDER_ID=%FB_SENDER_ID%>> ".env"
if defined FB_APP_ID echo VITE_FIREBASE_APP_ID=%FB_APP_ID%>> ".env"
echo.
echo Firebase ayarlari kaydedildi.
goto env_ready

:env_template_missing
echo HATA: .env.example bulunamadi.
pause
exit /b 1

:env_ready

if not exist "node_modules" (
  echo Gerekli paketler kuruluyor...
  call npm install
  if errorlevel 1 (
    echo HATA: npm install basarisiz oldu.
    pause
    exit /b 1
  )
)

echo.
set "BIZ_NAME="
set /p "BIZ_NAME=Restoran adi: "
if not defined BIZ_NAME (
  echo HATA: Restoran adi bos olamaz.
  pause
  exit /b 1
)

set "BIZ_ID="
set /p "BIZ_ID=Isletme ID (or. sezgin-usta): "
if not defined BIZ_ID (
  echo HATA: Isletme ID bos olamaz.
  pause
  exit /b 1
)

set "TABLE_COUNT=10"
set /p "TABLE_COUNT=Masa sayisi [10]: "
if not defined TABLE_COUNT set "TABLE_COUNT=10"

set "BRAND_COLOR=#f97316"
set /p "BRAND_COLOR=Marka rengi HEX [#f97316]: "
if not defined BRAND_COLOR set "BRAND_COLOR=#f97316"

echo.
echo Not: Bu PIN, serviq.com.tr sunucusunda SERVIQ_ADMIN_PINS icinde tanimli PIN ile ayni olmalidir.
set "SERVIQ_ADMIN_PIN="
set /p "SERVIQ_ADMIN_PIN=Yonetim PIN'i (en az 8 karakter): "
if not defined SERVIQ_ADMIN_PIN (
  echo HATA: PIN bos olamaz.
  pause
  exit /b 1
)

echo.
echo Kurulum baslatiliyor...
node yeni-musteri.cjs "%BIZ_NAME%" "%BIZ_ID%" "%TABLE_COUNT%" "%BRAND_COLOR%"
set "RESULT=%ERRORLEVEL%"
set "SERVIQ_ADMIN_PIN="
if not "%RESULT%"=="0" (
  echo.
  echo Kurulum basarisiz. Yukaridaki hata mesajini kontrol edin.
  pause
  exit /b %RESULT%
)

echo.
echo Kurulum dosyalari hazir. kurulum-paketleri klasorunu kontrol edin.
echo QR-YAZDIR.html dosyasini acip QR kodlarini yazdirabilirsiniz.
pause
exit /b 0
