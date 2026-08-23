#!/usr/bin/env bash
set -euo pipefail

# HK Digital native macOS app + DMG — single command, fully reproducible:
#   npm run desktop:mac
# Every step below (compile, bundle, icon, ad-hoc sign, verify, package,
# verify DMG) runs every time; nothing about the output artifacts needs a
# manual post-build patch. Personal-use build only — no Developer ID, no
# notarization, no App Store steps (see the "Signing" note this script
# prints at the end).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MACOS_DIR="$ROOT_DIR/desktop/macos/HKDijital"
SHARED_DIR="$ROOT_DIR/desktop/shared"
BUILD_DIR="$ROOT_DIR/desktop/build/macos"
DIST_DIR="$ROOT_DIR/desktop-builds"

APP_NAME="HK Digital"
BUNDLE_NAME="$APP_NAME.app"
EXECUTABLE_NAME="HKDijital"
BUNDLE_ID="tr.com.hkdijital.admin.desktop"

APP_DIR="$BUILD_DIR/$BUNDLE_NAME"
DMG_STAGING_DIR="$BUILD_DIR/dmg-root"
ICONSET_DIR="$BUILD_DIR/AppIcon.iconset"

log() { echo "==> $1"; }
fail() { echo "Hata: $1" >&2; exit 1; }

# --- 0. Preconditions --------------------------------------------------
command -v swiftc >/dev/null 2>&1 || fail "swiftc bulunamadı. Xcode Command Line Tools kurun: xcode-select --install"
command -v hdiutil >/dev/null 2>&1 || fail "hdiutil bulunamadı. DMG üretimi macOS üzerinde çalışır."
command -v iconutil >/dev/null 2>&1 || fail "iconutil bulunamadı."
command -v sips >/dev/null 2>&1 || fail "sips bulunamadı."
command -v plutil >/dev/null 2>&1 || fail "plutil bulunamadı."
command -v codesign >/dev/null 2>&1 || fail "codesign bulunamadı."

# --- Version: single source of truth is desktop/shared/desktop-config.json
APP_VERSION="$(python3 -c "import json; print(json.load(open('$SHARED_DIR/desktop-config.json'))['version'])" 2>/dev/null || echo "1.0.0")"
BUILD_NUMBER="1"
DMG_PATH="$DIST_DIR/HK-Digital-$APP_VERSION.dmg"

log "Sürüm: $APP_VERSION (build $BUILD_NUMBER)"

# --- 1. Clean previous build --------------------------------------------
log "1/11 Önceki build temizleniyor"
rm -rf "$BUILD_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources" "$DIST_DIR"

# --- 2. Compile native Swift app -----------------------------------------
log "2/11 Swift derleniyor"
swiftc \
  -target "$(uname -m)-apple-macos12.0" \
  -parse-as-library \
  -O \
  -framework SwiftUI \
  -framework WebKit \
  -framework AppKit \
  -framework Network \
  -framework UserNotifications \
  -lsqlite3 \
  "$MACOS_DIR/Sources/"*.swift \
  -o "$APP_DIR/Contents/MacOS/$EXECUTABLE_NAME"

# --- 3. App bundle: Info.plist (version injected, single source of truth) -
log "3/11 Info.plist yazılıyor (sürüm: $APP_VERSION build $BUILD_NUMBER)"
plutil -convert xml1 -o "$APP_DIR/Contents/Info.plist" "$MACOS_DIR/Info.plist"
plutil -replace CFBundleShortVersionString -string "$APP_VERSION" "$APP_DIR/Contents/Info.plist"
plutil -replace CFBundleVersion -string "$BUILD_NUMBER" "$APP_DIR/Contents/Info.plist"

# --- 4. Resources: shared config + icon ----------------------------------
log "4/11 Kaynaklar kopyalanıyor"
cp "$SHARED_DIR/desktop-config.json" "$APP_DIR/Contents/Resources/desktop-config.json"
[ -f "$SHARED_DIR/sync-manifest.json" ] && cp "$SHARED_DIR/sync-manifest.json" "$APP_DIR/Contents/Resources/sync-manifest.json"

if [ -f "$SHARED_DIR/icons/AppIcon-source.png" ]; then
  log "   App icon üretiliyor (sips + iconutil, gerçek HK Dijital marka assetinden)"
  rm -rf "$ICONSET_DIR"
  mkdir -p "$ICONSET_DIR"
  SRC="$SHARED_DIR/icons/AppIcon-source.png"
  sips -z 16 16 "$SRC" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
  sips -z 32 32 "$SRC" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
  sips -z 32 32 "$SRC" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
  sips -z 64 64 "$SRC" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
  sips -z 128 128 "$SRC" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
  sips -z 256 256 "$SRC" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
  sips -z 256 256 "$SRC" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
  sips -z 512 512 "$SRC" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
  sips -z 512 512 "$SRC" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
  cp "$SRC" "$ICONSET_DIR/icon_512x512@2x.png"
  iconutil -c icns "$ICONSET_DIR" -o "$APP_DIR/Contents/Resources/AppIcon.icns"
else
  log "   Uyarı: $SHARED_DIR/icons/AppIcon-source.png bulunamadı — icon'suz devam ediliyor."
fi

# --- 5. Ad-hoc code signing (personal use — no Developer ID needed) -----
log "5/11 Ad-hoc imzalanıyor (Developer ID/notarization DEĞİL — yalnızca kişisel kullanım)"
codesign --force --deep --sign - "$APP_DIR"

# --- 6. Validate Info.plist ----------------------------------------------
log "6/11 Info.plist doğrulanıyor"
plutil -lint "$APP_DIR/Contents/Info.plist" || fail "Info.plist geçersiz."

# --- 7. Validate code signature -------------------------------------------
log "7/11 Kod imzası doğrulanıyor"
codesign --verify --deep --strict --verbose=2 "$APP_DIR" || fail "codesign doğrulaması başarısız."

# --- 8. Bundle structure sanity check -------------------------------------
log "8/11 App bundle yapısı doğrulanıyor"
[ -x "$APP_DIR/Contents/MacOS/$EXECUTABLE_NAME" ] || fail "Yürütülebilir dosya eksik."
[ -f "$APP_DIR/Contents/Info.plist" ] || fail "Info.plist eksik."
[ -d "$APP_DIR/Contents/Resources" ] || fail "Resources klasörü eksik."

# --- 9. Launch test (real process start, not just "it compiled") --------
log "9/11 Uygulama gerçekten başlatılıp test ediliyor"
LAUNCH_LOG="$BUILD_DIR/launch-test.log"
"$APP_DIR/Contents/MacOS/$EXECUTABLE_NAME" > "$LAUNCH_LOG" 2>&1 &
LAUNCH_PID=$!
sleep 3
if kill -0 "$LAUNCH_PID" 2>/dev/null; then
  log "   Uygulama süreci başladı ve 3 saniye boyunca crash olmadı (PASS, pid $LAUNCH_PID)"
  kill "$LAUNCH_PID" >/dev/null 2>&1 || true
  wait "$LAUNCH_PID" 2>/dev/null || true
else
  echo "Hata: Uygulama süreci 3 saniye içinde sonlandı (crash olabilir) — launch log:" >&2
  cat "$LAUNCH_LOG" 2>/dev/null >&2 || true
  fail "Launch testi başarısız."
fi

# --- 10. Build the DMG -----------------------------------------------------
log "10/11 DMG oluşturuluyor"
rm -f "$DMG_PATH"
rm -rf "$DMG_STAGING_DIR"
mkdir -p "$DMG_STAGING_DIR"
cp -R "$APP_DIR" "$DMG_STAGING_DIR/$BUNDLE_NAME"
ln -s /Applications "$DMG_STAGING_DIR/Applications"

if command -v create-dmg >/dev/null 2>&1; then
  create-dmg \
    --volname "$APP_NAME" \
    --window-pos 200 120 \
    --window-size 640 420 \
    --icon-size 96 \
    --icon "$BUNDLE_NAME" 160 210 \
    --app-drop-link 460 210 \
    "$DMG_PATH" \
    "$DMG_STAGING_DIR" || {
      echo "Uyarı: create-dmg başarısız oldu. hdiutil ile temel DMG üretimi deneniyor." >&2
      hdiutil create -volname "$APP_NAME" -srcfolder "$DMG_STAGING_DIR" -ov -format UDZO "$DMG_PATH"
    }
else
  hdiutil create -volname "$APP_NAME" -srcfolder "$DMG_STAGING_DIR" -ov -format UDZO "$DMG_PATH"
fi

[ -f "$DMG_PATH" ] || fail "DMG üretilemedi."

# --- 11. Verify the DMG ----------------------------------------------------
log "11/11 DMG doğrulanıyor"
hdiutil verify "$DMG_PATH" || fail "hdiutil verify başarısız."

MOUNT_OUTPUT="$(hdiutil attach "$DMG_PATH" -nobrowse -readonly -mountrandom /tmp)"
MOUNT_POINT="$(echo "$MOUNT_OUTPUT" | grep -Eo '/tmp/dmg\.[A-Za-z0-9]+' | tail -1)"
if [ -z "$MOUNT_POINT" ]; then
  MOUNT_POINT="$(echo "$MOUNT_OUTPUT" | tail -1 | awk -F'\t' '{print $NF}')"
fi
if [ -d "$MOUNT_POINT/$BUNDLE_NAME" ] && [ -e "$MOUNT_POINT/Applications" ]; then
  log "   DMG mount testi PASS: $BUNDLE_NAME ve Applications bağlantısı mevcut."
else
  hdiutil detach "$MOUNT_POINT" -quiet || true
  fail "DMG mount testinde $BUNDLE_NAME veya Applications bağlantısı bulunamadı."
fi
hdiutil detach "$MOUNT_POINT" -quiet

DMG_SIZE="$(du -h "$DMG_PATH" | cut -f1)"
DMG_SHA256="$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')"
APP_SIZE="$(du -sh "$APP_DIR" | cut -f1)"

echo ""
echo "================================================================"
echo "HK Digital native macOS build tamamlandı"
echo "----------------------------------------------------------------"
echo "APP:          $APP_DIR ($APP_SIZE)"
echo "DMG:          $DMG_PATH ($DMG_SIZE)"
echo "SHA256:       $DMG_SHA256"
echo "Bundle ID:    $BUNDLE_ID"
echo "Sürüm:        $APP_VERSION (build $BUILD_NUMBER)"
echo "İmzalama:     Ad-hoc (codesign --sign -) — Developer ID YOK, notarization YOK."
echo "              Bu build yalnızca bu Mac'te / imzasız uygulamalara izin"
echo "              veren Mac'lerde ilk açılışta Finder sağ tık > Aç ile"
echo "              çalıştırılabilir. Başka bir Mac'e dağıtılırsa Gatekeeper"
echo "              uyarısı beklenir; bu normaldir ve global güvenlik"
echo "              ayarlarının değiştirilmesini gerektirmez."
echo "================================================================"
