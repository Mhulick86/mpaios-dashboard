# ADR-0005: Google SSO for @marketingpowered.ai with a single owner

**Status:** accepted 2026-09-07

## Decision
Sign-in to MAIOS (`maios.marketingpowered.ai`) is Supabase Auth with the Google provider only.
Three independent checks restrict accounts to the `marketingpowered.ai` Workspace domain and to Google
identities:

1. the login button passes `hd=marketingpowered.ai` to Google (a hint, not a guarantee);
2. `app/auth/callback/route.ts`, `lib/supabase/middleware.ts` and `lib/apiAuth.ts` reject any session
   whose e-mail is off-domain or whose identity provider is not Google (`isAllowedUser` in `lib/access.ts`),
   signing it out and clearing the `sb-*` cookies;
3. the `on_auth_user_created` trigger (`supabase/migrations/0005`) raises for off-domain e-mails, so
   Supabase never creates the account.

Roles live in `public.profiles.role` and map to `current_role_level()`: viewer 1, member 2, admin 3,
owner 4. `mhulick@marketingpowered.ai` (from `app_settings.owner_email`) is provisioned as the only
**owner**; every other allowed sign-in becomes a **member**. Only the owner can change roles
(`profiles_update_owner` policy + `protect_profile_role` trigger), and nobody else can hold `owner`.

## What a member can and cannot do
- Pages: Dashboard, Chat, Agents, Pipelines, Tools, Alerts, Knowledge. Everything in
  `ADMIN_ONLY_PATHS` (`lib/access.ts`) — Clients, Campaigns, Analytics, Database, Observability, Team,
  Integrations, Settings, Data & ETL, Local SEO, Workflows — redirects to `/?denied=` in middleware and is
  wrapped in `<RequireRole min="admin">` client-side.
- API: every route under `app/api` requires a session; integration routes (Asana, Google Analytics /
  Drive / Search Console, Ahrefs, local models, OAuth exchange) require `requireRole("admin")`. The MAIOS
  worker proxy lets members call only `POST /v1/knowledge/search` and `/health`.
- Database (RLS, migrations 0001–0006): members see only their own conversations, messages, memory,
  evaluations, token usage, audit rows and workflow runs; clients, campaigns, workflow definitions,
  triggers, approvals, events and confidential/restricted knowledge collections are admin-only.
- Models: members cannot enter provider keys or custom endpoints. `lib/providerKeys.ts` always resolves
  their requests to the server-side keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`,
  `PERPLEXITY_API_KEY`). Admin-only context (Asana, GA, GSC, Drive) is never injected for members.
- Prompts: `buildAccessPolicyPrompt(role, email)` is appended last to every system prompt. For non-admins
  it lists the sensitive categories (financials, billing, credentials, HR, confidential collections,
  team roles) the model must refuse, with a fixed refusal sentence.

## Why
- One Workspace, one owner: Marketing Powered staff already have Google accounts; no passwords to manage.
- Defence in depth: the prompt policy is the last line, not the first. RLS and server-side stripping mean
  a member's request never contains sensitive context in the first place.
- Keeping Supabase (hosted `mpaios-platform` today, self-hosted on the TNAS later per ADR-0001) preserves
  `@supabase/ssr`, the existing RLS policies and the browser data access the dashboard already uses.

## Consequences
- Email/password and magic-link providers must stay disabled in the Supabase dashboard; the code rejects
  them anyway.
- Existing off-domain users (e.g. a personal Gmail created during testing) are not deleted by migration;
  middleware signs them out on their next request. Delete them in Authentication → Users.
- Changing `app_settings.owner_email` does not transfer ownership by itself; the old owner row must be
  demoted by a migration (single-owner invariant in 0005/0006).
- The hosted project needs the compatibility files in `supabase/hosted/` before the numbered migrations
  (its hand-made tables predate them).
