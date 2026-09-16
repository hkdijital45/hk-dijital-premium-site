# Analiz & Raporlama Merkezi — Setup

Unified analytics for Instagram, Facebook, YouTube, Google Ads and Google Business Profile, built inside HK Admin at `/hk-admin/analiz-raporlama`. This module reuses the app's **existing** OAuth engine (`src/lib/customer-integration-oauth.ts`) and the customer-facing "Hesap Bağla" screen (`/musteri-paneli#hesap-bagla`, `CustomerAccountConnectCenter`) — it does not add a new OAuth flow. It only reads connection state from `customer_integrations` and adds new tables for the metrics themselves.

## Current status (checked against live production)

| Requirement | Status |
|---|---|
| Meta App ID/Secret | ✅ Configured |
| Google OAuth Client ID/Secret | ✅ Configured |
| Google redirect URI | ✅ Matches |
| GA4 / Search Console API access | ✅ Working |
| Google Business Profile API access | ✅ Working |
| **Meta advanced permissions** (`instagram_basic`, `pages_show_list`, `pages_read_engagement`, `instagram_manage_insights`, `ads_read`, `business_management`) | ❌ Not requested — see Action 1 below (this app is a "Facebook Login for Business" app; a raw scope request for these is rejected by Meta as "Invalid Scopes" — a Configuration ID is required instead, see Action 1) |
| **Google Ads developer token** | ❌ Not configured — see Action 2 below |
| **YouTube Analytics scope** (`yt-analytics.readonly`) | ⚠️ Added to the code's requested scope list in this change, but any customer who connected Google *before* this change needs to reconnect once — see note under Action 3 |
| `supabase/migrations/20260915_analytics_center.sql` | ❌ Not yet applied — see Action 4 |

Everything else (discovery of connected Pages/Instagram accounts/Ads accounts/GBP locations/YouTube channels, token storage/encryption/refresh) already worked before this change and needed no new setup.

## Action 1 — Enable Instagram/Facebook analytics (Facebook Login for Business Configuration + Meta App Review)

Without this, Instagram and Facebook cards will show **"İzin gerekli"** — basic Meta login itself still works, but no Page/Instagram analytics can be fetched.

**This Meta App is a "Facebook Login for Business" app** — confirmed live: its own OAuth redirect chain sets `is_business_login=1`. Meta's current documentation for this product states that **`config_id` replaces a raw `scope=` list entirely** — sending permissions like `pages_show_list`/`instagram_basic`/`business_management` as a plain scope parameter is rejected outright by Meta as **"Invalid Scopes"** (confirmed live in production; this is a hard requirement of the product type, not an approval-status issue). `read_insights` is additionally excluded — Meta deprecated it as a standalone OAuth permission; Page insights are now covered by `pages_read_engagement` + the Insights API.

1. Go to [developers.facebook.com](https://developers.facebook.com/) → your app (Client ID ending `...6404`, same app already used for Meta login) → **Facebook Login for Business** in the left sidebar → **Configurations**.
2. Click **Create configuration** (or **Create from template**). Name it (e.g. "HK Dijital Analytics").
3. Choose **User access token** (not System-user).
4. Select the assets this configuration should be able to access (Pages, and the Instagram professional accounts linked to them).
5. Select permissions: `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`. Only add `business_management` + `ads_read` too if Meta Ads analytics is also needed — keep them out of this configuration otherwise, so an unrelated Ads-permission gap can never break Instagram/Facebook organic analytics.
6. Click **Create** and copy the resulting **Configuration ID**.
7. Set `META_LOGIN_CONFIG_ID=<that id>` in Vercel (Project → Settings → Environment Variables) and redeploy.
8. Standard Access (accounts with an Admin/Developer/Tester role on this Meta App) can use these permissions immediately once the Configuration is created — no App Review needed for your own account(s). Serving a real, unrelated customer's Facebook Page/Instagram account requires Meta App Review to grant Advanced Access for the same permissions, plus Business Verification for `business_management`/`ads_read` specifically — follow Meta's in-product checklist for both.
9. Until `META_LOGIN_CONFIG_ID` is set, this stays a real, disclosed "setup required" state — basic Meta login (`public_profile,email`) keeps working unaffected, and the module never fabricates Instagram/Facebook numbers in the meantime.

## Action 2 — Get a Google Ads Developer Token

Without this, the Google Ads card shows **"Google Ads API için GOOGLE_ADS_DEVELOPER_TOKEN sunucu ortam değişkeni tanımlanmalı."**

1. Sign in to [Google Ads API Center](https://ads.google.com/aw/apicenter) (needs a Google Ads manager/MCC account).
2. Apply for **Standard access** (Basic access is enough to start; Standard removes rate limits later).
3. Copy the developer token and set `GOOGLE_ADS_DEVELOPER_TOKEN` in Vercel. If the connected Ads accounts are managed under an MCC, also set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to the MCC's customer ID (digits only).
4. Redeploy. No customer-facing action needed — this token is an application-level secret, never entered by a customer.

## Action 3 — YouTube Analytics scope

This change added `https://www.googleapis.com/auth/yt-analytics.readonly` to the Google OAuth scope list (`customer-integration-oauth.ts`). A customer who connected their Google account **before** this deploy has an access grant that does not include it — their YouTube card will show a permission error until they reconnect once via **Müşteri Paneli → Hesap Bağla → Google ile Bağlan**. Anyone connecting for the first time after this deploy is unaffected.

## Action 4 — Apply the database migration

`supabase/migrations/20260915_analytics_center.sql` creates three tables (`analytics_daily_metrics`, `analytics_content_metrics`, `analytics_reports`). This repo's Claude Code session has no working path to apply raw SQL to the production Supabase project directly (no `DATABASE_URL`, no Supabase CLI link, no Management API token configured in this environment) — apply it via whichever method you already use for the other 70+ migrations in `supabase/migrations/`, e.g.:

- **Supabase Dashboard → SQL Editor**: paste the file's contents, run once.
- **Supabase CLI** (if linked to the project): `supabase db push`.

Until this runs, every Analiz & Raporlama Merkezi screen shows an honest "Kurulum gerekli" empty state instead of erroring — nothing else in the app is affected, since no existing table or route was changed.

## Provider matrix

| Provider | Auth | Scope(s) | Key metrics | Known limitations |
|---|---|---|---|---|
| Instagram | Meta Business Login (via connected Facebook Page) | `instagram_basic` (Action 1) | reach, accounts_engaged, followers, saves, likes, comments, shares, plays (Reels) | Meta deprecated `profile_views`/`website_clicks`/non-Reels `video_views` (Jan 2025) — shown as "desteklenmiyor", never as 0. `impressions` also being phased out; `reach` is the primary awareness metric now. |
| Facebook | Meta Business Login | `pages_show_list`, `ads_read` (Action 1) | page_fans, page_impressions(_unique), page_engaged_users, post engagement | Page Insights metric names drift periodically; a stale metric degrades that one number, not the whole sync (see resilience note below). |
| YouTube | Google OAuth | `yt-analytics.readonly` (Action 3) | views, watch time, avg. view duration, likes/comments/shares, subscriber gain/loss | No monetary/revenue scope requested or used, by design. |
| Google Ads | Google OAuth + developer token | `adwords` (already granted) + `GOOGLE_ADS_DEVELOPER_TOKEN` (Action 2) | cost, impressions, clicks, CTR, CPC, conversions, conversion value, cost/conversion, per-campaign breakdown | API v24 (matches the version already used elsewhere in this app for account discovery). |
| Google Business Profile | Google OAuth | `business.manage` (already granted) | search/maps impressions, calls, website clicks, direction requests, messaging, reviews | Reviews fetched from the older `mybusiness.googleapis.com` v4 API best-effort (skipped gracefully, never fails the sync, if the location's parent account reference isn't available) — verify this endpoint's current status against Google's docs if it starts failing consistently. |

**Resilience**: every provider adapter tries a full metric batch first; on any failure it retries one metric at a time and keeps whichever succeed, so one renamed/retired metric degrades a single number (shown as "API tarafından sunulmuyor"), never the whole sync or the whole dashboard.

**Rate limits / cost control**: the "Verileri Güncelle" button and the scheduled sync (`/api/admin/analytics-center/sync-all`, cron-auth protected, not yet registered in `vercel.json` — add it once smoke-tested) both default to a rolling 30-day window, never a full-history backfill. Metrics are cached in Supabase (`analytics_daily_metrics`/`analytics_content_metrics`); dashboard opens read from there, not from a live API call every time.
