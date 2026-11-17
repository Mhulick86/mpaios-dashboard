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

# identifier: the name the studio will call; file: the download.
# per_request: tokens of context one request needs (the lead now gets the full research pack: up to 25 searches).
# parallel: [minimum, maximum] requests served at once; plan_team() picks the most this Mac's memory allows.
# weights_gb / kv_mb_per_token: used when the file is not on disk yet / estimated KV cache cost (fp16, rounded up).
TEAM = [
    {"identifier": "lead", "role": "writes drafts and QA reports (one card per slot)",
     "repo": "lmstudio-community/Qwen3.8-27B-GGUF", "file": "Qwen3.8-27B-Q4_K_M.gguf",
     "per_request": 81920, "min_per_request": 49152, "parallel": [1, 3], "weights_gb": 16.5, "kv_mb_per_token": 0.26},
    {"identifier": "reader", "role": "reads pages and checks one claim against one page, many at once",
     "repo": "lmstudio-community/Qwen3.5-4B-GGUF", "file": "Qwen3.5-4B-Q8_0.gguf",
     "per_request": 16384, "min_per_request": 12288, "parallel": [4, 16], "weights_gb": 4.5, "kv_mb_per_token": 0.15},
    {"identifier": "judge", "role": "independent second check",
     "repo": "sigmanih/google-gemma-4-12B-it-GGUF-Q8_0", "file": "google--gemma-4-12B-it.Q8_0.gguf",
     "per_request": 6144, "min_per_request": 4096, "parallel": [4, 8], "weights_gb": 12.7, "kv_mb_per_token": 0.4},
]
PLAN_PATH = Path(os.environ.get("MAIOS_TEAM_PLAN", Path.home() / ".maios-team-plan.json"))


def memory_gb():
    """Total memory of this machine in GB (unified memory on Apple silicon)."""
    try:
        if sys.platform == "darwin":
            return int(subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True).stdout.strip()) / 2**30
        with open("/proc/meminfo") as f:
            return int(next(l for l in f if l.startswith("MemTotal")).split()[1]) / 2**20
    except Exception:
        return 32.0


def plan_team(total_gb=None):
    """
    Size the team to this machine: the most parallel slots and the largest context that fit in memory, leaving room
    for macOS and other apps. macOS lets the GPU use about 75% of unified memory by default; we keep 4 GB more back.
    Order of growth: give the lead its full context, then more reader slots (claim checks and page reading run many at
    once), then judge slots, then extra lead slots (each one lets the worker run another card at the same time).
    """
    total_gb = total_gb or memory_gb()
    budget = total_gb * 0.75 - 4
    def weights(m):
        path = MODELS_DIR / m["repo"] / m["file"]
        return path.stat().st_size / 2**30 if path.exists() else m["weights_gb"]
    plan = {m["identifier"]: {"parallel": m["parallel"][0], "per_request": m["min_per_request"]} for m in TEAM}
    by_id = {m["identifier"]: m for m in TEAM}
    def used():
        return sum(weights(by_id[i]) + by_id[i]["kv_mb_per_token"] * p["per_request"] * p["parallel"] / 1024 for i, p in plan.items())
    steps = [("lead", "per_request", by_id["lead"]["per_request"])]
    for i in ("reader", "judge"):
        steps.append((i, "per_request", by_id[i]["per_request"]))
    for n in range(by_id["reader"]["parallel"][0] + 2, by_id["reader"]["parallel"][1] + 1, 2):
        steps.append(("reader", "parallel", n))
    for n in range(by_id["judge"]["parallel"][0] + 2, by_id["judge"]["parallel"][1] + 1, 2):
        steps.append(("judge", "parallel", n))
    for n in range(by_id["lead"]["parallel"][0] + 1, by_id["lead"]["parallel"][1] + 1):
        steps.append(("lead", "parallel", n))
    for ident, field, value in steps:
        before = plan[ident][field]
        plan[ident][field] = value
        if used() > budget:
            plan[ident][field] = before
    for i, p in plan.items():
        p["context"] = p["per_request"] * p["parallel"]   # works whether LM Studio splits the context per slot or shares it
    return {"memory_gb": round(total_gb, 1), "budget_gb": round(budget, 1), "estimated_gb": round(used(), 1), "models": plan}


def read_plan():
    """The plan the team was last loaded with (or a fresh one)."""
    try:
        return json.loads(PLAN_PATH.read_text())
    except Exception:
        return plan_team()


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
    plan = plan_team()
    print(f"This machine: {plan['memory_gb']} GB memory, {plan['budget_gb']} GB for models, plan uses about {plan['estimated_gb']} GB.")
    for member in TEAM:
        ident = member["identifier"]
        path = MODELS_DIR / member["repo"] / member["file"]
        if not path.exists():
            print(f"[{ident}] MISSING file: {path}")
            continue
        if ident in already:
            print(f"[{ident}] already loaded")
            continue
        p = plan["models"][ident]
        print(f"[{ident}] loading {member['file']}: {p['parallel']} at once, {p['per_request']:,} tokens each ({p['context']:,} total)...")
        last = ""
        for key in candidate_keys(lms, member):
            code, out = run([lms, "load", key, "--identifier", ident, "--context-length", str(p["context"]),
                             "--parallel", str(p["parallel"]), "--gpu", "max"])
            if code != 0 and "parallel" in out.lower():
                # LM Studio before 0.4.1 has no --parallel: load with its default of 4 at once.
                p.update(parallel=4, context=p["per_request"] * 4)
                code, out = run([lms, "load", key, "--identifier", ident, "--context-length", str(p["context"]), "--gpu", "max"])
            if code == 0:
                print(f"[{ident}] loaded as '{key}'")
                break
            last = out
        else:
            print(f"[{ident}] FAILED to load. Last message from LM Studio:\n{last[-600:]}")
    try:
        PLAN_PATH.write_text(json.dumps(plan, indent=2))   # the worker sizes its parallel work from this
    except OSError:
        pass


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
