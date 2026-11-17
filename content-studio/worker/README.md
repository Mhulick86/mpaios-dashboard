# MAIOS local team worker

Runs Content Studio stages on LM Studio on a team member's Mac, free of API cost. The studio (on Vercel or local)
never calls the Mac. Instead this worker asks the studio for work, and starts LM Studio only when there is some.

## How it fits together

1. In the studio, **Settings > AI models** now offers **Local team** for each stage (Brief, Draft, Graphics, QA).
2. A card that reaches a Local team stage waits in the queue. The studio does not run it.
3. The worker polls `POST /api/worker/claim` every 20 seconds. With no work it does nothing and loads nothing.
4. When there is work it starts the LM Studio server, loads `lead`, `reader` and `judge`, runs the stage, and posts
   the result to the card. While it works, the card shows what it is doing.
5. After 15 minutes with no local work it unloads the models.

What each stage does locally:

- **Brief, Graphics**: the lead model writes from the studio's own prompt.
- **Draft**: the lead plans what needs a source, the readers search and read pages four at a time and keep only
  passages that really appear on the page, then the lead writes citing only those passages.
- **QA**: every cited claim is checked against its page (reader), confirmed word for word, judged (judge), and
  failed claims get a search for a better source. The lead then writes the QA report from those results.

## One-time setup

1. Models: download the three files listed in `lmstudio_team.py` and run `python3 lmstudio_team.py` once.
2. Search: install the DuckDuckGo plugin from https://lmstudio.ai/danielsig/duckduckgo ("Run in LM Studio").
3. Token: add `STUDIO_WORKER_TOKEN` (24+ random characters) to the Vercel project and redeploy.
4. On the Mac, with the three `.py` files in one folder:

```bash
python3 maios_worker.py --setup
python3 maios_worker.py --install
```

`--setup` asks for the studio address (`https://YOUR-SITE/api/studio` for the hosted studio) and the token.
`--install` starts the worker in the background now and at every login. `--status` shows recent activity,
`--uninstall` removes it. The log is `~/Library/Logs/maios-worker.log`.

5. In the studio, set the stages you want to **Local team**.

## Good to know

- If the Mac is off or asleep, Local team cards wait in the queue; nothing fails. Switch the stage back to a cloud
  model in Settings to run them elsewhere.
- A job the worker stops reporting on for 20 minutes goes back in the queue.
- Model settings and prompts for the three roles are at the top of `lmstudio_qa.py`.
