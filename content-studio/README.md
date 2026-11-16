# MAIOS Content Studio v0.5 | Knowledge-powered

## What changed in v0.5: runs inside MAIOS on cloud models

- **No local compute.** Inside MAIOS (maios.marketingpowered.ai/content-studio) the studio's API runs on Vercel functions (`hosted.mjs`, mounted by MAIOS at `/api/studio`). Its database, uploads and generated images are kept in private Vercel Blob storage, and generations keep running after the browser tab closes.
- **AI models & API keys** in Settings: pick a provider (Anthropic, OpenAI, Google) from the dropdown, paste its key once, and it is encrypted (AES-256-GCM) and reused for every run. Only the last 4 characters are ever shown again. A model dropdown per stage (brief, draft, graphics plan, QA) with prices; defaults are Claude Sonnet 5.5 for brief, draft and QA and Claude Haiku 5.5 for the graphics plan. Any other model ID can be typed in.
- **Passcode** on every address (signed, HttpOnly 90-day session). The first one comes from `STUDIO_PASSCODE` in the Vercel environment and can be changed in Settings.
- The local server (`node server.mjs`) still works and uses the same cloud models; LM Studio remains available there as an optional per-stage choice.

The rest of this file describes the standalone (local) setup from v0.3 and v0.4.

**An actual, runnable MP FRESH-style content commissioning board for Marketing Powered.** This is an early operational application, not a static mockup. It uses a dependency-free Node.js 22 server, SQLite for persistence, a browser UI, a durable local job queue, and LM Studio's OpenAI-compatible local model API. **No n8n. No required SaaS API or cloud model.**

## What changed in v0.3

Full detail is in [CHANGELOG.md](CHANGELOG.md). The short version:

- **The task drawer works.** In v0.2 every control inside an open task (tabs, Brief / Write / Graphics / QA, approve, comment) did nothing, because the click handler reopened the task instead. Only drag-and-drop automation functioned.
- **The QA gate is real.** v0.2 wrote blocking findings as `- BLOCK: ...` but looked for lines starting with `BLOCK:`, so a FAIL verdict never stopped an approval. It does now, and unresolved `[VERIFY]` markers block too.
- **Autopilot.** One click (or a checkbox when commissioning) runs brief, draft, graphics plan and QA back to back, moves the card through its lanes, and stops in the approval lane. It never approves or publishes.
- **Live output.** Generation streams from the model; the open task shows the text as it is written, and boards update over Server-Sent Events instead of a 7 second poll. A running job can be stopped.
- **Reviewer feedback reaches the model.** Comments posted after the latest draft, plus the latest QA findings, are sent as requirements when the draft is revised. v0.2 stored comments but never used them.
- **A real deterministic preflight** before the model review: channel length limits, hashtag limits, em dashes, hype phrases, guarantee language, numeric claims, placeholders, leaked internal source keys, website H1/meta/keyword checks, and phrase-level repetition against every other draft and the 70 historical drafts.
- **Readable artifacts.** Markdown is rendered, every version is viewable and restorable, with word counts, copy and download.
- **Resilience.** A job that cannot reach the model server waits and retries instead of failing instantly; reasoning-model `<think>` blocks are stripped; a v0.2 database upgrades in place.
- **Deployment fixes.** The Docker image now starts (v0.2 left out the knowledge files); the split Vercel setup works (v0.2's CORS preflight rejected a header the UI sends on every request).
- Brand palette from the supplied guidelines (sky blue `#2CACE8`, green `#08AE67`), and a mock model (`npm run demo`) to try the full flow with no LM Studio.

## What is implemented

- Visually styled dark production interface with native HTML drag and drop, search, priority filters, list view, reviewer queue, and agent-run log.
- **MP FRESH** board, preserving all eight recovered columns: Backlog, Ready for Brief, Brief Complete, Ready for Writing, Draft Complete, Graphics, Final Approval, Ship to dev.
- **Social Media** board, preserving all eight recovered columns: Post Plan, Plan Review, Content Drafting, Content Review, Graphics, Graphic Review, Final Approval, Ready to Post.
- Content commissioning from one form, including target audience, business goal, keywords, sources, word count, voice, due date, reviewer, CTA, and graphics requirements.
- Multi-channel commissions that create separately reviewable tasks for Website, LinkedIn, Facebook, Instagram, Google Business Profile, and X. Every deliverable shares a campaign ID.
- Real, asynchronous **brief**, **draft**, **graphics direction**, and **editorial QA** generation via LM Studio using the local models you configure.
- Stage-based automation: dragging a task into a supported stage queues the next job. Successful brief/draft generation advances the card where appropriate.
- Versioned drafts and briefs, manual edits, reviewer comments, activity history, creative attachments, and approval enforcement.
- Editable company/founder voice profiles and visual/QA operating rules, which are injected into generation prompts.
- **Built-in Knowledge Library:** 149 provenance-tagged historical and operational records, local SQLite FTS5 search, enabled/disabled toggles, revision history, categorized trust labels, and text import.
- **Original 33-agent MPAIOS role library** and four active production specialists with detailed editable system instructions and acceptance criteria.
- **70 actual dated social captions** from the historical Marketing Powered LinkedIn/Facebook working archives, each marked as an unapproved historical example.
- **Seven commissioning playbooks:** pre-configured founder leadership, company social, resources, articles + derivatives, hospital systems, Powered Cards and channel distribution.
- **Task-level knowledge inspector** showing the exact system message, the selected source excerpts, approximate context size, and which sources previous LM Studio jobs used.
- **Optional Asana knowledge importer**, which indexes task briefs and historical correction tickets, not just task cards. It is separately invoked and entirely read-only to Asana.
- One-time Asana history importer, a JSON export command, and a REST API.
- A working static frontend that can be hosted on **Vercel**, while retaining the production worker, SQLite database, and LM Studio locally.
- No third-party JavaScript/CSS/font/CDN dependencies. A default board of clearly marked **SAMPLE** cards can be deleted in Settings.

## The knowledge engine: what the model actually knows

The v0.2 build includes a source-tagged knowledge pack built from Marketing Powered's actual operational material, not generic prompts. It starts with **149 indexed records**:

| Collection | Count | Source and treatment |
| --- | ---: | --- |
| Historical LinkedIn / Facebook drafts | 70 | 43 LinkedIn and 27 Facebook dated caption entries from the shared Marketing Powered draft documents, June to September 2026. All marked as **draft**, never proof of publication or substantiation. |
| Original MPAIOS agents | 33 | Complete text of the April 2026 internal 33-agent instruction manual. Treated as reference architecture and divided into searchable role records. |
| Homepage strategy working drafts | 22 | Segmented sections of the November 2026 homepage copy and implementation document. Marked **draft**, not an approved live site or independently verified claims. |
| Operating rules, domain guidance, visual standards, brand strategy | 24 | Curated practical rules from MP FRESH, Asana, company briefing discussions, user instructions and supplied brand guidelines. Each record includes source trust and editorial caveats. |
| **Total** | **149** | Fully bundled, no separate model training or SaaS search required. |

The knowledge pack includes explicit rules for attribution, data sovereignty, claims, source credibility, prior-employer intellectual property, local model usage, production stages, creative standards, historical failures, multi-channel distribution and editorial approvals. It uses exact brand colors from the provided guidelines: `#2CACE8`, `#000000`, `#FFFFFF`, `#08AE67`; specified typography is **Just Sans Variable**. Licensed font files are not bundled.

### How a commission becomes a grounded local-model prompt

1. A user commissions one or several deliverables, using a specific playbook or custom configuration.
2. The code selects the **founder or company voice**, relevant task metadata, upstream brief/draft artifacts and the correct stage specialist.
3. `knowledge.mjs` first selects mandatory governance and brand records, then original MPAIOS reference roles, then full-text-matched topic sources using **SQLite FTS5**. Long sources are excerpted to respect the local model context budget.
4. The worker sends a distinct **system instruction** containing fixed safety constraints and the editable stage-agent operating manual, plus a **user prompt** containing the commission and source-tagged excerpts. Historical draft entries are examples only.
5. Each completed job writes `knowledge_usage` rows identifying the exact source excerpts used. In a task's **Knowledge** tab, inspect the full upcoming prompt or the source trace from prior jobs.
6. Human approval is required before the final handoff/publish-ready stage. Model output is never automatically treated as a verified result.

**The knowledge base is dynamic:** click **Knowledge library** to search, inspect, add, import, disable or revise a record. Click **Agent instructions** to edit one of the four specialist role prompts. These changes persist in the local database and are reflected in subsequent model requests without code edits. The original source documents remain in `knowledge/sources/` for offline inspection and controlled reseeding; do not publish these on a public web server.

**Important:** The original operating manual contains 33 specialist definitions, but this version intentionally routes them into **four active generation jobs** (brief, draft, graphics directions, QA) for speed and maintainability. It does not launch 33 concurrent LLM instances. The original 33 definitions remain accessible individually in the Knowledge Library.

### Production playbooks

The seven bundled playbooks supply defaults for requested channels, founder/company voice, article length and creative count. They are **editable at commissioning time**; select one in the commissioning modal, then adjust the details before creating tasks. Those presets are not a substitute for sources. Enter the actual business thesis, target buyer, source material and exclusions.

### Import more historical Asana knowledge

The 149 records are bundled and usable immediately. You can enrich them with the original MP FRESH and Social Media task briefs using the included read-only Asana knowledge importer. This will add up to 96 MP FRESH and 35 Social Media task records (subject to what is currently available in Asana), with task stages, original dates, descriptions and optionally comment history. It will not fetch linked Google Docs or certify the quality of completed tasks.

```bash
ASANA_TOKEN='your-personal-access-token' node scripts/import-asana-knowledge.mjs all --dry-run
ASANA_TOKEN='your-personal-access-token' node scripts/import-asana-knowledge.mjs all
# Include historical comments as source references where appropriate:
ASANA_TOKEN='your-personal-access-token' node scripts/import-asana-knowledge.mjs all --with-comments
```

The importer uses stable Asana task IDs to avoid duplicating records. Existing knowledge is preserved by default. Pass `--force` only to explicitly overwrite imported records, which creates a prior-revision entry. **Do not use `--force` to overwrite hand-edited material accidentally.** Task descriptions/comments are tagged `reference` rather than `policy` or factual proof.

For manually collected source text, use the **Import text** control; large inputs are split into smaller retrievable passages with revision and provenance data. Do not import unrelated legal/medical conversations, private client information, protected health data or credentials.

For LM Studio, default source context is approximately **13,500 characters**, configured with:

```dotenv
LM_STUDIO_CONTEXT_CHAR_BUDGET=13500
```

Reduce this for compact models with smaller context windows, or increase carefully when the loaded model supports sufficient tokens. Context is source excerpts, not the entire database on every request. The system does not claim to browse or verify user-supplied URLs. Source validation remains an editorial responsibility.

## Quick start (recommended: locally)

**Requirements:** Node.js 22.13 or newer, and LM Studio with a compatible instruct/chat model loaded.

```bash
# From the extracted project folder
cp .env.example .env
node server.mjs
```

Open **http://127.0.0.1:4173** in your browser. No `npm install` is required; all runtime dependencies are built into Node 22.

### Try it without LM Studio

```bash
npm run demo
```

This starts a mock model next to the studio and uses a separate `data-demo/` folder. Everything the mock writes is canned placeholder text, labelled **MOCK OUTPUT**. It exists to click through the workflow and to run the tests, never to produce content.

In LM Studio, load an instruct model and enable **Developer > Start server**, normally at `http://127.0.0.1:1234`. The official compatibility endpoints are `/v1/models` and `/v1/chat/completions`. You can check the loaded model IDs with:

```bash
curl http://127.0.0.1:1234/v1/models
```

Set `LM_STUDIO_MODEL=<actual-loaded-model-id>` in `.env` if multiple models exist. The sidebar status light shows whether the local model server is connected. Changes to `.env` require restarting Node.

If LM Studio is offline when a job starts, the job waits and retries (15 seconds, then 45) before it is marked failed, and the task remains intact. Start or repair LM Studio, then press **Retry** on the task or in **Agent runs**; a failed autopilot run resumes where it stopped. Failures and completed outputs are recorded in task history.

### Model routing by role

Set these independently to optimize your local compute:

```dotenv
LM_STUDIO_MODEL_BRIEF=
LM_STUDIO_MODEL_DRAFT=
LM_STUDIO_MODEL_GRAPHICS=
LM_STUDIO_MODEL_QA=
```

All four accept loaded model IDs from LM Studio. The default can be the same model for every stage. Recommended split is a faster lower-cost model for briefing/QA and a higher-quality instruct model for final writing. The graphics stage currently **creates actionable image briefs/prompts** using a text model; it does not pretend to render images. Actual visual files can be uploaded to the task's Assets tab.

Other configurable settings: `LM_STUDIO_MAX_TOKENS`, `LM_STUDIO_TEMPERATURE`, `LM_STUDIO_CONTEXT_CHAR_BUDGET`, `MODEL_IDLE_TIMEOUT_MS` (no output for this long means the model is stuck, default 3 minutes), `MODEL_TIMEOUT_MS` (overall cap per generation, default 15 minutes), `LM_STUDIO_STREAM`, `WORKER_CONCURRENCY`, `JOB_MAX_ATTEMPTS`, `JOB_RETRY_BASE_MS`, `AUTO_GENERATE_ON_MOVE`, and optionally `LM_STUDIO_API_TOKEN` if you enable authentication in LM Studio.

## Production flow

**MP FRESH:**

```text
Backlog
  -> Ready for Brief       [automatically queues editorial brief]
  -> Brief Complete        [worker advances after successful generation]
  -> Ready for Writing     [automatically queues content draft]
  -> Draft Complete        [worker advances after successful generation]
  -> Graphics              [automatically queues design/image prompts]
  -> Final Approval        [automatically queues QA]
  -> Ship to dev           [human approves and advances]
```

**Social Media:**

```text
Post Plan
  -> Plan Review           [queues an editorial brief]
  -> Content Drafting      [queues social draft]
  -> Content Review        [worker advances after successful generation]
  -> Graphics              [queues graphics directions]
  -> Graphic Review        [queues QA]
  -> Final Approval        [human approval lane]
  -> Ready to Post         [human approves and advances]
```

### Autopilot

**Run autopilot** on a task (or tick **Start autopilot immediately** when commissioning, or run it for a whole campaign) queues every remaining stage in order: brief, draft, graphics plan, QA. The card moves through its lanes as each stage finishes and stops in **Final Approval**. Autopilot never approves and never publishes. Stopping the running job stops the chain.

### Revision loop

Reviewer comments posted after the latest draft are open feedback. The next **Revise draft** sends the current draft, those comments and the latest QA findings to the model as requirements. **Rewrite from scratch** ignores the current draft. Every version is kept and can be restored.

### What blocks approval

Approval needs a draft, a QA report newer than that draft, and no `BLOCK` finding in the report. Blocks come from the deterministic preflight (unresolved `[VERIFY]` markers, placeholder text, leaked internal source keys, a Social Security number pattern, a near-duplicate of another draft) or from a model verdict of FAIL. To override, a person records a manual QA sign-off on the QA tab explaining why; that sign-off is versioned and attributed like everything else.

You can also manually trigger generation on any task. A job runner inside `server.mjs` takes jobs from the SQLite queue one at a time, so a slow local model does not block the browser or consume cloud tokens. Jobs survive process restarts and resume. Draft and QA artifacts are versioned. Approval requires at least one draft and a QA report that is newer than the latest draft. Human approval is the only step that promotes content to the final handoff lane.

**Important:** The app **does not auto-publish** to WordPress or social media. The `Record as published` action stores a validated live URL after someone publishes externally. API integrations for authorized publishing can be added later behind the existing approval gate.

## Import the actual historical Asana tasks

The included importer can copy task metadata and optionally comments from the historical MP FRESH and Social Media projects directly into the local SQLite database. This is **one-time import**, not live synchronization, and does **not modify Asana**.

```bash
# Set your token only for this shell command. Do not put it in Git or a browser URL.
ASANA_TOKEN='your-personal-access-token' node scripts/import-asana.mjs all --dry-run
ASANA_TOKEN='your-personal-access-token' node scripts/import-asana.mjs all --with-comments
```

Project IDs are embedded in the import script for the verified boards:
- MP FRESH: `1214665626602388`
- Social Media: `1215434213307280`

The importer maps real Asana section names to local columns, retains historical task titles/notes, source Google Docs links, owners, keyword and word-count fields where present, and optionally imports comment text. It stores the original Asana ID to avoid duplicate imports. It does not download linked Google Docs or attachments and does not assume that Asana's `completed` state proves publication or approval.

### Data ownership and backups

Local data is stored in `data/content-studio.sqlite`; uploaded attachments are in `data/assets/`. The database uses SQLite WAL journaling. Export an auditable JSON snapshot while the server is running via the **Export** button, or:

```bash
node scripts/export.mjs ./my-content-backup.json
```

For full recovery, stop the server and back up the entire `data/` folder. To start with no sample tasks, use **Settings > Remove sample tasks**, or set `NO_DEMO_SEED=1` before first startup.

## Standalone: host the frontend on Vercel, keep compute local (superseded by the MAIOS-hosted studio)

You can deploy the `public/` folder as a static frontend on Vercel. The root `vercel.json` is configured with `outputDirectory: "public"`; choose the **Other** framework preset in Vercel if prompted.

**This is intentionally a split architecture.** The Vercel site serves only HTML, CSS, and JavaScript. It does not run the local worker, store SQLite files, or call LM Studio directly. Instead:

```text
User browser -> Vercel static UI -> protected HTTPS endpoint on your server
                                    |
                                    +-> local Node API + SQLite
                                    +-> local job runner
                                            +-> LM Studio localhost:1234
```

For a remotely accessed UI, provide the **Node API** a secure HTTPS address using your own trusted reverse proxy or Zero Trust tunnel. Never directly publish the LM Studio port. Recommended environment settings for the local API:

```dotenv
HOST=0.0.0.0
PORT=4173
MAIOS_API_TOKEN=generate-a-long-random-secret
CORS_ORIGIN=https://your-vercel-domain.example
LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1
```

Bind the actual network access with a firewall, make the reverse proxy forward to port 4173, require HTTPS and preferably Zero Trust authentication. In the Vercel UI, open **Settings & connections**, enter your secure API URL and `MAIOS_API_TOKEN`, then save. The URL is saved in browser local storage and the token in session storage for that browser tab; neither is shipped in Vercel's source bundle.

**Same computer, no tunnel:** if you open the Vercel-hosted UI in a browser on the machine that runs the backend, set the API URL in Settings to `http://127.0.0.1:4173` and start the backend with `CORS_ORIGIN=https://your-vercel-domain`. Chrome and Firefox allow a hosted page to call `127.0.0.1`; Safari does not. Teammates on other machines still need the HTTPS endpoint described above.

`.vercelignore` keeps everything except `public/` and `vercel.json` out of the Vercel deployment, so the knowledge pack is never uploaded there. Keep the Git repository private: it contains `knowledge/`.

**Security scope:** The current token is a single-operator API secret, not a production multi-user identity system. If other staff or clients will use this remotely, add SSO, scoped RBAC, per-user audit identity, secure session handling, tenant isolation, origin/CSRF hardening, rate limiting, and proper object storage **before** exposing it widely. Do not rely on a shared token for client-facing SaaS.

Vercel cannot magically reach `http://localhost:1234` on your private Mac or server. The local API must remain alive and reachable through the secured path described above. For truly offline operation, run the UI and API locally together and do not expose any ports.

## Optional Docker deployment

`Dockerfile` and `docker-compose.yml` are provided. Copy `.env.example` to `.env`, set a nonempty `MAIOS_API_TOKEN`, and run `docker compose up -d --build`. Docker binds the UI/API port to the host's loopback interface. The container's LM Studio URL is set to `host.docker.internal` by default. LM Studio may need network access enabled for the Docker container to reach it. **Direct local Node startup is simpler and safer** if LM Studio is running on the same host.

## Knowledge API (v0.2)

- `GET /api/knowledge/stats`: source counts, categories, active records.
- `GET /api/knowledge`: filter/search by title, body, tags, scope and category.
- `GET /api/knowledge/:id`: full source record with original URL, trust status and version.
- `POST /api/knowledge`, `PATCH /api/knowledge/:id`, `PATCH /api/knowledge/:id/enabled`: add/update/disable source text.
- `GET /api/knowledge/:id/history`: inspect previous edits.
- `POST /api/knowledge/import`: paragraph-aware chunking of pasted documents.
- `GET /api/agents`, `PATCH /api/agents/:kind`: inspect/edit the four active specialist instructions.
- `GET /api/playbooks`: list the seven built-in commission patterns.
- `GET /api/tasks/:id/context?kind=draft`: view exact system/user messages plus selected knowledge and estimate.
- `GET /api/tasks/:id/sources`: source usage logged for completed agent jobs.

All API writes require the same access control as the main local API. There is no cloud ingestion service.

## HTTP API (summary)

- `GET /api/bootstrap` returns boards, stages, cards, jobs and artifact counts.
- `POST /api/commission` creates a campaign with one or more output tasks.
- `GET /api/tasks/:id` returns a task, artifacts, comments, events and related deliverables.
- `PATCH /api/tasks/:id` saves commission settings.
- `POST /api/tasks/:id/move` changes stages and enqueues configured automation.
- `POST /api/tasks/:id/generate` enqueues `brief`, `draft`, `graphics`, or `qa`. `{"kind":"draft","fresh":true}` ignores the current draft.
- `POST /api/tasks/:id/pipeline` starts autopilot for one task; `POST /api/campaigns/:campaignId/pipeline` for every deliverable in a campaign.
- `POST /api/jobs/:id/cancel` stops a queued or running job; `POST /api/jobs/:id/retry` requeues a failed or cancelled one.
- `GET /api/events` is a Server-Sent Events stream (`task`, `job`, `progress`, `changed`); `GET /api/tasks/:id/live` returns the text generated so far.
- `POST /api/tasks/:id/restore` un-archives a task.
- `POST /api/tasks/:id/artifact` records a manually written new artifact version.
- `POST /api/tasks/:id/comment` adds editorial feedback.
- `POST /api/tasks/:id/asset` uploads a supported binary asset (base64 JSON, max 5 MB).
- `POST /api/tasks/:id/approve` applies final approval and advances.
- `POST /api/tasks/:id/publish` records a publication URL after approval.
- `GET /api/brand` / `PATCH /api/brand` manage agent prompt profiles.
- `GET /api/models` checks LM Studio connectivity.
- `GET /api/export` downloads a JSON snapshot.

## Optional integrations (v0.4)

Both are configured in the app under **Settings** and are off until you set them up. Nothing else depends on them.

- **Gemini image generation.** Paste a Google AI Studio API key. When a piece reaches the graphics stage, the studio generates a set of on-brand graphics from the current draft (hero banner, key concept, two infographics, icon set, quote card, section divider, summary) with the configured image model (default `gemini-3.1-flash-image`) and attaches them to the task. The recipe and brand system are carried over from the MP FRESH graphics workflow in n8n; the brand system and the number of images are editable in Settings. Google's image models are paid only, so the key's project needs billing enabled.
- **Google Docs review links.** Create a Google Cloud project, enable the Drive API, create a **Desktop app** OAuth client, paste its ID and secret, then press Connect. Every draft gets a Google Doc in your Drive; later versions update the same document so the link is stable. The app asks only for the `drive.file` scope, so it can see only the documents it created. This sign-in works only when the browser runs on the same machine as the server, because Google redirects back to `http://127.0.0.1:PORT/api/google/callback`.

Comments made in a Google Doc are not copied back into the studio.

## What is not yet implemented

1. Automated external research and factual verification. **Source URLs are references, not crawled sources.** Supply source material in briefs and require reviewers to verify factual claims.
2. Video production, and image rendering without a Gemini key. With a Google Gemini API key saved in Settings, the image prompts in each graphics plan are rendered and attached to the task; without one the graphics agent's output stays text.
3. Live two-way Asana sync. The importer is read-only and one-time, by design, so MAIOS can become the primary system of record.
4. Automatic authorized publishing to WordPress, LinkedIn, Meta, X and GBP. The approval and delivery states are ready for future adapters.
5. Vector search / historical corpus embeddings, native calendar scheduling, analytics optimization, email notifications, true multi-user authorization, and rate-limit policies. The name set in Settings is an honour-system label for the audit trail, not a login.
6. Multi-server queue distribution. The local queue is **single-worker only**. Do not run two write-capable instances against the same SQLite database.

## Developer validation

```bash
npm run check
npm test
```

The integration tests also verify the 149 historical-source knowledge pack, 33 original specialist references, 70 social draft records, 7 playbooks, editable system prompts, source-trust tagging and source provenance in live model requests. The v0.3 suites add unit tests for every deterministic QA rule and integration tests for autopilot, live streaming, the QA approval gate, the revision loop, cancel and retry, offline-model backoff, token auth and CORS preflight, static-file hardening, ranked search, and upgrading a v0.2 database. The integration tests use a **fake LM Studio endpoint** (`scripts/mock-model.mjs`) to verify task commissioning, queueing, stage progression, artifact creation, QA, final human approval, publication records, comments, asset upload, and JSON export. It does **not** demonstrate actual text quality with your production model or external platform publishing.
