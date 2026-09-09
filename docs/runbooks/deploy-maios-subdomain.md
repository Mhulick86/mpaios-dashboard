# Runbook: put MAIOS on https://maios.marketingpowered.ai

Owner: Mike Hulick. Hosting stays on Vercel (project `mpaios` in the **MP** team, slug `mp-a681d317`;
the `mhulick-marketingpows-projects` team is empty); DNS is on Cloudflare (zone `marketingpowered.ai`
sits in the Jmartinez@marketingpowered.ai account); auth and data are the hosted Supabase project
`mpaios-platform` (`rxbgikvmussdstsjciwt`). Do the steps in order; each one is a few minutes.

**Status 2026-09-09:** steps 1, 2, 3 (domain + model keys) and 4 are done; the CNAME Vercel asked for
was `maios → 0cfe213f312fb1d2.vercel-dns-016.com` (DNS only) and HTTPS is live. Remaining: merge
PR #2, the integrations Google client in Vercel, and the worker variables.

## 1. Google Cloud: OAuth client for sign-in
Google Cloud Console → APIs & Services → Credentials → the OAuth 2.0 client used for MPAIOS (or create a
new "Web application" client):
- Authorized JavaScript origins: `https://maios.marketingpowered.ai`, `http://localhost:3000`
- Authorized redirect URIs: `https://rxbgikvmussdstsjciwt.supabase.co/auth/v1/callback`
- OAuth consent screen: **Internal** (Workspace only) if the project is in the marketingpowered.ai
  organisation; otherwise External with the app published.
Keep the client ID and secret for step 2. (The *integrations* Google client used for Analytics / Drive /
Search Console can stay separate; it needs `https://maios.marketingpowered.ai/auth/google/callback` as a
redirect URI.)

## 2. Supabase dashboard (project mpaios-platform)
- Authentication → Providers → **Google**: enable, paste client ID + secret. Disable **Email** and any
  other provider.
- Authentication → URL Configuration:
  - Site URL: `https://maios.marketingpowered.ai`
  - Redirect URLs: `https://maios.marketingpowered.ai/auth/callback`,
    `http://localhost:3000/auth/callback`
- Database: apply the SQL in this order (SQL editor or the Supabase MCP `apply_migration`):
  `supabase/hosted/00_pre_compat.sql` → `migrations/0001` → `supabase/hosted/01_post_0001_columns.sql` →
  `migrations/0002` … `0006` → `supabase/hosted/09_match_memory_1536.sql`
  (see `supabase/hosted/README.md`).
- Authentication → Users: delete any account that is not an @marketingpowered.ai Google account.

## 3. Vercel
```bash
cd /Users/mikehulick/Downloads/mpaios
npx vercel link            # pick team mhulick-marketingpows-projects, project mpaios
npx vercel domains add maios.marketingpowered.ai
```
Project → Settings → Environment Variables (Production + Preview):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rxbgikvmussdstsjciwt.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | project anon key |
| `NEXT_PUBLIC_SITE_URL` | `https://maios.marketingpowered.ai` |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` | `marketingpowered.ai` |
| `NEXT_PUBLIC_OWNER_EMAIL` | `mhulick@marketingpowered.ai` |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `PERPLEXITY_API_KEY` | server-side model keys used for standard members |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | integrations OAuth client (Analytics / Drive / GSC) |
| `INTEGRATIONS_ENCRYPTION_KEY` | 32-byte key (base64) that encrypts platform tokens stored in `integration_connections`; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Required before anything on the Platforms grid can be connected (see docs/integrations.md) |
| `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `LINKEDIN_CLIENT_ID`/`_SECRET`, `TIKTOK_APP_ID`/`_SECRET`, `PINTEREST_APP_ID`/`_SECRET`, `HUBSPOT_CLIENT_ID`/`_SECRET`, `SLACK_CLIENT_ID`/`_SECRET`, `SEMRUSH_API_KEY` | platform OAuth client ids/secrets (see docs/integrations.md). Google Ads and Google Business Profile reuse `GOOGLE_CLIENT_ID`/`_SECRET`; add the `/api/integrations/<id>/callback` redirect URIs from that doc to the Google client. Any pair left unset shows as "Setup needed" on the grid |
| `MAIOS_WORKER_URL`, `MAIOS_INTERNAL_KEY`, `NEXT_PUBLIC_MAIOS_PUBLIC_URL` | worker on the TNAS (via Cloudflare Tunnel / Tailscale); leave unset until the worker is reachable |

Settings → Git: production branch `main`. Then delete the duplicate Vercel project `ui` (it builds the
same repo root) once the domain works.

## 4. Cloudflare DNS (zone marketingpowered.ai)
Add `CNAME  maios  →  cname.vercel-dns.com`. Start with proxy status **DNS only** (grey cloud) so Vercel
can issue its certificate; if you later turn the proxy on, set SSL/TLS to **Full (strict)**. Vercel shows
the domain as valid within a few minutes.

## 5. GitHub
```bash
gh api -X PATCH repos/Mhulick86/mpaios-dashboard -f default_branch=main
```
Merge branch `maios-auth-revamp` into `main` (PR or fast-forward); Vercel deploys production from `main`.

## 6. First login checklist
1. Open https://maios.marketingpowered.ai → "Continue with Google" → choose mhulick@marketingpowered.ai.
2. Team page shows you as **Owner**; everything in the sidebar is visible.
3. Sign in from a second @marketingpowered.ai account in a private window: sidebar shows only the member
   pages, `/clients` redirects home with a "restricted" banner, and asking Chat for client budgets returns
   the refusal sentence.
4. A personal Gmail account is bounced to `/login?error=domain`.
5. Promote colleagues from the Team page as needed (owner only).
