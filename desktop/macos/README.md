# HK Dijital Admin macOS Dağıtımı

Bu yapı Electron veya PWA kullanmaz. SwiftUI + WKWebView + yerel SQLite ile HK Dijital admin sistemi için native macOS uygulaması üretir.

Uygulama adı: `HK Dijital Admin`

Canlı URL:

```text
https://hkdijital.com.tr/digital-center
```

Admin URL:

```text
https://hkdijital.com.tr/hk-admin
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
desktop-builds/HK-Dijital-Admin-0.1.0.dmg
```

## GitHub Actions Build

1. GitHub'da `Actions` sekmesine gidin.
2. `Desktop Build` workflow'unu açın.
3. `Run workflow` ile manuel çalıştırın.
4. `macos-dmg` job tamamlanınca artifact bölümünden `HK-Dijital-Admin-0.1.0.dmg` dosyasını indirin.

## Production URL

URL `desktop/shared/desktop-config.json` içindeki `productionUrl` alanından okunur. Geçici test için:

```bash
HK_DESKTOP_APP_URL=https://hkdijital.com.tr/digital-center bash desktop/macos/build-dmg.sh
```

## Uygulama Modları

### Online Mod

İnternet varsa canlı web admin WKWebView içinde açılır. `/hk-admin` altındaki mevcut tüm modüller web tarafındaki gerçek admin navigation ile çalışmaya devam eder.

### Offline Mod

İnternet yoksa uygulama boş kalmaz. Yerel SQLite veritabanında şu güvenli taslak türleri saklanır:

- müşteri notları
- görevler
- teklif taslakları
- rapor taslakları
- reklam yorum taslakları
- paket/fiyat taslak notları
- genel admin notları

Müşteri silme, ödeme silme, kullanıcı yetkisi değiştirme, auth işlemleri ve entegrasyon token işlemleri offline yapılmaz.

### Senkronizasyon Modu

`Senkronize Et` butonu mevcut web oturum cookie'leriyle `/api/desktop/sync` endpointini çağırır. Oturum yoksa önce Web Admin üzerinden giriş yapılmalıdır.

Çakışma olduğunda otomatik ezme yapılmaz; Sync Center içinde manuel çözüm bekleyen kayıt olarak gösterilir.

## Güvenlik Notları

- Native taraf token veya login bilgisi saklamaz.
- Web session mevcut web auth akışıyla çalışır.
- Bilinmeyen domainler uygulama içinde açılmaz; varsayılan tarayıcıya yönlendirilir.
- Kamera, mikrofon ve dosya yükleme izin açıklamaları `Info.plist` içinde hazırdır.

## Müşteriye Gönderim

Apple Developer imzası ve notarization yoksa macOS Gatekeeper güvenlik uyarısı gösterebilir. Müşteriye dağıtım için imza/notarization yapılması önerilir.

## Icon

`desktop/shared/icons/AppIcon.icns` eklenirse build sırasında app bundle içine kopyalanır.
