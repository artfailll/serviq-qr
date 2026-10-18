@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Serviq - Yeni Restoran Kurulumu

set "REPO_URL=https://github.com/artfailll/serviq-qr.git"
set "INSTALL_BRANCH=main"
set "INSTALL_ROOT=%USERPROFILE%\Serviq"
set "REPO_DIR=%INSTALL_ROOT%\serviq-qr"

echo.
echo ==========================================
echo       SERVIQ - YENI RESTORAN KURULUMU
echo ==========================================
echo.

REM Her zaman yonetilen kurulum kopyasini kullan; BAT'in indirildigi klasore guvenme.
where git >nul 2>nul
if errorlevel 1 (
  echo HATA: Git bulunamadi. Git for Windows kurun: https://git-scm.com/download/win
  pause
  exit /b 1
)

if not exist "%INSTALL_ROOT%" mkdir "%INSTALL_ROOT%"
if errorlevel 1 (
  echo HATA: Kurulum klasoru olusturulamadi: "%INSTALL_ROOT%"
  pause
  exit /b 1
)

if exist "%REPO_DIR%\.git" goto update_repo
if exist "%REPO_DIR%" (
  echo HATA: "%REPO_DIR%" klasoru var ancak Git deposu degil.
  echo Klasoru yeniden adlandirip BAT dosyasini tekrar calistirin.
  pause
  exit /b 1
)

echo Serviq deposu indiriliyor...
git clone --branch "%INSTALL_BRANCH%" "%REPO_URL%" "%REPO_DIR%"
if errorlevel 1 (
  echo HATA: Depo indirilemedi. Ozel depo icin GitHub oturumunuzu kontrol edin.
  pause
  exit /b 1
)
goto repo_ready

:update_repo
echo Mevcut Serviq kurulumu kontrol ediliyor...
git -C "%REPO_DIR%" diff --quiet
if errorlevel 1 (
  echo HATA: Proje dosyalarinda kaydedilmemis degisiklikler var.
  echo Degisiklikleri yedekleyip commit edin veya geri alin; hicbir dosya silinmedi.
  pause
  exit /b 1
)
git -C "%REPO_DIR%" diff --cached --quiet
if errorlevel 1 (
  echo HATA: Git'e eklenmis ama commit edilmemis degisiklikler var.
  echo Degisiklikleri commit edin veya geri alin; hicbir dosya silinmedi.
  pause
  exit /b 1
)
git -C "%REPO_DIR%" fetch origin "refs/heads/%INSTALL_BRANCH%:refs/remotes/origin/%INSTALL_BRANCH%"
if errorlevel 1 (
  echo HATA: GitHub'dan guncelleme alinamadi.
  pause
  exit /b 1
)
git -C "%REPO_DIR%" show-ref --verify --quiet "refs/heads/%INSTALL_BRANCH%"
if errorlevel 1 (
  git -C "%REPO_DIR%" checkout -b "%INSTALL_BRANCH%" --track "origin/%INSTALL_BRANCH%"
) else (
  git -C "%REPO_DIR%" checkout "%INSTALL_BRANCH%"
)
if errorlevel 1 (
  echo HATA: "%INSTALL_BRANCH%" dalina gecilemedi.
  pause
  exit /b 1
)
git -C "%REPO_DIR%" pull --ff-only origin "%INSTALL_BRANCH%"
if errorlevel 1 (
  echo HATA: Kurulum dosyalari guvenli sekilde guncellenemedi.
  echo Yerel commitler olabilir; elle kontrol edin.
  pause
  exit /b 1
)

:repo_ready
cd /d "%REPO_DIR%"
if errorlevel 1 (
  echo HATA: Proje klasorune gecilemedi.
  pause
  exit /b 1
)

if not exist "yeni-musteri.cjs" (
  echo HATA: yeni-musteri.cjs bulunamadi. Depo eksik olabilir.
  pause
  exit /b 1
)
if not exist "scripts\provision.cjs" (
  echo HATA: scripts\provision.cjs bulunamadi. Depo eksik olabilir.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo HATA: Node.js bulunamadi. LTS surumunu kurun: https://nodejs.org/
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo HATA: npm bulunamadi. Node.js LTS kurulumunu onarip tekrar deneyin.
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
