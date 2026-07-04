# HK Dijital macOS Dağıtımı

Bu yapı Electron veya PWA kullanmaz. SwiftUI + WKWebView ile canlı HK Dijital web uygulamasını açan hafif native wrapper üretir.

Canlı URL:

```text
https://hkdijital.com.tr
```

## Gereksinimler

- macOS
- Xcode veya Command Line Tools
- `swiftc`
- `hdiutil`
- Apple Developer sertifikası opsiyonel
- Notarization opsiyonel

## Lokal Build

```bash
npm run desktop:mac
```

veya:

```bash
bash desktop/macos/build-dmg.sh
```

Çıktı:

```text
desktop/dist/macos/HK-Dijital.dmg
```

## GitHub Actions Build

1. GitHub'da `Actions` sekmesine gidin.
2. `Desktop Build` workflow'unu açın.
3. `Run workflow` ile manuel çalıştırın.
4. `macos-dmg` job tamamlanınca artifact bölümünden `HK-Dijital.dmg` dosyasını indirin.

## Production URL

URL `desktop/shared/desktop-config.json` içindeki `productionUrl` alanından okunur. Geçici test için:

```bash
HK_DESKTOP_APP_URL=https://hkdijital.com.tr bash desktop/macos/build-dmg.sh
```

## Güvenlik Notları

- Native taraf token veya login bilgisi saklamaz.
- Web session mevcut web auth akışıyla çalışır.
- Bilinmeyen domainler uygulama içinde açılmaz; varsayılan tarayıcıya yönlendirilir.
- Kamera, mikrofon ve dosya yükleme izin açıklamaları `Info.plist` içinde hazırdır.

## Müşteriye Gönderim

Apple Developer imzası ve notarization yoksa macOS Gatekeeper güvenlik uyarısı gösterebilir. Müşteriye dağıtım için imza/notarization yapılması önerilir.

## Icon

`desktop/shared/icons/AppIcon.icns` eklenirse build sırasında app bundle içine kopyalanır.
