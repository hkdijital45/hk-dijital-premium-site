# HK Admin — iOS Mobile App (Expo)

A real React Native app (not a PWA, not a WebView wrapper) for the HK
Digital Center admin, built with Expo + Expo Router. It talks to the
existing Next.js web app's own API routes over HTTPS — no second
backend, no direct Supabase access from the device.

## Run it

```bash
cd apps/hk-admin-mobile
npm install   # first time only
npx expo start
```

This prints a QR code in the terminal. On your iPhone:

1. Install **Expo Go** from the App Store (if not already installed).
2. Open the Camera app (or Expo Go itself) and scan the QR code.
3. The app loads inside Expo Go, connected live to the running `expo start` process.

The phone and computer do **not** need to be on the same Wi-Fi network for
this specific app, because it talks directly to the already-deployed
production API at `https://www.hkdijital.com.tr` (configured in
`app.json`'s `extra.apiBaseUrl`) — only the Expo Go JS bundle itself is
served from your machine during development. If `expo start` exits or
your terminal closes, the Metro bundler stops and the app can no longer
load on the phone (a "Tunnel disconnected" / red error screen) — it needs
`npx expo start` running for every session until an actual
production build exists.

Log in with a real HK Admin **staff** account (admin/yönetici/editor/sales
role) — this is not the customer portal.

## What's real vs. not yet integrated

**Real, live, working integrations** (every number/row comes from the
production database via new `/api/mobile/*` routes, nothing fabricated):

- Login (reuses the exact same password check and signed session token
  the web app's cookie already uses)
- Home dashboard counts (active customers, open leads, pending tasks,
  unread notifications)
- Customers list + search + detail (real `companies` rows) with real
  Meta/Google Ads **connection status** (not performance metrics)
- Advertising screen (Menü → Reklamlar, or from a customer's detail
  screen): same connection-status data, batched across all customers
- Notifications: real, persisted `agency_notifications` rows (read/unread
  state round-trips to the server)
- Favoriler: real, server-backed, cross-device module favorites — the
  exact same `admin_user_preferences.favorite_modules` row the web
  admin's own Favoriler button reads/writes. Tapping a favorite opens its
  native screen if one exists (Ana Sayfa, Müşteriler, Görevler,
  Reklamlar); otherwise it opens the real web route
  (`/hk-admin/<slug>`) in the system browser — never a WebView.
- Görevler (Menü → Görevler): real `agency_tasks` rows, filterable by
  status, with a one-tap status advance (Yapılacak → Devam Ediyor →
  Tamamlandı) that writes back to the same table/enum the web Görevler
  module uses.

See `MODULE_INTEGRATION.md` for the full, repository-derived inventory of
every web admin module and its exact mobile status.

**Explicitly NOT implemented** (shown as an honest "unavailable"/"coming
soon" state in the app, or listed as web-only in Menü, never faked):

- Live ad-performance metrics (spend, reach, CTR, CPC, CPM, frequency,
  cost per result) — reaching these honestly requires the existing
  Reklam Doktoru Pro sync pipeline; not reproduced here in this pass
- Reklam Doktoru Pro's analysis UI, Müşteri Keşfi, Organik Büyüme
  Merkezi, Muhasebe Merkezi, Rapor Merkezi, and every other module not
  marked VERIFIED/IN_PROGRESS in `MODULE_INTEGRATION.md` — listed in the
  "Menü" tab under "Web'de Açılır", opened via the system browser, not
  hidden and not faked as native
- Push notifications — Expo Go does not support them without a config
  that requires `expo-notifications` + a development build (a real
  Apple Developer account's push credentials or EAS's free push service
  would still be the actual delivery path); in-app/foreground
  notification viewing only, for now

## Architecture notes

- **Auth**: the web app's session is a signed, stateless string
  (`encodeSession`/`decodeSession` in `src/lib/session-token.ts`, HMAC-SHA256,
  not a database-backed session) — it works identically as a cookie *or*
  as a header, so this app gets a real token from
  `POST /api/mobile/auth/login` and stores it in `expo-secure-store`
  (iOS Keychain), then sends it as `Authorization: Bearer <token>` on
  every request. No new secret was introduced; no service-role key or
  Supabase key ever ships in the app bundle.
- **New server-side routes** (all under `/api/admin`'s sibling
  `/api/mobile/*`, in the main Next.js app, not duplicated logic): each
  one re-validates the bearer token server-side via
  `src/lib/mobile-auth.ts` and then reuses the SAME existing library
  functions the web admin already calls (e.g.
  `getCustomerIntegrations()` for Meta/Google Ads connection status) —
  nothing here bypasses Supabase RLS or invents a new data model.
- **Navigation**: Expo Router, file-based, routes under `src/app/`. Five
  bottom tabs (`(tabs)/_layout.tsx`): Ana Sayfa, Müşteriler, Favoriler,
  Bildirimler, Menü. Reklamlar and Görevler are real routes reachable from
  Menü/Favoriler/customer-detail but intentionally not in the bottom bar
  (`Tabs.Screen` with `href: null`), per the approved navigation spec.
- **Design tokens**: `src/lib/theme.ts` — dark navy surfaces, turquoise
  accent, controlled orange highlight, matching the HK Dijital brand
  without copying the web admin's light-mode tokens 1:1.
- **Logo**: `assets/hk-dijital-logo.png` and the app icon are a direct,
  byte-identical copy of `public/branding/hk-dijital-logo.png` from the
  web app — never recreated or redrawn.

## Compatibility

- Expo SDK 57 (current stable at the time this was built), React Native
  0.86, React 19.
- Every dependency was installed with `npx expo install` (SDK-compatible
  versions) and is bundled inside Expo Go — no custom native module, no
  development build required.
- `npx expo-doctor` reports 21/21 checks passing.

## Verification actually performed this session

- `npx tsc --noEmit` — clean
- `npx expo lint` — clean
- `npx expo-doctor` — 21/21 checks passed
- **Not performed**: running the app in Expo Go on a physical device or
  simulator (no device/simulator access in this environment). The app
  has not been visually verified — only statically validated.
