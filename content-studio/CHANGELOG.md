# Changelog

## 0.5.0

- Runs inside MAIOS on Vercel: shared API core (`core.mjs`), hosted runtime (`hosted.mjs`) with the SQLite database in private Vercel Blob storage and ETag-conditional writes, background generation via `after()` and a cron backstop, polling instead of Server-Sent Events, cross-instance cancel.
- Cloud model providers (`providers.mjs`): Anthropic (streaming, effort per stage, server-side refusal fallback), OpenAI Responses API, Google Gemini; LM Studio only for the local server.
- Settings: provider dropdown with encrypted key storage (`secrets.mjs`), key test, per-stage model dropdowns.
- Hosted access control: passcode on every address with signed HttpOnly sessions; initial passcode from `STUDIO_PASSCODE`; changing it signs other browsers out.
- Knowledge context budget raised to 30,000 characters for cloud models.
- Tests: two-instance hosted test (no lost writes under conflicts, cross-instance cancel, encrypted keys).

## 0.4.0

### Fixed

- **Scrolling a task pop-out also scrolled the page behind it**, and the board had three nested scroll areas (page, board, column). The app shell now fills the window; the board scrolls sideways, each column scrolls its own cards, and overlays never pass scroll through.
- **Clicking a tab inside a task jumped the pop-out back to the top.** Scroll position is now kept when a task is redrawn.
- **Live updates rebuilt the board and the open task even when nothing had changed**, which reset column scroll, dropped text selection, closed open menus and could swallow a click. Identical data is no longer redrawn, and the board is never rebuilt under a card being dragged.
- Cards flickered when the pointer rested on their edge (hover moved the card out from under it).
- A draft scrolled inside its own box inside the scrolling pop-out. It now flows in the pop-out with a sticky toolbar.
- The sidebar was cut off on short windows, and its collapse button was visible but did nothing (now hidden).

### Added

- **Gemini image generation** for graphics plans, automatic or on demand, with results attached to the task.
- **Google Docs review links** for drafts and briefs, created automatically when a draft is saved and updated in place on revision.
- **Send back for revision.** A reviewer's note returns the card to drafting, withdraws approval and queues a revised draft that must address the note. Nothing is deleted; the earlier draft stays in version history.
- **House editing rules in QA**, taken from how drafts were actually edited: recurring strip-outs (founder name outside founder-voice pieces, the "$50 million" figure, brand valuation, "AI" or "LLC" in the brand name, former employers), figures without a bracketed citation on the same line, missing source list, and missing internal or outbound links on long-form pages.
- **Text-free images by default.** Image models misspell words, so prompts now forbid rendered text unless "Allow words inside images" is turned on in Settings.
- The image recipe from the n8n workflow "MP FRESH — Graphics → Final Approval (Nano Banana)": brand system, the draft as subject matter, and eight fixed graphic types.

## 0.3.0

### Fixed (present in 0.2.0)

- **Task drawer controls were dead.** The drawer element carried `data-task-id`, so the global click handler matched it first, reopened the task and returned. Tabs never switched and the Brief / Write / Graphics / QA, approve, comment, publish and archive controls never ran. Only dragging a card into an automated lane produced work.
- **QA never blocked an approval.** Findings were written as `- BLOCK: ...` and the gate tested `/^BLOCK:/m`. A model verdict of FAIL was also only recognised in the exact form `Verdict: FAIL`. Approval now refuses any report with a blocking finding, and the verdict parser handles headings, bold and an echoed `(PASS / REVIEW / FAIL)` template.
- **Split Vercel deployment could not work.** The UI sends `X-MAIOS-Actor` on every request but the CORS preflight did not allow it, so the browser rejected every cross-origin call.
- **Docker image crashed on start.** The Dockerfile did not copy `knowledge.mjs` or `knowledge/seed.json`.
- **Approval bypass.** `PATCH /api/tasks/:id` accepted `published_url`, recording a live URL on unapproved content. It is now only settable through the approval-gated publish action.
- **Two data directories.** The database resolved `DATA_DIR` against the shell's working directory and assets against the project folder. Both now use one resolved path, and the CLI scripts read `.env` too.
- **Reviewer comments were never used.** They were stored and displayed but not sent to the model.
- A from-scratch draft request included the previous draft in the prompt, anchoring the rewrite.
- Request-size errors always said "4 MB"; validation errors were logged as server errors; the bootstrap payload reported version 0.1.0.

### Added

- **Autopilot** for a task, a campaign, or at commission time. Runs brief, draft, graphics plan and QA in order, moves the card, stops at the human approval lane.
- **Streaming generation and live output** over Server-Sent Events, with an idle timeout that tells a slow model from a stuck one, and **Stop** for a running job.
- **Revision loop**: open reviewer comments and the latest QA findings are passed to the next draft as requirements; "post comment and revise" in one step; "rewrite from scratch".
- **Deterministic QA preflight** (`qa-checks.mjs`): length against the commission, per-channel character and hashtag limits, `[VERIFY]` and placeholder markers, leaked internal source keys, assistant chatter, em dashes, template endings, hype phrases, guarantee language, numeric claims, privacy patterns, website H1 / H2 / meta / primary keyword, and 4-word-shingle repetition against every other live draft and the historical draft archive.
- **QA status** on every card (clear, review, blocked, stale, manual) and in the review queue.
- **Retry with backoff** when the model server is unreachable, manual retry that resumes a stopped autopilot, and optional worker concurrency.
- Reasoning-model `<think>` blocks are stripped from output and from the live preview.
- Rendered Markdown artifacts, version picker with restore, word counts, download as `.md`.
- Ranked full-text knowledge search with highlighted matches (falls back to substring search).
- Agent runs view with status, model, duration, error, Stop and Retry.
- Operator name in Settings, recorded on comments, approvals and history.
- `npm run demo` and `scripts/mock-model.mjs`: an OpenAI-compatible stand-in for LM Studio.
- Content-Security-Policy and related headers on the UI; uploaded assets are served sandboxed.
- Additive database migration: a 0.2.0 database opens without a reset.
- `.vercelignore` so only the static UI is uploaded to Vercel, and private-network preflight support so the hosted UI can reach a backend on the same machine.

### Changed

- UI palette moved to the brand colours in the supplied guidelines (sky blue `#2CACE8`, green `#08AE67`). Just Sans Variable is used when installed; the font is not bundled.
- `MODEL_TIMEOUT_MS` is now the overall cap per generation (default 15 minutes); `MODEL_IDLE_TIMEOUT_MS` (default 3 minutes) is the stuck-model detector. An existing `.env` value is still honoured.
- Unresolved `[VERIFY]` markers now block approval. Previously they were a note.
- The QA prompt asks for a leading `Verdict:` line so the verdict can be read reliably.
- Jobs start the moment they are queued instead of on the next 3.5 second tick.
