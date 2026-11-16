# Security boundaries

This is a self-hosted early-stage internal operations tool.

1. The backend binds to `127.0.0.1` by default. If you bind another interface, MAIOS requires `MAIOS_API_TOKEN` at startup.
2. The browser never sends requests directly to LM Studio. The Node worker communicates with the local LM Studio endpoint.
3. Never expose local LM Studio directly to the Internet. Use a reverse proxy with authentication for the MAIOS API, TLS, a firewall, and optionally IP allowlisting / Zero Trust controls.
4. The static Vercel UI includes no production secrets. Tokens entered into settings are stored in browser session storage (not local storage). A shared token is not a substitute for real user access control.
5. Prompts explicitly treat supplied content as reference data, not instructions. Human reviewers must still check sources, compliance and privacy, especially for sensitive or regulated topics.
6. The SQLite store is local and unencrypted at rest by this app. Protect host disk access and encrypt backups.
7. Google Docs, Asana and other past company systems are not embedded as credentials. Historical imports use a token only in the importing process's environment.
8. Hosted deployment for a team or clients requires RBAC, per-user accounts, proper audit attribution, CSRF protection, rate limiting, tenant isolation and secret management. This version is not ready for public multi-tenant hosting.
9. Do not upload protected health information, confidential client data, or prior-employer assets without explicit authorization and adequate technical safeguards.

## v0.2 knowledge-corpus precautions

10. The downloadable source archive includes Marketing Powered's internal original agent instructions, social-content drafts, and unapproved strategy material. Keep `knowledge/` out of publicly served directories. The default Vercel configuration publishes only `public/`.
11. Searchable source excerpts can contain unverified or outdated statements. Trust labels distinguish policies, original sources, references, drafts and unverified claims. Content reviewed by a model is not independently fact-checked.
12. User-submitted knowledge and historical task descriptions may contain adversarial prompt text. The worker treats them as data, not executable instructions. Operators must review unusual source content and retain a human publishing gate.
13. Historical Asana import is read-only to the Asana API and uses an explicitly supplied `ASANA_TOKEN`. Run under a limited-access identity. Never include tokens or personally identifying client information in task notes or published drafts.
14. Only the local Node API can access the SQLite corpus. The user interface exposes an inspectable prompt, so treat the login/token and network boundary as sensitive. Do not allow public or cross-client access without true identity authorization and tenant isolation.

## v0.3 changes

15. The UI is served with a Content-Security-Policy (`script-src 'self'`), `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer`. Uploaded assets are served with `Content-Security-Policy: sandbox`. Model output is rendered through an escaping Markdown renderer; raw HTML in model output is always displayed as text and links are limited to `http(s)`.
16. `published_url` can no longer be written through the general task update endpoint, closing an approval bypass.
17. The live event stream (`GET /api/events`) requires the same access token as every other endpoint, sent as a header; the token is never placed in a URL.
18. The operator name set in Settings is sent as `X-MAIOS-Actor` and recorded in history. It is a label, not authentication: anyone holding the shared token can set any name.
19. Reviewer comments are now included in model prompts as requirements. Treat the comment box as trusted-operator input, like the commission form.
21. Integration credentials (Gemini API key, Google OAuth client secret and refresh token) are stored in plain text in the local SQLite `settings` table. They are write-only through the API: no read endpoint, event, log line or JSON export returns them. Anyone who can read the `data/` directory can read them, so protect that directory like the database itself.
22. `GET /api/google/callback` is the one API route that does not require the access token, because Google's redirect cannot carry a header. It only accepts a single-use, 10-minute `state` value issued by an authenticated `POST /api/google/start`, and uses PKCE.
23. With integrations enabled, draft text is sent to Google Drive and image prompts are sent to Google's Gemini API. Leave them unconfigured to keep the studio fully local.
20. `scripts/mock-model.mjs` and `npm run demo` produce placeholder text only and bind to loopback. Do not point a production studio at the mock.
