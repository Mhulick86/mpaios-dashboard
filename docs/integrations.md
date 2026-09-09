# Platform integrations

How MAIOS connects to ad, local-SEO, CRM and messaging platforms, and what to set up in each vendor's
developer console. The UI is the **Platforms** grid on `/integrations` (admin-only); the code is
`lib/integrations/*` plus the routes under `app/api/integrations/`.

| Platform | Category | Auth | Status | Primary agent |
|---|---|---|---|---|
| Google Ads | Paid media | OAuth 2.0 | available | Agent 08 · Paid Search |
| Meta Ads | Paid media | OAuth 2.0 | legacy — own page `/meta-ads` | Agent 07 · Meta Ads |
| LinkedIn Ads | Paid media | OAuth 2.0 | available | Agent 09 · Paid Social |
| TikTok Ads | Paid media | OAuth 2.0 | available | Agent 09 · Paid Social |
| Pinterest Ads | Paid media | OAuth 2.0 | available | Agent 09 · Paid Social |
| X Ads | Paid media | OAuth 2.0 | coming soon (awaiting Ads API approval) | Agent 09 · Paid Social |
| Google Business Profile | Local & SEO | OAuth 2.0 | available | Agents 31-33 · Local Growth |
| Semrush | Local & SEO | API key | available | Agents 10-12 · Organic & Authority |
| HubSpot | CRM & sales | OAuth 2.0 | available | Agents 25-27 · Client Success |
| Slack | Messaging | OAuth 2.0 | available | Agent 15 · Operations |

The catalogue itself (ids, scopes, endpoints, env var names) lives in `lib/integrations/registry.ts`
and is the source of truth; this document explains the parts that happen outside the repo.

## How it works

**Flow.** Clicking *Connect* sends the browser to `GET /api/integrations/<id>/auth-url`, which signs a
state token (HMAC, 10-minute lifetime, nonce mirrored in an httpOnly cookie) and redirects to the
platform's consent screen. The platform returns to `GET /api/integrations/<id>/callback`, which verifies
the state, exchanges the code **server-side**, asks the provider module which account was authorised
(`identify`), stores the tokens and redirects to `/integrations?connected=<id>&account=<name>` (or
`?error=<message>&provider=<id>`). API-key platforms skip OAuth: `POST /api/integrations/<id>/connect`
with `{ "apiKey": "…" }` validates the key with the vendor and stores it the same way.

**Storage.** Connections live in `public.integration_connections` (migration
`supabase/migrations/0008_integration_connections.sql`): one row per organisation + provider +
account, so a platform can hold several accounts. Row-level security allows only admins
(`public.is_admin()`), and the API never returns tokens — only account names, scopes and dates.

**Encryption.** Access and refresh tokens are AES-256-GCM ciphertext produced with the 32-byte key in
`INTEGRATIONS_ENCRYPTION_KEY`. The key never enters the database, so a dump of the table is useless
without the Vercel environment. Generate a key with

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

and add it to Vercel (Production + Preview) and `.env.local`. Until it is set the Platforms grid shows a
red *INTEGRATIONS_ENCRYPTION_KEY is not set* banner and every Connect button is disabled. Rotating the
key invalidates every stored token: disconnect and reconnect each platform afterwards.

**Token refresh.** Every action call goes through `getValidAccessToken()`, which refreshes the access
token with the stored refresh token shortly before it expires and writes the new tokens back. Platforms
whose tokens do not expire (Slack bot tokens, TikTok long-lived tokens, API keys) have nothing to
refresh. If a refresh fails (revoked access, password change, app removed) the action returns an error
and the fix is to disconnect and reconnect.

**Actions.** Each platform exposes read-only (or narrowly scoped write) actions at
`GET|POST /api/integrations/<id>/<action>`; query parameters (GET) or the JSON body (POST) become the
action's parameters and `?account=<accountId>` selects one of several connected accounts. Every
connectable platform has `test`, which the grid's *Test* button calls. Actions are admin-only like the
rest of the framework.

**Local development.** Redirect URIs are built from the request origin (`x-forwarded-host` on Vercel,
otherwise `NEXT_PUBLIC_SITE_URL`, otherwise the request URL), so `http://localhost:3000` works as long as
the localhost callback is registered with the vendor. Slack is the exception (HTTPS only, see below).

**Meta Ads** still uses its own page (`/meta-ads`) with the token kept in the browser's local storage;
it appears in the grid as *Separate page* with a link. **X Ads** is a catalogue entry until the Ads API
application is approved.

**Adding a platform.** Add an entry to `lib/integrations/registry.ts`, write
`lib/integrations/providers/<id>.ts` (implements `IntegrationProvider` from `lib/integrations/types.ts`:
`identify`, optional `exchange`/`refresh`/`buildAuthorizeUrl` overrides, and the `actions` map), register
it in `lib/integrations/providers/index.ts`, give it an icon in `components/integrations/PlatformGrid.tsx`
and add a section here.

## Redirect URIs to register

Register **both** URIs in each OAuth app so the same client works in production and on a dev machine.

| Platform | Production | Development |
|---|---|---|
| Google Ads | `https://maios.marketingpowered.ai/api/integrations/google_ads/callback` | `http://localhost:3000/api/integrations/google_ads/callback` |
| Google Business Profile | `https://maios.marketingpowered.ai/api/integrations/google_business_profile/callback` | `http://localhost:3000/api/integrations/google_business_profile/callback` |
| Meta Ads (legacy page) | `https://maios.marketingpowered.ai/auth/meta/callback` | `http://localhost:3000/auth/meta/callback` |
| Meta Ads (framework, for later) | `https://maios.marketingpowered.ai/api/integrations/meta_ads/callback` | `http://localhost:3000/api/integrations/meta_ads/callback` |
| LinkedIn Ads | `https://maios.marketingpowered.ai/api/integrations/linkedin_ads/callback` | `http://localhost:3000/api/integrations/linkedin_ads/callback` |
| TikTok Ads | `https://maios.marketingpowered.ai/api/integrations/tiktok_ads/callback` | `http://localhost:3000/api/integrations/tiktok_ads/callback` |
| Pinterest Ads | `https://maios.marketingpowered.ai/api/integrations/pinterest_ads/callback` | `http://localhost:3000/api/integrations/pinterest_ads/callback` |
| X Ads (when approved) | `https://maios.marketingpowered.ai/api/integrations/x_ads/callback` | `http://localhost:3000/api/integrations/x_ads/callback` |
| HubSpot | `https://maios.marketingpowered.ai/api/integrations/hubspot/callback` | `http://localhost:3000/api/integrations/hubspot/callback` |
| Slack | `https://maios.marketingpowered.ai/api/integrations/slack/callback` | HTTPS only — use an `ngrok`/Cloudflare tunnel URL |

## Environment variables

Set these in Vercel → Project → Settings → Environment Variables (Production + Preview) and in
`.env.local`. `.env.example` lists them with comments. A platform whose variables are missing shows an
amber *Setup needed* note in the grid naming exactly what to add.

| Variable | Used by | Notes |
|---|---|---|
| `INTEGRATIONS_ENCRYPTION_KEY` | all | required; 32 bytes as base64 (44 chars) or hex (64 chars) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Ads, Google Business Profile | the existing integrations OAuth client (also used by Analytics / Drive / Search Console); add the callback URIs above |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads | from the Google Ads API Center; Basic access needs Google's approval |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Google Ads | optional; manager (MCC) customer id, digits only, when client accounts are reached through a manager account |
| `META_APP_ID`, `META_APP_SECRET` | Meta Ads (legacy page) | already required by `/meta-ads` |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn Ads | app must have the Advertising API product |
| `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET` | TikTok Ads | Marketing API app, approved by TikTok |
| `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` | Pinterest Ads | app starts in trial access |
| `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` | HubSpot | public app in the developer account |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | Slack | from Basic Information → App Credentials |
| `SEMRUSH_API_KEY` | Semrush | optional; the key can be pasted in the grid instead |

## Platforms

### Google Ads

**What the agents get.** Agent 08 (Paid Search) reads the accessible customer accounts, campaigns and
spend / conversion metrics for Search, Performance Max and Display.

**Developer console.**
1. Google Cloud Console → APIs & Services → **Library** → enable **Google Ads API** in the project
   that owns the integrations OAuth client.
2. APIs & Services → **Credentials** → the existing "Web application" client (`GOOGLE_CLIENT_ID`) →
   add the Google Ads redirect URIs from the table above. (A separate client works too; then set
   `GOOGLE_CLIENT_ID`/`SECRET` accordingly — Google Business Profile shares the same variables.)
3. **OAuth consent screen** → add the scope `https://www.googleapis.com/auth/adwords`. Keep the screen
   *Internal* (Workspace) so no verification is needed.
4. Google Ads (a **manager account**, MCC) → Tools & Settings → Setup → **API Center** → apply for a
   developer token. It is issued immediately with *test account* access; production accounts need
   **Basic access**, which Google reviews (a short form describing the tool; usually a few business
   days). Paste the token into `GOOGLE_ADS_DEVELOPER_TOKEN`.
5. If client accounts are managed under the MCC, set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to the manager's
   customer id (digits only, no dashes) so calls are made "as" the manager.

**Redirect URI.** `https://maios.marketingpowered.ai/api/integrations/google_ads/callback` (+ localhost).

**Scopes.** `https://www.googleapis.com/auth/adwords`

**Env.** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, optional
`GOOGLE_ADS_LOGIN_CUSTOMER_ID`.

**Review / approval.** Developer token Basic access (Google Ads API Center). Until approved, only test
accounts return data and production calls fail with a `DEVELOPER_TOKEN_NOT_APPROVED` error.

**Actions.** `test`, `accounts`, `campaigns`, `metrics`.

### Google Business Profile

**What the agents get.** Agents 31-33 (Local Growth) read the business accounts, locations, reviews and
profile performance (views, searches, calls, direction requests).

**Developer console.**
1. Same Google Cloud project as above. Business Profile APIs are not visible in the Library until the
   project is approved: fill in the **Business Profile APIs access request** form
   (developers.google.com/my-business → *Prerequisites* → request access) with the project number and
   the business's details. Approval takes a few days; the quota stays at 0 until then.
2. After approval, enable **My Business Account Management API**, **My Business Business Information
   API** and **Business Profile Performance API** in the Library.
3. Credentials → the integrations OAuth client → add the Google Business Profile redirect URIs.
4. OAuth consent screen → add the scope `https://www.googleapis.com/auth/business.manage`.
5. Connect with a Google account that is an owner or manager of the business profiles.

**Redirect URI.** `https://maios.marketingpowered.ai/api/integrations/google_business_profile/callback`
(+ localhost).

**Scopes.** `https://www.googleapis.com/auth/business.manage`

**Env.** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

**Review / approval.** Business Profile API access request (per Google Cloud project).

**Actions.** `test`, `accounts`, `locations`, `reviews`, `performance`.

### Meta Ads (legacy page)

**What the agents get.** Agent 07 (Meta Ads) reads Facebook and Instagram campaigns, ad sets, ads,
insights and audiences; campaign writes stay draft-only.

**Status.** Meta Ads is connected from its own page, `/meta-ads`, which runs Facebook Login in a popup,
exchanges the code through `app/api/meta-ads/*` and keeps the long-lived token in the browser's local
storage. It shows in the Platforms grid as *Separate page* with an *Open* link. The registry already
carries the framework configuration (`meta_ads`, scopes below) so it can move into the grid later; the
provider module is intentionally `null` until then.

**Developer console.**
1. developers.facebook.com → My Apps → **Create app** → type *Business* → attach the Marketing Powered
   Business Manager.
2. Add the **Marketing API** and **Facebook Login for Business** products.
3. Facebook Login → Settings → **Valid OAuth Redirect URIs**: the legacy `/auth/meta/callback` URIs,
   plus the `/api/integrations/meta_ads/callback` URIs for the framework.
4. App settings → Basic → copy **App ID** and **App secret** into `META_APP_ID` / `META_APP_SECRET`.

**Scopes.** `ads_read`, `ads_management`, `business_management`, `read_insights`, `pages_show_list`.

**Env.** `META_APP_ID`, `META_APP_SECRET`.

**Review / approval.** While the app is in *Development* mode only app admins, developers and testers
can authorise it and the Marketing API runs at *Development* access level. For other users and for
production volume, switch the app to *Live* and pass **App Review** for `ads_management`, `ads_read`,
`business_management`, `read_insights` and `pages_show_list` (Advanced Access), then apply for
Marketing API *Standard* access. Business verification of the Business Manager is required first.

**Actions.** none in the framework yet (the legacy page has its own `app/api/meta-ads/*` routes).

### LinkedIn Ads

**What the agents get.** Agent 09 (Paid Social) reads ad accounts, campaigns and campaign analytics for
B2B paid social.

**Developer console.**
1. linkedin.com/developers → **Create app**. It must be associated with a LinkedIn Page (the Marketing
   Powered company page) and the page admin has to verify the app from the *Settings* tab.
2. **Auth** tab → *OAuth 2.0 settings* → **Authorized redirect URLs for your app**: add the LinkedIn
   redirect URIs from the table above. Copy the **Client ID** and **Primary Client Secret**.
3. **Products** tab → request the **Advertising API** (Marketing Developer Platform). This opens an
   application form (company, use case, the ad accounts you manage). Until it is approved the
   `r_ads`, `r_ads_reporting` and `rw_ads` scopes are not available and the consent screen fails.
4. Connect with a LinkedIn member who has at least *Viewer* access on the ad accounts (the Campaign
   Manager roles decide what the token can read).

**Redirect URI.** `https://maios.marketingpowered.ai/api/integrations/linkedin_ads/callback` (+ localhost).

**Scopes.** `r_ads`, `r_ads_reporting`, `rw_ads`.

**Env.** `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`.

**Review / approval.** Advertising API product approval (Marketing Developer Platform). Access tokens
last 60 days; approved Marketing API apps receive refresh tokens (365 days), which the framework uses
to renew unattended. If LinkedIn does not return a refresh token, reconnect before the 60 days run out.

**Actions.** `test`, `accounts`, `campaigns`, `analytics`.

### TikTok Ads

**What the agents get.** Agent 09 (Paid Social) reads advertiser accounts, campaigns and integrated
performance reports.

**Developer console.**
1. business-api.tiktok.com/portal → sign in with the TikTok for Business account → **Become a
   developer** (company details) → **My Apps** → **Create an app**.
2. App settings → **Advertiser redirect URL**: the TikTok redirect URI from the table above (one URL
   per app; use the production URL and a second app for local development if needed).
3. **Scope of permission**: tick *Ad Account Management* (read), *Campaign Management* (read) and
   *Reporting*. TikTok scopes are chosen in the app configuration, not in the authorize URL, which is
   why `oauth.scopes` is empty in the registry.
4. Submit the app for review. TikTok approves Marketing API apps within a couple of business days; the
   status shows on the app page. Copy the **App ID** and **Secret** into `TIKTOK_APP_ID` /
   `TIKTOK_APP_SECRET`.
5. Connect with a user who has access to the advertiser accounts in TikTok Ads Manager; the consent
   screen lists the advertisers to authorise.

**Redirect URI.** `https://maios.marketingpowered.ai/api/integrations/tiktok_ads/callback` (+ localhost).

**Scopes.** none in the URL (configured on the app).

**Env.** `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`.

**Review / approval.** App approval by TikTok before advertisers can authorise it. TikTok's authorize
step uses `app_id` and returns `auth_code`, and the token endpoint takes a JSON body — the provider
module overrides both. Long-lived access tokens do not expire, so there is no refresh.

**Actions.** `test`, `accounts`, `campaigns`, `report`.

### Pinterest Ads

**What the agents get.** Agent 09 (Paid Social) reads ad accounts, campaigns and daily analytics.

**Developer console.**
1. developers.pinterest.com → **My apps** → **Connect app** (requires a Pinterest *business* account and
   accepting the developer terms).
2. App → **Configure** → **Redirect URIs**: add the Pinterest redirect URIs from the table above.
3. Copy the **App ID** and **App secret key** into `PINTEREST_APP_ID` / `PINTEREST_APP_SECRET`.
4. Connect with the Pinterest user who owns or has been granted access to the ad accounts.

**Redirect URI.** `https://maios.marketingpowered.ai/api/integrations/pinterest_ads/callback` (+ localhost).

**Scopes.** `ads:read`, `user_accounts:read`.

**Env.** `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`.

**Review / approval.** New apps start with **trial access**: full API functionality but rate-limited
and usable only by the app owner and a handful of test users. Apply for **standard access** from the
app page (use case, screenshots) before rolling out to client accounts. The token endpoint uses HTTP
Basic auth (`tokenAuth: "basic"` in the registry); access tokens last 30 days and refresh tokens a
year, refreshed automatically.

**Actions.** `test`, `accounts`, `campaigns`, `analytics`.

### X Ads (coming soon)

**What the agents get.** Agent 09 (Paid Social) will read X (Twitter) ad accounts, campaigns and
analytics once access is granted.

**Status.** Catalogue entry only (`availability: "coming_soon"`); nothing can be connected and no env
vars are needed yet.

**Developer console (when ready).**
1. developer.x.com → create a project and app on a paid developer plan; set up **User authentication
   settings** (OAuth 1.0a or OAuth 2.0 with the redirect URI from the table above).
2. Apply for **Ads API access** through the Ads API access form (ads.x.com developer application);
   X reviews the application and the ad account has to be attached to the app.
3. Once approved: add the app credentials to the registry entry (`clientIdEnv` / `clientSecretEnv`),
   write `lib/integrations/providers/x_ads.ts`, and flip `availability` to `"available"`.

**Actions.** none yet.

### HubSpot

**What the agents get.** Agents 25-27 (Client Success) read contacts, companies and deals so they see
pipeline context when reporting or planning.

**Developer console.**
1. app.hubspot.com/developer → create or open the **developer account** (separate from the CRM
   portal) → **Apps** → **Create app**.
2. **Auth** tab → **Redirect URLs**: add the HubSpot redirect URIs from the table above.
3. **Scopes** → add `crm.objects.contacts.read`, `crm.objects.companies.read`,
   `crm.objects.deals.read` (the `oauth` scope is implicit). The scopes requested at connect time must
   match the ones configured on the app or HubSpot rejects the authorize request.
4. Copy the **Client ID** and **Client secret** into `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET`.
5. Connect with a super admin of the Marketing Powered HubSpot portal; the consent screen asks which
   portal to install into.

**Redirect URI.** `https://maios.marketingpowered.ai/api/integrations/hubspot/callback` (+ localhost).

**Scopes.** `oauth`, `crm.objects.contacts.read`, `crm.objects.companies.read`, `crm.objects.deals.read`.

**Env.** `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`.

**Review / approval.** None for a private (unlisted) public app; only an App Marketplace listing needs
HubSpot's review. Access tokens expire after 30 minutes and are refreshed automatically with the
non-expiring refresh token.

**Actions.** `test`, `account`, `contacts`, `companies`, `deals`.

### Slack

**What the agents get.** Agent 15 (Operations) posts agent and workflow updates into channels and lists
channels for routing.

**Developer console.**
1. api.slack.com/apps → **Create New App** → *From scratch* → name it (e.g. *MAIOS*) and pick the
   Marketing Powered workspace.
2. **OAuth & Permissions** → **Redirect URLs** → add
   `https://maios.marketingpowered.ai/api/integrations/slack/callback`. Slack only accepts HTTPS, so for
   local development add a tunnel URL (`https://<name>.ngrok.app/api/integrations/slack/callback`) and
   run the app behind that tunnel.
3. **Bot Token Scopes**: `chat:write`, `channels:read`, `groups:read`, `channels:join`.
4. **Basic Information** → **App Credentials** → copy **Client ID** and **Client Secret** into
   `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`.
5. Leave **Token Rotation** off (rotated tokens expire and would need the refresh flow).
6. Click *Connect* in the grid: the OAuth flow installs the app into the workspace and MAIOS stores the
   bot token (`xoxb-…`). Invite the bot to private channels it should post in; `channels:join` lets it
   join public ones on its own.

**Redirect URI.** `https://maios.marketingpowered.ai/api/integrations/slack/callback` (HTTPS only).

**Scopes.** `chat:write`, `channels:read`, `groups:read`, `channels:join`.

**Env.** `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`.

**Review / approval.** None for the workspace that owns the app. Installing into other workspaces would
require activating public distribution. Bot tokens do not expire.

**Actions.** `test`, `channels`, `post` (`POST /api/integrations/slack/post` with `{ "channel": "…",
"text": "…" }` — the one write action in the framework).

### Semrush

**What the agents get.** Agents 10-12 (Organic & Authority) read domain and keyword overview data from
the Semrush Analytics API v3 (organic traffic, keyword volume/CPC/difficulty).

**Developer console.**
1. semrush.com → profile → **Subscription info** → **API units**: the Analytics API needs a Business
   plan (or an API-units purchase); every call consumes units.
2. Copy the **API key** shown there.
3. Either paste it into the Semrush card in the grid and click *Connect* (the key is validated against
   the API, then stored encrypted), or set `SEMRUSH_API_KEY` in Vercel and click *Connect* with the
   field left empty.

**Redirect URI.** none (API key).

**Scopes.** none.

**Env.** `SEMRUSH_API_KEY` (optional).

**Review / approval.** None; usage is metered in API units.

**Actions.** `test`, `domain_overview`, `keyword_overview` (e.g.
`GET /api/integrations/semrush/domain_overview?domain=example.com`).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Red banner *INTEGRATIONS_ENCRYPTION_KEY is not set* | Generate the key (command above), add it to Vercel and redeploy. |
| Amber *Setup needed* on a card | The named env vars are missing on the server; add them and redeploy. The card also shows the exact redirect URI to register. |
| Toast *redirect_uri mismatch* / *invalid redirect* from the vendor | The callback URI is not registered on the app, or it is registered with a different host/scheme. Copy it from the table above. |
| Toast *OAuth state check failed* | The 10-minute state window expired, the nonce cookie was blocked, or the flow was started in a different browser. Try again from the grid. |
| *HTTP 501 … has no server module yet* on Test | The provider module has not been written or registered in `lib/integrations/providers/index.ts`. |
| Test fails with an authorisation error after months of working | The vendor revoked the token (password change, app removed, refresh token expired). Disconnect and reconnect. |
| Google Ads `DEVELOPER_TOKEN_NOT_APPROVED` | The developer token only has test-account access; apply for Basic access in the API Center. |
