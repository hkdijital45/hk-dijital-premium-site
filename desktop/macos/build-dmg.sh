#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_NAME="HK Dijital"
BUNDLE_NAME="HK Dijital.app"
EXECUTABLE_NAME="HKDijital"
MACOS_DIR="$ROOT_DIR/desktop/macos/HKDijital"
BUILD_DIR="$ROOT_DIR/desktop/build/macos"
DIST_DIR="$ROOT_DIR/desktop/dist/macos"
APP_DIR="$BUILD_DIR/$BUNDLE_NAME"
DMG_PATH="$DIST_DIR/HK-Dijital.dmg"

if ! command -v swiftc >/dev/null 2>&1; then
  echo "Hata: swiftc bulunamadı. Xcode veya Command Line Tools kurun: xcode-select --install" >&2
  exit 1
fi

if ! command -v hdiutil >/dev/null 2>&1; then
  echo "Hata: hdiutil bulunamadı. DMG üretimi macOS üzerinde çalışır." >&2
  exit 1
fi

rm -rf "$BUILD_DIR" "$DIST_DIR"
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
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$APP_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

echo "DMG üretildi: $DMG_PATH"
