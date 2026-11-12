"""Sync secrets from repo .env.local to web/.env.local, GitHub secrets/vars and Vercel env. Never prints values."""
import re, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
GH = r"C:\Program Files\GitHub CLI\gh.exe"
REPO = "aryamanbhati/ENAM-"
env = {}
for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
    m = re.match(r"\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)", line)
    if m and m.group(2).strip():
        env[m.group(1)] = m.group(2).strip().strip('"').strip("'")

WEB = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "GEMINI_API_KEY",
       "GITHUB_DISPATCH_TOKEN", "GITHUB_REPO", "FINN_MODEL_CHEAP", "FINN_MODEL_STRONG", "FINN_EMBED_MODEL",
       "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]
GH_SECRETS = ["GEMINI_API_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]
GH_VARS = ["FINN_MODEL_CHEAP", "FINN_MODEL_STRONG", "FINN_EMBED_MODEL"]

what = sys.argv[1:] or ["web", "gh", "vercel"]

if "web" in what:
    p = ROOT / "web" / ".env.local"
    keep = [l for l in (p.read_text(encoding="utf-8").splitlines() if p.exists() else []) if not any(l.startswith(k + "=") for k in WEB)]
    p.write_text("\n".join(keep + [f"{k}={env[k]}" for k in WEB if k in env]) + "\n", encoding="utf-8")
    print("web/.env.local:", sum(k in env for k in WEB), "vars")

if "gh" in what:
    for k in GH_SECRETS:
        r = subprocess.run([GH, "secret", "set", k, "-R", REPO], input=env[k], text=True, capture_output=True)
        print("gh secret", k, "ok" if r.returncode == 0 else r.stderr[:120])
    for k in GH_VARS:
        r = subprocess.run([GH, "variable", "set", k, "-R", REPO, "--body", env[k]], text=True, capture_output=True)
        print("gh var", k, "ok" if r.returncode == 0 else r.stderr[:120])

if "vercel" in what:
    for k in WEB:
        if k not in env:
            continue
        for target in ("production", "preview"):
            subprocess.run(["vercel", "env", "rm", k, target, "--yes"], cwd=ROOT / "web", capture_output=True, text=True, shell=True)
            r = subprocess.run(["vercel", "env", "add", k, target], cwd=ROOT / "web", input=env[k], text=True, capture_output=True, shell=True)
            print("vercel", k, target, "ok" if r.returncode == 0 else (r.stderr or r.stdout)[-160:].replace("\n", " "))
