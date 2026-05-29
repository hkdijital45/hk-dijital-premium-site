# HK Dijital Next.js Website

Premium, dark-mode, Turkish digital marketing agency website with an advanced hidden admin management system, local CMS, media library, quote wizard, CRM lead tracking, certificates, and AI/API settings.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Admin Panel

Hidden route:

```text
http://localhost:3000/hk-admin
```

Default local demo credentials:

```text
username: admin
password: hk-dijital-2026
```

For production, change these in Vercel environment variables:

```text
ADMIN_USERNAME
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
```

## Editable Content

All public website content is stored in:

```text
src/data/site-content.json
```

The admin panel edits this content through `/api/content`. This is intentionally structured so it can later be moved to Supabase, MongoDB, PostgreSQL, Firebase, or WordPress REST API.

## Pages

- Ana Sayfa
- Hakkımda
- Sertifikalar
- Hizmetler
- Paketler
- HK Intelligence
- Teklif Al
- İletişim
- Hidden admin: `/hk-admin`

## Mock / Local Features

- Admin auth uses a secure HTTP-only cookie with environment-configured credentials.
- Media upload stores images, videos, PDFs, certificates and logos under `public/uploads` for local/demo usage.
- Quote and contact forms store submissions in the local CRM lead list.
- CRM supports lead status, internal notes, follow-up date, search and CSV export.
- Certificate management supports add/edit/delete, ordering, visibility and file URLs.
- AI Admin Assistant runs in demo/local mode and includes provider selection for Gemini, Groq and OpenAI placeholder.
- API Settings lets admins manage Gemini/Groq/OpenAI placeholders, active provider, model and demo mode.
- Meta Pixel, GA4 and GTM settings are editable, with script/event integration placeholders.

## Vercel Deployment

1. Push the project to GitHub.
2. Import the repo in Vercel.
3. Add environment variables from `.env.example`.
4. Deploy.

For production-grade persistence, replace the local JSON writer and `public/uploads` storage with a database and object storage provider.

Recommended production upgrades:

- Move CMS and CRM data to Supabase, MongoDB, PostgreSQL, Firebase or WordPress REST API.
- Move uploaded files to Supabase Storage, Firebase Storage, Cloudinary or S3-compatible storage.
- Store API keys only as encrypted server-side secrets.
- Add password hashing, rate limiting, role-based access and audit logs for admin users.
