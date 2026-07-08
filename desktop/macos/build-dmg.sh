#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_NAME="HK Dijital"
APP_VERSION="0.1.0"
BUNDLE_NAME="HK Dijital.app"
EXECUTABLE_NAME="HKDijital"
MACOS_DIR="$ROOT_DIR/desktop/macos/HKDijital"
BUILD_DIR="$ROOT_DIR/desktop/build/macos"
DIST_DIR="$ROOT_DIR/desktop-builds"
APP_DIR="$BUILD_DIR/$BUNDLE_NAME"
DMG_STAGING_DIR="$BUILD_DIR/dmg-root"
DMG_PATH="$DIST_DIR/HK-Dijital-$APP_VERSION.dmg"

if ! command -v swiftc >/dev/null 2>&1; then
  echo "Hata: swiftc bulunamadı. Xcode veya Command Line Tools kurun: xcode-select --install" >&2
  exit 1
fi

if ! command -v hdiutil >/dev/null 2>&1; then
  echo "Hata: hdiutil bulunamadı. DMG üretimi macOS üzerinde çalışır." >&2
  exit 1
fi

rm -rf "$BUILD_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources" "$DIST_DIR"

swiftc \
  -target "$(uname -m)-apple-macos12.0" \
  -parse-as-library \
  -O \
  -framework SwiftUI \
  -framework WebKit \
  -framework AppKit \
  "$MACOS_DIR/Sources/"*.swift \
  -o "$APP_DIR/Contents/MacOS/$EXECUTABLE_NAME"

cp "$MACOS_DIR/Info.plist" "$APP_DIR/Contents/Info.plist"
cp "$ROOT_DIR/desktop/shared/desktop-config.json" "$APP_DIR/Contents/Resources/desktop-config.json"

if [ -f "$ROOT_DIR/desktop/shared/icons/AppIcon.icns" ]; then
  cp "$ROOT_DIR/desktop/shared/icons/AppIcon.icns" "$APP_DIR/Contents/Resources/AppIcon.icns"
fi

rm -f "$DMG_PATH"
mkdir -p "$DMG_STAGING_DIR"
cp -R "$APP_DIR" "$DMG_STAGING_DIR/$BUNDLE_NAME"
ln -s /Applications "$DMG_STAGING_DIR/Applications"

if command -v create-dmg >/dev/null 2>&1; then
  create-dmg \
    --volname "$APP_NAME" \
    --window-pos 200 120 \
    --window-size 640 420 \
    --icon-size 96 \
    --app-drop-link 460 210 \
    "$DMG_PATH" \
    "$DMG_STAGING_DIR" || {
      echo "Uyarı: create-dmg başarısız oldu. hdiutil ile temel DMG üretimi deneniyor." >&2
      hdiutil create -volname "$APP_NAME" -srcfolder "$DMG_STAGING_DIR" -ov -format UDZO "$DMG_PATH"
    }
else
  echo "Bilgi: create-dmg yüklü değil. hdiutil ile temel DMG üretimi yapılıyor." >&2
  hdiutil create \
    -volname "$APP_NAME" \
    -srcfolder "$DMG_STAGING_DIR" \
    -ov \
    -format UDZO \
    "$DMG_PATH"
fi

echo "DMG üretildi: $DMG_PATH"
