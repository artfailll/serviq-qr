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

if not exist ".env.example" goto env_template_missing
if not exist ".env" goto configure_env
findstr /r /c:"^VITE_FIREBASE_API_KEY=." ".env" >nul
if errorlevel 1 goto configure_env
findstr /r /c:"^VITE_FIREBASE_DATABASE_URL=https://." ".env" >nul
if errorlevel 1 goto configure_env
findstr /r /c:"^VITE_FIREBASE_PROJECT_ID=." ".env" >nul
if errorlevel 1 goto configure_env
goto env_ready

:configure_env
echo.
echo Serviq'in canli Firebase ayarlari otomatik aliniyor...
call node scripts\bootstrap-firebase.cjs
if errorlevel 1 (
  echo.
  echo HATA: Firebase ayarlari otomatik alinamadi.
  echo Internet baglantisini kontrol edin; kurulum guvenlik icin durduruldu.
  pause
  exit /b 1
)
goto env_ready

:env_template_missing
echo HATA: .env.example bulunamadi.
pause
exit /b 1

:env_ready
if exist "node_modules" (
  call npm ls --depth=0 >nul 2>nul
  if not errorlevel 1 goto deps_ready
)
echo Gerekli paketler kuruluyor...
call npm install
if errorlevel 1 (
  echo HATA: npm install basarisiz oldu.
  pause
  exit /b 1
)

:deps_ready
echo.
set "BIZ_NAME=%SERVIQ_BUSINESS_NAME%"
if not defined BIZ_NAME set /p "BIZ_NAME=Restoran adi: "
if not defined BIZ_NAME (
  echo HATA: Restoran adi bos olamaz.
  pause
  exit /b 1
)

set "BIZ_ID=%SERVIQ_BUSINESS_ID%"
if not defined BIZ_ID set /p "BIZ_ID=Isletme ID (or. sezgin-usta): "
if not defined BIZ_ID (
  echo HATA: Isletme ID bos olamaz.
  pause
  exit /b 1
)

set "TABLE_COUNT=%SERVIQ_TABLE_COUNT%"
if not defined TABLE_COUNT set "TABLE_COUNT=10"
if not defined SERVIQ_TABLE_COUNT set /p "TABLE_COUNT=Masa sayisi [10]: "
if not defined TABLE_COUNT set "TABLE_COUNT=10"

set "BRAND_COLOR=%SERVIQ_BRAND_COLOR%"
if not defined BRAND_COLOR set "BRAND_COLOR=#f97316"
if not defined SERVIQ_BRAND_COLOR set /p "BRAND_COLOR=Marka rengi HEX [#f97316]: "
if not defined BRAND_COLOR set "BRAND_COLOR=#f97316"

echo.
echo Not: Bu PIN, serviq.com.tr sunucusunda SERVIQ_ADMIN_PINS icinde tanimli PIN ile ayni olmalidir.
set "SERVIQ_ADMIN_PIN=%SERVIQ_SETUP_ADMIN_PIN%"
if not defined SERVIQ_ADMIN_PIN set /p "SERVIQ_ADMIN_PIN=Yonetim PIN'i (en az 8 karakter): "
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
