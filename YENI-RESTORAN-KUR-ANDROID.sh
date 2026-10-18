#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

REPO_URL="https://github.com/artfailll/serviq-qr.git"
REPO_BRANCH="main"
INSTALL_ROOT="$HOME/Serviq"
REPO_DIR="$INSTALL_ROOT/serviq-qr"
ASKPASS_FILE=""
GH_TOKEN=""
GH_USER=""

cleanup() {
  if [ -n "$ASKPASS_FILE" ] && [ -f "$ASKPASS_FILE" ]; then rm -f "$ASKPASS_FILE"; fi
  unset GH_TOKEN SERVIQ_ADMIN_PIN || true
}
trap cleanup EXIT
fail() { printf '\nHATA: %s\n' "$*" >&2; exit 1; }

printf '\n==========================================\n'
printf '     SERVIQ - ANDROID RESTORAN KURULUMU\n'
printf '==========================================\n\n'

if [ -z "$PREFIX" ] || [ ! -d "$PREFIX/etc" ]; then
  fail "Bu dosya Android'de Termux içinde çalıştırılmalı."
fi
command -v pkg >/dev/null 2>&1 || fail "Termux pkg komutu bulunamadı."
printf 'Gerekli araçlar kontrol ediliyor...\n'
pkg install -y git nodejs-lts nano || pkg install -y git nodejs nano
command -v git >/dev/null 2>&1 || fail "Git kurulamadı."
command -v node >/dev/null 2>&1 || fail "Node.js kurulamadı."
command -v npm >/dev/null 2>&1 || fail "npm bulunamadı."

mkdir -p "$INSTALL_ROOT"
if [ ! -f "$REPO_DIR/yeni-musteri.cjs" ]; then
  printf '\nServiq deposu özel olduğu için GitHub erişimi gerekiyor.\n'
  printf 'Sadece depo okuma yetkili token kullanın; token dosyaya kaydedilmeyecek.\n'
  read -r -p 'GitHub kullanıcı adın: ' GH_USER
  [ -n "$GH_USER" ] || fail "GitHub kullanıcı adı boş olamaz."
  read -r -s -p 'GitHub token (ekranda görünmez): ' GH_TOKEN
  printf '\n'
  [ -n "$GH_TOKEN" ] || fail "GitHub token boş olamaz."
  ASKPASS_FILE="$(mktemp "$PREFIX/tmp/serviq-askpass.XXXXXX")"
  cat > "$ASKPASS_FILE" <<'ASKPASS'
#!/data/data/com.termux/files/usr/bin/sh
case "$1" in
  *Username*) printf '%s\n' "$SERVIQ_GH_USER" ;;
  *) printf '%s\n' "$SERVIQ_GH_TOKEN" ;;
esac
ASKPASS
  chmod 700 "$ASKPASS_FILE"
  export SERVIQ_GH_USER="$GH_USER" SERVIQ_GH_TOKEN="$GH_TOKEN"
  if ! GIT_ASKPASS="$ASKPASS_FILE" GIT_TERMINAL_PROMPT=0 git clone --branch "$REPO_BRANCH" "$REPO_URL" "$REPO_DIR"; then
    fail "GitHub deposu indirilemedi. Token yetkisini kontrol edin."
  fi
  unset SERVIQ_GH_USER SERVIQ_GH_TOKEN
  rm -f "$ASKPASS_FILE"
  ASKPASS_FILE=""
  unset GH_TOKEN GH_USER
else
  printf 'Mevcut proje bulundu: %s\nMevcut dosyalar otomatik güncellenmeyecek.\n' "$REPO_DIR"
fi

cd "$REPO_DIR"
[ -f .env.example ] || fail ".env.example bulunamadı."
if [ ! -f .env ]; then
  cp .env.example .env
  printf '\nFirebase ayarları için .env dosyası açılıyor.\n'
  nano .env
fi
if ! grep -Eq '^VITE_FIREBASE_API_KEY=.+$' .env || ! grep -Eq '^VITE_FIREBASE_DATABASE_URL=https://.+' .env || ! grep -Eq '^VITE_FIREBASE_PROJECT_ID=.+$' .env; then
  printf '\n.env içinde VITE_FIREBASE_API_KEY, HTTPS VITE_FIREBASE_DATABASE_URL ve VITE_FIREBASE_PROJECT_ID dolu olmalı.\n'
  printf 'Düzenlemek için: nano "%s/.env"\n' "$REPO_DIR"
  exit 1
fi
if [ ! -d node_modules ]; then
  printf '\nNode paketleri kuruluyor; ilk seferde biraz sürebilir...\n'
  npm install
fi

printf '\n--- Yeni restoran bilgileri ---\n'
read -r -p 'Restoran adı: ' BIZ_NAME
[ -n "$BIZ_NAME" ] || fail "Restoran adı boş olamaz."
read -r -p 'İşletme ID (ör. sezgin-usta): ' BIZ_ID
[ -n "$BIZ_ID" ] || fail "İşletme ID boş olamaz."
read -r -p 'Masa sayısı [10]: ' TABLE_COUNT
if [ -z "$TABLE_COUNT" ]; then TABLE_COUNT=10; fi
read -r -p 'Marka rengi HEX [#f97316]: ' BRAND_COLOR
if [ -z "$BRAND_COLOR" ]; then BRAND_COLOR="#f97316"; fi
printf '\nPIN, sunucuda SERVIQ_ADMIN_PINS içinde tanımlı olanla aynı olmalı.\n'
read -r -s -p 'Yönetim PIN’i (en az 8 karakter): ' SERVIQ_ADMIN_PIN
printf '\n'
PIN_LENGTH="$(printf '%s' "$SERVIQ_ADMIN_PIN" | wc -c | tr -d ' ')"
[ "$PIN_LENGTH" -ge 8 ] || fail "PIN en az 8 karakter olmalı."
export SERVIQ_ADMIN_PIN

OUTPUT_DIR="$REPO_DIR/kurulum-paketleri"
if command -v termux-setup-storage >/dev/null 2>&1; then
  read -r -p 'QR dosyalarını Android İndirilenler klasörüne kaydet? [E/h]: ' SHARE_OUTPUT
  if [ "$SHARE_OUTPUT" != "h" ] && [ "$SHARE_OUTPUT" != "H" ]; then
    termux-setup-storage || true
    if [ -d "$HOME/storage/shared/Download" ]; then
      OUTPUT_DIR="$HOME/storage/shared/Download/Serviq"
      mkdir -p "$OUTPUT_DIR"
    else
      printf 'Paylaşılan depolama yok; dosyalar proje klasörüne yazılacak.\n'
    fi
  fi
fi
export SERVIQ_OUTPUT_DIR="$OUTPUT_DIR"

printf '\nKurulum başlatılıyor...\n'
node yeni-musteri.cjs "$BIZ_NAME" "$BIZ_ID" "$TABLE_COUNT" "$BRAND_COLOR"
printf '\nKurulum tamamlandı.\nDosyalar: %s\n' "$OUTPUT_DIR"
printf 'QR-YAZDIR.html dosyasını açıp yazdırabilir veya paylaşabilirsin.\n'
printf 'Menü ürünlerini yönetim panelinden girmen gerekir.\n'
