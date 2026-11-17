#!/usr/bin/env python3
"""Set up the local research team in LM Studio and check that it answers.

Run on the Mac that has LM Studio installed:

    python3 lmstudio_team.py            # start server, load the three models, test them
    python3 lmstudio_team.py --test     # only test what is already loaded
    python3 lmstudio_team.py --unload   # unload the three models

Uses only the Python standard library and LM Studio's `lms` command.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE_URL = os.environ.get("LM_STUDIO_BASE_URL", "http://127.0.0.1:1234/v1").rstrip("/")
MODELS_DIR = Path(os.environ.get("LM_STUDIO_MODELS_DIR", Path.home() / ".lmstudio" / "models"))

# identifier: the name the studio will call; file: the download; context: tokens to load with.
TEAM = [
    {"identifier": "lead", "role": "writes drafts, first QA verdict",
     "repo": "lmstudio-community/Qwen3.8-27B-GGUF", "file": "Qwen3.8-27B-Q4_K_M.gguf", "context": 49152},
    {"identifier": "reader", "role": "checks one claim against one page, four at once",
     "repo": "lmstudio-community/Qwen3.5-4B-GGUF", "file": "Qwen3.5-4B-Q8_0.gguf", "context": 65536},
    {"identifier": "judge", "role": "independent second check",
     "repo": "lmstudio-community/gemma-4-12B-it-GGUF", "file": "gemma-4-12B-it-Q8_0.gguf", "context": 16384},
]


def find_lms():
    found = shutil.which("lms")
    if found:
        return found
    fallback = Path.home() / ".lmstudio" / "bin" / "lms"
    if fallback.exists():
        return str(fallback)
    sys.exit("Could not find the `lms` command. Open LM Studio once, then run: ~/.lmstudio/bin/lms bootstrap")


def run(cmd, timeout=900):
    """Run a command, return (exit code, combined output)."""
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout + p.stderr).strip()
    except subprocess.TimeoutExpired:
        return 124, f"timed out after {timeout}s"


def http(path, payload=None, timeout=600):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def server_up():
    try:
        http("/models", timeout=5)
        return True
    except (urllib.error.URLError, OSError, ValueError):
        return False


def loaded_ids():
    try:
        return {m.get("id") for m in http("/models", timeout=10).get("data", [])}
    except (urllib.error.URLError, OSError, ValueError):
        return set()


def start_server(lms):
    if server_up():
        print(f"Server already running at {BASE_URL}")
        return
    print("Starting the LM Studio server...")
    code, out = run([lms, "server", "start"], timeout=120)
    for _ in range(30):
        if server_up():
            print(f"Server running at {BASE_URL}")
            return
        time.sleep(1)
    sys.exit(f"The server did not start.\n{out}")


def candidate_keys(lms, member):
    """Names LM Studio might know this model by, most specific first."""
    keys = []
    code, out = run([lms, "ls", "--json"], timeout=60)
    if code == 0:
        try:
            needle = member["file"].lower()
            stem = member["repo"].split("/")[1].replace("-GGUF", "").lower()
            for entry in json.loads(out):
                text = json.dumps(entry).lower()
                if needle in text or stem in text:
                    for field in ("modelKey", "path", "indexedModelIdentifier"):
                        if entry.get(field):
                            keys.append(entry[field])
        except (ValueError, TypeError, AttributeError):
            pass
    keys.append(f"{member['repo']}/{member['file']}")
    keys.append(member["repo"])
    keys.append(member["repo"].split("/")[1].replace("-GGUF", "").lower())
    seen, unique = set(), []
    for k in keys:
        if k not in seen:
            seen.add(k)
            unique.append(k)
    return unique


def load_team(lms):
    already = loaded_ids()
    for member in TEAM:
        ident = member["identifier"]
        path = MODELS_DIR / member["repo"] / member["file"]
        if not path.exists():
            print(f"[{ident}] MISSING file: {path}")
            continue
        if ident in already:
            print(f"[{ident}] already loaded")
            continue
        print(f"[{ident}] loading {member['file']} with {member['context']:,} tokens of context...")
        last = ""
        for key in candidate_keys(lms, member):
            code, out = run([lms, "load", key, "--identifier", ident,
                             "--context-length", str(member["context"]), "--gpu", "max"])
            if code == 0:
                print(f"[{ident}] loaded as '{key}'")
                break
            last = out
        else:
            print(f"[{ident}] FAILED to load. Last message from LM Studio:\n{last[-600:]}")


def ask(ident, prompt, max_tokens=400):
    started = time.time()
    data = http("/chat/completions", {
        "model": ident, "temperature": 0, "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    })
    msg = data["choices"][0]["message"]
    text = (msg.get("content") or msg.get("reasoning_content") or "").strip()
    usage = data.get("usage") or {}
    return text, usage.get("completion_tokens", 0), time.time() - started


def test_team():
    ids = loaded_ids()
    ok = True
    for member in TEAM:
        ident = member["identifier"]
        if ident not in ids:
            print(f"[{ident}] NOT LOADED")
            ok = False
            continue
        try:
            text, tokens, secs = ask(ident, "Reply with the single word: ready")
            speed = f"{tokens / secs:.0f} tokens/s" if secs > 0 and tokens else "speed unknown"
            print(f"[{ident}] answered in {secs:.1f}s ({speed}): {text[:80]!r}")
        except Exception as e:  # report and carry on to the next model
            print(f"[{ident}] ERROR: {e}")
            ok = False

    if "reader" in ids:
        print("[reader] sending 4 requests at once...")
        prompts = [f"In one short sentence, what is {n} plus {n}?" for n in (2, 3, 4, 5)]
        started = time.time()
        try:
            with ThreadPoolExecutor(max_workers=4) as pool:
                results = list(pool.map(lambda p: ask("reader", p, 200), prompts))
            total = time.time() - started
            slowest = max(r[2] for r in results)
            print(f"[reader] 4 parallel answers in {total:.1f}s (slowest single answer {slowest:.1f}s)")
        except Exception as e:
            print(f"[reader] parallel test ERROR: {e}")
            ok = False
    return ok


def unload_team(lms):
    for member in TEAM:
        code, out = run([lms, "unload", member["identifier"]], timeout=120)
        print(f"[{member['identifier']}] {'unloaded' if code == 0 else 'not unloaded: ' + out[-200:]}")


def main():
    parser = argparse.ArgumentParser(description="Set up and test the local LM Studio team.")
    parser.add_argument("--test", action="store_true", help="only test the models that are already loaded")
    parser.add_argument("--unload", action="store_true", help="unload the three models")
    args = parser.parse_args()

    lms = find_lms()
    if args.unload:
        unload_team(lms)
        return
    start_server(lms)
    if not args.test:
        load_team(lms)
    ok = test_team()
    print("\nTeam is ready." if ok else "\nSomething needs attention; see the lines above.")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
