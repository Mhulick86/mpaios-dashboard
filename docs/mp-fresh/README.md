# MP FRESH v2: final workflow resolution

Status: **design locked, all decisions settled Nov 16, build not started.** This is the definitive version of the MP FRESH content pipeline. It replaces the three n8n workflows with a content engine inside the live MAIOS app (`mpaios-dashboard`, mpaios.vercel.app), with Asana staying the board and Google Docs staying the output.

It reconciles four sources:

1. **The n8n export** (`n8n-workflows-backup-2026-08-29.json`, via the Nov 16 pipeline document): section flow, prompts, schemas, doc templates and the 10 known issues.
2. **What actually happened in Asana**: 17 completed pages in Ship to dev, checked task by task on Nov 16.
3. **The marketingpowered.ai Site Direction Report** (GA4, Search Console and Semrush, Nov 15–16).
4. **The live site**: `https://marketingpowered.ai/sitemap.xml`, 145 URLs, fetched Nov 16.

Decisions already made (Nov 16): build into the live MAIOS, keep Asana as the board, write to Google Docs, apply all 10 fixes.

---

## 1. The flow

Project `1214665626602388` (MP FRESH). The engine listens to Asana webhooks for the project and acts only on the sections below. A human moves the card into every trigger section; the engine moves it out.

| # | Section | Who acts | What happens | Moves to | Asana comment |
|---|---|---|---|---|---|
| 1 | Backlog | Person | Task created with the notes template (section 2). | Ready for Brief (manual) | none |
| 2 | Ready for Brief | **Engine: brief** | Parse notes, fetch keyword data, Search Console data, live sitemap and (refresh only) the current page text. Brief agent returns JSON, QC gate runs, branded brief doc is rendered. | Brief Complete | `Content brief: {doc}` plus a one-line QC summary |
| 3 | Brief Complete | Person | Review and edit the brief doc. | Ready for Writing (manual) | none |
| 4 | Ready for Writing | **Engine: writer** | Load the brief JSON plus any edits made to the brief doc, write the page, QC gate, render the draft doc, attach it. | Draft Complete | `Draft complete: {doc}` plus QC summary |
| 5 | Draft Complete | Person | Review. To revise: comment with what to change and move back to Ready for Writing; the writer revises using comments posted since the last draft. | Graphics (manual) | none |
| 6 | Graphics | **Engine: graphics** | Eight brand images from the approved draft, with alt text, attached to the task and saved to the Drive folder. Hero also exported as 1200x630 og:image. | Final Approval | `{N} graphics attached for review` |
| 7 | Final Approval | Person, then **engine** | Reviewer approves copy, picks images and comments **TSMC** (human review complete). The engine records who signed off and on which draft and image set, then moves the card. | Ship to dev | Dev handoff checklist (section 6) |
| 8 | Ship to dev | Developer | Build the page using the dev handoff checklist (section 6). When live, set the task's URL field and complete the task. | (complete) | none |
| 9 | After publish | **Engine: measure** | At 28 and 90 days after completion, post Search Console clicks, impressions, CTR and position for the URL against the baseline captured at brief time. | (stays) | `28-day results: ...` |

What changed from n8n, structurally:

- **No comment scraping.** The engine stores each task's brief, draft and image IDs in its own table keyed by task GID. Comments are for people only (fix 8).
- **Refresh mode.** Most of the report's best opportunities are existing pages. Tasks can be new pages or refreshes of live pages (section 2).
- **Revision loop.** Moving a draft back to Ready for Writing produces a revised draft that addresses comments posted since the last draft, instead of a blind rewrite.
- **Measurement stage.** The pipeline closes the loop the report says is missing: did the page move?
- **No double runs.** n8n fired on every change in the project. The engine runs one job per task and stage at a time and ignores repeat events while a job is queued or running.

## 2. Task intake

**Task name:** `P0- /url-slug` for site pages, `BP0- /url-slug` for blog and guides. **No trailing slash**: the live site has none, and the old slashes produced redirect chains.

**Notes template** (one field per line, label then colon):

```
Mode: refresh
Primary Keyword: llm advertising
Secondary Keywords: llm ads, ads in llms, advertising in llms, llm advertising platform
URL: /resources/llm-advertising
Priority Group: P0
Semantic Variants: chatgpt ads, ai search advertising
Target Word Count: 1800-2400
Voice: company
```

- `Mode`: `new` (default) or `refresh`. Refresh pulls the live page text and Search Console queries for the URL.
- `Voice`: `company` (default) or `founder`. Founder voice is the only case where the founder may be named.
- Missing Primary Keyword: the engine comments `Brief not started: add "Primary Keyword:" to the notes` and leaves the task in place. n8n failed silently here.
- Priority parsed with `/^(B?P)(\d+)/`, so `BP2` stays `BP2` (fix 4).
- `URL Path` is still accepted as a label for URL.

## 3. Stages in detail

### Brief (Ready for Brief to Brief Complete)
- **Inputs:** notes; keyword data (Ahrefs `/v3/keywords-explorer/matching-terms`, US, top 30 by volume, as in n8n); Search Console last 28 days for the URL (refresh) or for queries containing the primary keyword (new); live sitemap paths; current page text (refresh); the approved proof-point list (section 7).
- **Model:** Claude Sonnet 5.5 (`claude-sonnet-5-5`) with the web search tool and the strict JSON schema `schemas/brief.schema.json`. n8n used GPT-4o; the model is a setting, so it can change without code edits. If web search and strict JSON output cannot run in one request, the brief runs as two calls: a short web-research call, then the JSON brief with the research notes as input.
- **Prompt:** `prompts/brief.system.md` and `prompts/brief.user.md`.
- **QC gate:** `qc.json`. Character counts are computed in code and overwrite the model's numbers (fix 6). Hard failures get one automatic repair pass with the findings fed back. If they persist, the task stays in Ready for Brief with a QC comment.
- **Doc:** `Content Brief - {task name} - {YYYY-MM-DD}` in Content Briefs (`1Jk7vjiKFVCMfcUnIu6SvWaL1S4BrERN8`). Same branded layout (Inter, 54 pt margins, #2CACE8 section bars, #08AE67 CTA bar), but every generated field is rendered: the six page-context fields, per-section must-include and proof points, closing direction, secondary-keyword placement notes, link placement and differentiators (fixes 2 and 3). The hardcoded fallback sentences are deleted; the "brand assets" and "paid media note" blocks stay as fixed copy. A QC block at the end lists any soft findings.
- **Sharing:** inherits the Drive folder's permissions. No "anyone with the link" grant (fix 1).

### Writer (Ready for Writing to Draft Complete)
- **Inputs:** the stored brief JSON, plus the current brief doc text when a reviewer edited it after generation (the doc wins where they differ). On revision runs, also comments posted since the last draft and the last draft's QC findings.
- **Model:** Claude Sonnet 5.5 (`claude-sonnet-5-5`), adaptive thinking, high effort, streamed, JSON output per `schemas/writer.schema.json`. n8n used Claude Opus 4.5. Claude Opus 5.5 (`claude-opus-5-5`) is the configured quality fallback if Sonnet drafts fall short in review.
- **Prompt:** `prompts/writer.system.md` and `prompts/writer.user.md`.
- **Blocked runs:** the writer can return `status: "blocked"` (missing keyword or H1, unclear buyer, a compliance problem, or a request that needs invented stats) instead of the n8n behavior of "asking" no one. The engine comments the reason and leaves the task in Ready for Writing.
- **QC gate:** as above, plus: H1, title and meta must match the brief; links must be in the live sitemap; every figure needs a bracketed citation and a Sources list.
- **Doc:** `{BP|P}{n}-marketingpowered.ai{url}` in MP Pages (`1gq-rQYB9_AJxBLZziAD1L4K6lsXmLEIQ`), same six-part template as n8n plus a Sources section in the page copy and a QC block. Attached to the task as a link. Folder permissions only (fix 1).

### Graphics (Graphics to Final Approval)
- `prompts/graphics.md`: the n8n brand block and eight verbatim specs, sent to `gemini-3.1-flash-image`, one request per image, with the approved draft as subject matter (read through the authenticated Docs API, never the public export URL).
- **Words inside images are off by default** because image models misspell text. This matches the Content Studio v0.4 setting.
- Each image gets generated alt text. The hero is also exported at 1200x630 for og:image, because the report found many pages lack one.
- **Evidence for making this stage real:** none of the 17 completed pages has the n8n graphics comment. Emily attached images by hand in August ("AI search 1–5.png" and similar). The Nano Banana workflow never ran in production.

### Measure (after completion)
- Baseline: Search Console figures for the URL captured when the brief ran.
- Comments at 28 and 90 days with clicks, impressions, CTR and average position against that baseline, plus the top five queries.
- Ignores queries at position 1 or 2 with zero clicks. The report found these misleading for this site ("internet marketing company" at position 1.1 with 478 impressions and 0 clicks).

## 4. Where it runs

Inside `mpaios-dashboard` (Next.js on Vercel, project `mpaios`), as a new **Content Engine** area. It reuses the dashboard's existing Asana, Ahrefs, Google Drive and Search Console code.

- `POST /api/mpfresh/asana` receives Asana webhook events (verifies `X-Hook-Signature`), creates at most one job per task and stage, and returns immediately.
- `POST /api/mpfresh/worker` (`maxDuration` 800 s) runs a job. It is invoked right after enqueue, and a Vercel Cron every 5 minutes picks up anything queued or stalled. Jobs and per-task state live in Supabase, which the dashboard already uses.
- A **Content Engine** page in MAIOS shows every task's stage, job history, QC results, doc links and images. It can re-run a stage and edit the approved proof points, brand values and banned words without a deploy.
- Prompts and schemas in this folder are copied into the dashboard and loaded at run time. The proof-point list and live sitemap are injected per run.

## 5. Keys and access the build needs

Asked for at build time and stored as Vercel environment variables or in the MAIOS settings store. They are never committed to code.

| What | Used for |
|---|---|
| Anthropic API key | Brief agent (with web search), writer agent, alt text, QC repair |
| Google Gemini API key | Images |
| Ahrefs API key | Keyword data in briefs |
| Asana personal access token for Mike's account | Webhook, task reads, moves, comments, attachments |
| Google OAuth client plus a connected Workspace account with access to the two Drive folders and Search Console `sc-domain:marketingpowered.ai` | Docs, Drive, Search Console |

Semrush is not used by the engine. The account's API unit balance is zero (every report call on Nov 16 was refused), and the n8n pipeline used Ahrefs. If Semrush units are added later, it can replace or supplement Ahrefs for keyword data.

## 6. Dev handoff checklist (posted when TSMC moves the card to Ship to dev)

Each item comes from the site report or the open dev tasks already in Ship to dev:

- [ ] Canonical URL without trailing slash; listed in sitemap.xml.
- [ ] Exactly one H1; no heading-level skips (the report found H1 to H3 skips on service pages).
- [ ] Title and meta description as approved; og:title, og:description and og:image (hero crop) set.
- [ ] Every content image has the alt text from the Graphics stage.
- [ ] Internal links as written; none to redirecting or 404 paths.
- [ ] External citation links open in a new tab with `rel="noopener noreferrer"`; Sources section present.
- [ ] Primary CTA goes to `/get-started/book-a-call` or `/get-started/request-an-audit`, worded as approved.
- [ ] Schema type from the draft's recommendation implemented (FAQPage when there is an FAQ).

The report's site-wide fixes (form submissions as GA4 key events, Tawk.to auto-open, the /cards price typo, the contact-page form fold) are dev tasks, not part of this pipeline. They decide whether pages produced here can ever show conversions, so they should be scheduled first.

## 7. Decisions

Settled Nov 16:

1. **Approved proof points:** the list in `proof-points.json` is approved. "$50M+", the $30M to $140M revenue figure, Haven Health by name, CMO dates and named hardware stay out. The agents may use only the approved list, and the QC gate flags the excluded items if they appear.
2. **Verticals:** hospitals and health systems are a target vertical alongside behavioral health and mental health. Both prompts already cover all three, including a hospital buyer archetype in the writer prompt.
3. **"TSMC" means human review is complete.** It is now the sign-off for Final Approval. A TSMC comment from a person (never from the engine's own account) on a task in Final Approval moves it to Ship to dev and posts the dev handoff checklist. The sign-off is tied to the draft version and image set it approved: if the task is later moved back for changes, the old TSMC no longer counts and a new one is needed. Moving the card by hand still works.

4. **Who posts:** the engine uses Mike's Asana account (personal access token), as the n8n workflows did. Because that account also comments as a person, the engine marks its own comments with a leading tag (for example `[MP FRESH]`) and never treats a comment it posted as a TSMC sign-off.

5. **Models** (prices per 1M tokens, input / output, Nov 16 2026):
   - Brief: Claude Sonnet 5.5, $2 / $10, plus web search at $10 per 1,000 searches.
   - Writer: Claude Sonnet 5.5, $2 / $10. Fallback: Claude Opus 5.5, $4 / $20.
   - Alt text and QC repair passes: Claude Haiku 5.5, $0.10 / $0.50.
   - Images: unchanged, `gemini-3.1-flash-image`.
   - Estimated cost per page before images: about $0.33, against about $0.65 for the n8n setup (GPT-4o brief, Claude Opus 4.5 writer). These are estimates, not measurements.
   - Before switching production over: run two or three real pages through Sonnet 5.5 and Opus 5.5 side by side and compare them in review. If Sonnet's drafts need noticeably more editing, set the writer to Opus 5.5; the price difference is cents per page.
   - One fewer key: the engine no longer needs an OpenAI key.

## 8. What the site report changes in the content itself

Built into the prompts and QC:

- **Internal links come from the live sitemap**, fetched each run. The n8n prompt's hardcoded list included pages that do not exist (`/who-we-help/behavioral-health/inpatient/`, `/outpatient/`, `/detox/`, `/sober-living/`, `/who-we-help/mental-health/eating-disorders/` and others; the live site has `/residential-treatment`, `/detox-centers`, `/substance-use-disorder` instead). It also had trailing slashes. That matches the broken-link and redirect tasks sitting in Ship to dev.
- **One conversion offer per page**, with consistent wording. The report found Audit and strategy-call language mixed on the same pages, and a thank-you page promising an audit to strategy-call leads.
- **Sentence-case, specific headings, and no heading skips.** The report found "Introduction To PPC Campaign Management" as an H3 directly under the H1.
- **Alt text and og:image on every page.** The report found empty alt text on meaningful photos and many pages without og:image.
- **Search Console in the brief**, so briefs target positions 8–25, where clicks are closest, and ignore misleading position-1 queries.

## 9. Seed backlog from the report

Numbers are from the report (GSC Oct 15–Nov 13 2026; Semrush US snapshot Nov 15 2026). Semrush could not be re-queried (zero API units).

| Priority | Task | Mode | Primary keyword | Evidence |
|---|---|---|---|---|
| P0 | `/resources/llm-advertising` | refresh | llm advertising | Impressions 155 → 700, 4 clicks; "llm advertising" position 8.8, "llm ads" 9.6, "advertising in llms" 11.6, "ads in llms" 13.9; Semrush "llm advertising platform" position 17, 1,300/mo |
| P0 | `/who-we-help/mental-health` | refresh | mental health marketing agency | 2,154 impressions, position 69.6, 0 clicks; "mental health marketing" 435 impressions; Semrush "mental health marketing agency" position 49, 590/mo |
| P1 | `/who-we-help` | refresh | behavioral health marketing agency | 1,252 impressions, position 50.7, 0 clicks; Semrush "behavioral health marketing agency" position 21, 260/mo; "behavioral health marketing" 423 impressions |
| P1 | `/ai-edge/ai-governance` | refresh | healthcare ai governance | "healthcare ai governance" 200 and "ai governance in healthcare" 179 impressions, 0 clicks; Semrush governance-platforms term position 26, 880/mo |
| P2 | `/ai-edge/data-sovereignty` | refresh | healthcare data sovereignty | Position 14.0, 33 impressions |
| P2 | `/get-started/request-an-audit` | refresh | free marketing audit | Position 23.4, 81 impressions (new query) |
| P2 | Page to be chosen | new or refresh | ai powered marketing | Position 21.7, 125 impressions; "ai-powered marketing" 19.8 |
| P2 | Page to be chosen | new | paid media reporting framework | Long-tail question at position 8.3, 164 impressions, 0 clicks |

Do not create tasks for "internet marketing company" or the Palm Beach generic queries. The report shows position-1 rankings with near-zero clicks, which are not real wins.

`/services/ppc/introduction-to-ppc-campaign-management` (9 sessions, 0 engaged, heading skip, template copy) is a consolidate-or-rewrite decision for the developer, not a generation task.

## 10. The 10 n8n issues and how each is resolved

| # | Issue | Resolution |
|---|---|---|
| 1 | Drafts shared "anyone with the link can edit"; graphics depended on it | No public grants; docs inherit folder permissions; graphics reads through the authenticated Docs API. Separately, audit existing MP Pages docs and remove public edit links (one-off cleanup task). |
| 2 | Schema blocked six page-context fields and proof_points_by_category | All seven added to the strict schema as required fields; hardcoded fallbacks deleted. |
| 3 | Renderer dropped must_include, proof points, closing direction, placements, differentiators | Every field rendered; the writer receives the brief JSON itself, not flattened doc text. |
| 4 | `BP2` became `P2` in filenames | `/^(B?P)(\d+)/`. |
| 5 | Title Case headings | Sentence case required in the brief prompt and checked by QC. |
| 6 | Wrong character counts | Counted in code; model values overwritten. |
| 7 | Banned words leaked | QC gate after both agents (`qc.json`), with one automatic repair pass. |
| 8 | Graphics could pick the wrong doc from comments | Doc IDs stored per task; no comment parsing. |
| 9 | Prompt facts didn't match your record (Haven dates, hardware) | Facts moved out of prompts into the approved proof-point list (section 7). |
| 10 | Prompt hygiene (em dashes, "empowering", placeholder brand PDF, unused logo SVGs) | Em dashes removed; "empowering" removed; brand PDF placeholder dropped; the model is told not to draw the logo; the designer adds the real file. |

## 11. Prompt changes, at a glance

- **Brief prompt** (`prompts/brief.system.md`, from `sources/brief.n8n.txt`): verticals include hospitals and health systems; injected approved proof points and live sitemap replace hardcoded lists; two-offer CTA rule; inputs add page mode, Search Console data and current page text; sentence case; code-counted lengths; the "additional fields" block is now part of the schema; no em dashes.
- **Writer prompt** (`prompts/writer.system.md`, from `sources/writer.n8n.txt`, 12 edits; everything else verbatim): verticals and a fourth buyer archetype (hospital and health system); "ask" replaced by a `blocked` status; numbered citations plus a Sources section; outcome-framing examples no longer contain invented percentages; the trust-signals list is replaced by the injected approved list and the house editing rules; alt text never empty; an output contract section added.
- **Graphics** (`prompts/graphics.md`): specs verbatim; text-free by default; size per spec; no logo drawing; alt text step.

## Files

```
docs/mp-fresh/
  README.md                 this resolution
  qc.json                   QC gate rules (banned phrases, limits, house strip-outs, hard vs soft)
  proof-points.json         approved and excluded proof points (injected into both prompts)
  prompts/brief.system.md   brief.user.md
  prompts/writer.system.md  writer.user.md
  prompts/graphics.md
  schemas/brief.schema.json  writer.schema.json   (strict mode: all fields required, no extras)
  sources/brief.n8n.txt  writer.n8n.txt           (verbatim n8n prompts, for diffing)
```
