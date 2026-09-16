# Analiz & Raporlama Merkezi — Setup

Unified analytics for Instagram, Facebook, TikTok, YouTube, Google Ads and Google Business Profile, built inside HK Admin at `/hk-admin/analiz-raporlama`. This module reuses the app's **existing** OAuth engine (`src/lib/customer-integration-oauth.ts`) — it does not add a new OAuth flow. Two UIs read/write the same connection state (`customer_integrations`): the customer-facing "Hesap Bağla" screen (`/musteri-paneli#hesap-bagla`, `CustomerAccountConnectCenter`) for customers managing their own account, and HK Admin's own native connection drawer (`AdminConnectionDrawer`, opened from Analiz & Raporlama Merkezi → Hesaplar → "Bağlantıyı Yönet") for staff managing a customer's connections directly — the admin flow never navigates through the customer panel.

## Current status (checked against live production)

| Requirement | Status |
|---|---|
| Meta App ID/Secret | ✅ Configured |
| Google OAuth Client ID/Secret | ✅ Configured |
| Google redirect URI | ✅ Matches |
| GA4 / Search Console API access | ✅ Working |
| Google Business Profile API access | ✅ Working |
| **Meta advanced permissions** (`instagram_basic`, `pages_show_list`, `pages_read_engagement`, `instagram_manage_insights`) | ✅ Live in production — a dedicated Business-type Meta App + Configuration (`META_BUSINESS_CLIENT_ID`/`META_BUSINESS_CLIENT_SECRET`/`META_LOGIN_CONFIG_ID`) is now configured; Instagram and Facebook are connected and syncing real metrics (see Action 1 for how this was set up / how to redo it for another app). |
| **Google Ads developer token** | N/A — Google sunset developer tokens on 2026-09-09; access is now tied to the Google Cloud project behind `GOOGLE_CLIENT_ID`, already configured (see Action 2) |
| **YouTube Analytics scope** (`yt-analytics.readonly`) | ⚠️ Added to the code's requested scope list in this change, but any customer who connected Google *before* this change needs to reconnect once — see note under Action 3 |
| **TikTok Login Kit credentials** (`TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET`/`TIKTOK_REDIRECT_URI`) | ❌ Not configured — code is fully implemented (real Login Kit OAuth, discovery, sync) but cannot connect any real account until a real TikTok Developer app exists — see Action 5 |
| `supabase/migrations/20260915_analytics_center.sql` | ❌ Not yet applied — see Action 4 |

Everything else (discovery of connected Pages/Instagram accounts/Ads accounts/GBP locations/YouTube channels, token storage/encryption/refresh) already worked before this change and needed no new setup.

## Action 1 — Enable Instagram/Facebook analytics (dedicated Business-type Meta App + Configuration + Meta App Review)

Without this, Instagram and Facebook cards will show **"İzin gerekli"** — basic Meta login itself still works, but no Page/Instagram analytics can be fetched.

**Root cause, confirmed live in the Meta Dashboard (not inferred from code):** the existing app (`META_APP_ID`, "HK Dijital Login") is a **Consumer-type** app with use cases "Authenticate and request data from users with Facebook Login" + "Create & manage app ads with Meta Ads Manager". Its own **Add use cases** dialog shows *"All available use cases have been added to this app"* with Save disabled, and it has no **Facebook Login for Business → Configurations** section in its sidebar at all. Meta app types are immutable ("If your app needs products, permissions, or features that are unavailable to its current type you must create a new app with a different type instead" — [App Types docs](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/app-types/)). A previous round of this document incorrectly assumed this app was already a "Facebook Login for Business" app (based only on an `is_business_login=1` redirect parameter) and that `read_insights` was Meta-wide deprecated — neither claim held up against the actual Dashboard/docs; do not repeat them. **A genuinely separate, dedicated Business-type Meta App is required** for `pages_show_list`/`pages_read_engagement`/`instagram_basic`/`instagram_manage_insights` — this cannot be added to the existing app.

Two other Meta apps already exist on this account — **HK INTELLIGENCE** (`4283230752006982`) and **mt-hk-outh** (`1745803870106666`) — check both first before creating a new one:

1. Open each in [developers.facebook.com](https://developers.facebook.com/) → App Dashboard.
2. Check **Settings → Basic** (or the dashboard header) for its app type.
3. Check whether **Facebook Login for Business** already appears in its left sidebar.
4. Check **App Review → Use cases → Add use cases** for whether "Facebook Login for Business" / "Instagram API with Facebook Login" can still be added.
5. If either is already Business-type and not otherwise committed to an unrelated, live integration, it can be reused instead of creating a fourth app — but do not repurpose one that's already serving a different production feature without confirming that first.

Separately, this repo's **production `INSTAGRAM_APP_ID`** (used by the already-working Social Autopilot Instagram Login feature, a completely different product/host from the one described below) currently resolves to app id `2058806788399204` — **not** one of the three apps above. Locate this app in the Meta Business/Developer account (it may sit under a different Business Portfolio or a collaborator's personal developer profile) before assuming only three apps exist.

If none of the existing apps can support it, create a new one:

1. [developers.facebook.com](https://developers.facebook.com/) → **Create App** → type **Business**.
2. Add the **Instagram API with Facebook Login** / **Facebook Login for Business** use case (exact labeling can vary by Dashboard version).
3. **Facebook Login for Business** in the left sidebar → **Configurations** → **Create configuration** (or **Create from template**).
4. Choose **User access token** (not System-user).
5. Select the assets this configuration should be able to access (Pages, and the Instagram professional accounts linked to them).
6. Select permissions: `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`. **Before finalizing, verify against Meta's current official docs** — [Page Insights reference](https://developers.facebook.com/docs/graph-api/reference/v23.0/page/insights) and the [Instagram Graph API insights docs](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/insights) — whether the specific endpoints this app calls (`{page-id}/insights`, `{page-id}/posts`, `{post-id}/insights`, `{ig-user-id}/insights`, `{ig-user-id}/media`, `{media-id}/insights`; see `src/lib/analytics-center/providers/facebook.ts` / `instagram.ts`) need anything beyond these four — Meta's own Page Insights reference page currently still lists `read_insights` alongside `pages_read_engagement` as required for `GET /{page-id}/insights`, which contradicts the earlier "deprecated" claim; confirm this yourself before deciding whether to add it. Do not add `business_management`/`ads_read` unless Meta Ads analytics is also genuinely needed — keep them out of this configuration otherwise, so an unrelated Ads-permission gap can never break Instagram/Facebook organic analytics.
7. Click **Create** and copy the resulting **Configuration ID**.
8. Register this app's own redirect URI (same value as `META_REDIRECT_URI`) under **this new app's** Valid OAuth Redirect URIs — it is a separate app from `META_APP_ID` and needs its own allow-list entry.
9. Set `META_BUSINESS_CLIENT_ID=<this app's App ID>`, `META_BUSINESS_CLIENT_SECRET=<this app's App Secret>`, `META_LOGIN_CONFIG_ID=<the Configuration ID>` in Vercel (Project → Settings → Environment Variables) and redeploy. These three are read as one atomic unit — the code refuses to use any of them until all three are present, so a half-set trio can never cause a client_id/config_id mismatch.
10. Standard Access (accounts with an Admin/Developer/Tester role on **this new app**) can use these permissions immediately once the Configuration is created — no App Review needed for your own account(s). Serving a real, unrelated customer's Facebook Page/Instagram account requires Meta App Review to grant Advanced Access for the same permissions, plus Business Verification specifically if `business_management`/`ads_read` are ever added — follow Meta's in-product checklist for both.
11. Until all three variables are set, this stays a real, disclosed "setup required" state — basic Meta login (`public_profile,email`, via the original `META_APP_ID`) keeps working unaffected, and the module never fabricates Instagram/Facebook numbers in the meantime.

## Action 2 — Google Ads access (developer token is obsolete — do not set one up)

**Google sunset developer tokens on 2026-09-09** ([Google Ads API Developer Blog](https://ads-developers.googleblog.com/), [developer token policy docs](https://developers.google.com/google-ads/api/docs/api-policy/developer-token)). A previous version of this doc instructed applying for one via the Google Ads API Center — that flow no longer determines API access at all. Google Ads API access is now determined purely by **the Google Cloud project behind `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`** (already configured for this app's Google OAuth). The `developer-token` HTTP header is optional and ignored by Google's servers; this app sends it only if `GOOGLE_ADS_DEVELOPER_TOKEN` happens to still be set (harmless backward-compat), and never requires it.

If Google Ads discovery/sync still fails for a real connected account, the cause is now the Cloud project's own **access level** (Test / Basic / Standard), not a missing token:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → the project tied to `GOOGLE_CLIENT_ID` → **APIs & Services** → confirm the **Google Ads API** is enabled.
2. If access is still Test-only, complete brand verification / apply for Basic or Standard access for that Cloud project (Basic access is now automated after brand verification per Google's migration notice).
3. `GOOGLE_ADS_LOGIN_CUSTOMER_ID` is unrelated to this change — still set it (digits only, no dashes) if the connected Ads accounts are managed under an MCC.
4. No customer-facing action needed either way.

## Action 3 — YouTube Analytics scope

`youtube.readonly` (already granted, used for channel discovery) is a different scope from `yt-analytics.readonly` (YouTube Analytics API v2, needed for the real views/watch-time/subscriber sync). A previous round of this doc claimed `yt-analytics.readonly` had already been added — it had not; this was confirmed against a live, already-connected production Google login whose real granted scopes were checked directly (`sensitive_metadata.google_oauth.scopes`) and did not include it. Now genuinely added to the scope list in `customer-integration-oauth.ts`.

Anyone who connected Google **before** this deploy — including the production company already used to verify this — has an access grant that does not include it; their YouTube card will show a permission error on sync until they reconnect once via **Hesap Bağla → Google ile Bağlan** (customer panel) or the HK Admin connection drawer's "Hesabı Yeniden Bağla" (same underlying OAuth call — Google re-prompts for the added scope). Anyone connecting for the first time after this deploy is unaffected.

## Action 4 — Apply the database migration

`supabase/migrations/20260915_analytics_center.sql` creates three tables (`analytics_daily_metrics`, `analytics_content_metrics`, `analytics_reports`). This repo's Claude Code session has no working path to apply raw SQL to the production Supabase project directly (no `DATABASE_URL`, no Supabase CLI link, no Management API token configured in this environment) — apply it via whichever method you already use for the other 70+ migrations in `supabase/migrations/`, e.g.:

- **Supabase Dashboard → SQL Editor**: paste the file's contents, run once.
- **Supabase CLI** (if linked to the project): `supabase db push`.

Until this runs, every Analiz & Raporlama Merkezi screen shows an honest "Kurulum gerekli" empty state instead of erroring — nothing else in the app is affected, since no existing table or route was changed.

## Action 5 — Set up TikTok Login Kit (required before any TikTok connection can work)

TikTok is fully implemented in code — direct OAuth (`customer-integration-oauth.ts`), discovery (`/v2/user/info/`, `/v2/video/list/`), token refresh (`src/lib/tiktok-oauth-token.ts`), and metrics sync (`src/lib/analytics-center/providers/tiktok.ts`) — but **no real TikTok Developer app credentials exist yet**, so no real connection can succeed until this is done. Do not treat TikTok as working until you've completed this and verified a real connection.

1. [developers.tiktok.com](https://developers.tiktok.com/) → **Manage apps** → **Create an app**.
2. Add the **Login Kit** product.
3. Under Login Kit → **Scopes**, request exactly: `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`. Do not request any publishing/content-posting scope (e.g. `video.publish`) — this integration is read-only analytics, per product requirement.
4. Under Login Kit → **Redirect URI**, add `https://hkdijital.com.tr/api/integrations/callback/tiktok` exactly.
5. Copy the app's **Client key** and **Client secret**.
6. Set `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI=https://hkdijital.com.tr/api/integrations/callback/tiktok` in Vercel and redeploy.
7. New apps start restricted to a **Sandbox** (Manage apps → your app → Sandbox → Add a sandbox). Add up to 10 **Target users** there (real TikTok accounts that log in and consent) — this is enough to verify your own real connection, no App Review needed yet.
8. Serving a real, unrelated customer's TikTok account requires TikTok's standard **App Review** (Manage apps → your app → App review) for the Login Kit scopes above — do this only after the Sandbox flow is proven working end-to-end.
9. Do not fabricate or guess these values — until they're set, the TikTok card shows a real, disclosed "not configured" state (`oauth_not_configured` from `oauthConnect`), never a fake connected state.

## Provider matrix

| Provider | Auth | Scope(s) | Key metrics | Known limitations |
|---|---|---|---|---|
| Instagram | Meta Business Login (via connected Facebook Page) | `instagram_basic`, `instagram_manage_insights` (Action 1) | reach, accounts_engaged, followers, saves, likes, comments, shares, plays (Reels) | Meta deprecated `profile_views`/`website_clicks`/non-Reels `video_views` (Jan 2025) — shown as "desteklenmiyor", never as 0. `impressions` also being phased out; `reach` is the primary awareness metric now. |
| Facebook | Meta Business Login | `pages_show_list`, `pages_read_engagement` (Action 1) | page_fans, page_impressions(_unique), page_engaged_users, post engagement | Page Insights metric names drift periodically; a stale metric degrades that one number, not the whole sync (see resilience note below). |
| TikTok | TikTok Login Kit (Action 5) | `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list` | followers, following, total likes, video count, per-video views/likes/comments/shares | No historical-analytics endpoint exists for these scopes — audience counters are snapshotted as "today's" value on every real sync, so growth history builds up over real syncs only, never backfilled. No publishing/ads scope requested. |
| YouTube | Google OAuth | `youtube.readonly`, `yt-analytics.readonly` (already granted) | views, watch time, avg. view duration, likes/comments/shares, subscriber gain/loss | No monetary/revenue scope requested or used, by design. |
| Google Ads | Google OAuth (`adwords` scope, already granted) | none — developer token obsolete (Action 2) | cost, impressions, clicks, CTR, CPC, conversions, conversion value, cost/conversion, per-campaign breakdown | API v25. Cloud project's own access level (Test/Basic/Standard) — not a token — now gates real-account access; see Action 2. |
| Google Business Profile | Google OAuth | `business.manage` (already granted) | search/maps impressions, calls, website clicks, direction requests, messaging, reviews | Reviews fetched from the older `mybusiness.googleapis.com` v4 API best-effort (skipped gracefully, never fails the sync, if the location's parent account reference isn't available) — verify this endpoint's current status against Google's docs if it starts failing consistently. |

**Resilience**: every provider adapter tries a full metric batch first; on any failure it retries one metric at a time and keeps whichever succeed, so one renamed/retired metric degrades a single number (shown as "API tarafından sunulmuyor"), never the whole sync or the whole dashboard.

**Rate limits / cost control**: the "Verileri Güncelle" button and the scheduled sync (`/api/admin/analytics-center/sync-all`, cron-auth protected, not yet registered in `vercel.json` — add it once smoke-tested) both default to a rolling 30-day window, never a full-history backfill. Metrics are cached in Supabase (`analytics_daily_metrics`/`analytics_content_metrics`); dashboard opens read from there, not from a live API call every time.
