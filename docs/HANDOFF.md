# FINN — full context handoff

A single self-contained brief so anyone (human or another AI) can continue this project with full context. Written 15 Nov 2026.

---

## 1. What FINN is

FINN is a **mobile-first financial investment agent** built for the ENAM Holdings "AI Engineer Build Challenge" (deadline 15 Nov 2026). It filters an Indian-equities investor's portfolio news down to what actually needs them (push), and on demand analyses what a company's management promised vs delivered (pull).

- **Live:** https://enam-six.vercel.app (installable PWA; best on a phone, add to home screen + enable notifications)
- **Repo:** https://github.com/aryamanbhati/ENAM- (private — must be made **public** before submission)
- **Submission email:** assessment@enam.com, subject `IIT Delhi – AI Engineer - 2027`

**Core thesis:** for an investment firm the scarce skill is *filtering you can trust*. Everything on screen must be provable from a primary document. The product is the filtering; the architecture is the proof.

---

## 2. Current status

**Done and deployed.** The app is live and working: Today feed (push), Portfolio, Research (pull, any NSE ticker), the multi-agent assistant, web push, voice. Data pipelines run on GitHub Actions. Two audits and the submission writeup are in `docs/`.

**Still to do before submitting (all on the user's side):**
1. Make the GitHub repo **public**.
2. Upload `C:\Users\aryam\Downloads\FINN-ai-build-history.zip` (~42 MB, the two Claude Code session transcripts) to Google Drive / WeTransfer and paste the link into the email (it's over email attachment limits).
3. Add the **claude.ai design-chat** share link to the email (that chat is web-only, not exportable from the CLI).
4. (Optional) add OpenAI credits if you want the premium Listen voice; otherwise it uses the browser voice.
5. Send the email — the full ready-to-send body is in `docs/SUBMISSION.md`.

---

## 3. Stack & architecture

```
Browser (Next.js 15 PWA, React 19, Tailwind v4, Geist font)
  ├─ RSC feed render ─────────────► Supabase Postgres (service role, server-only)
  ├─ /api/ask  (multi-agent: router→≤3 specialists→composer→verifier)
  └─ /api/research (rate+budget check, dispatch) ──► GitHub REST API
                                                      │
   GitHub Actions workers ◄──── jobs table = the queue ┘
   filings.yml (cron */15) · eod.yml (cron) · research.yml (per-ticker dispatch)
   Python 3.12 CLI · rules-first · Gemini cheap/strong chain · content-hash caches
        └──────► writes facts / promises / signals / filings back to Postgres
```

- **Frontend + assistant:** Next.js App Router on **Vercel**. Assistant uses the Vercel AI SDK.
- **Worker:** Python CLI on **GitHub Actions** (cron for filings/prices, `workflow_dispatch` per-ticker for research). The `jobs` table is the queue; idempotency via content hashes and in-flight checks.
- **DB:** **Supabase** Postgres + pgvector (HNSW) + tsvector full-text + Realtime (live job progress).
- **Models:** ingestion/research on **Gemini free tier**; the interactive assistant on **Groq** (`openai/gpt-oss-*`, sub-second) with Gemini fallback. Listen voice: OpenAI tts-1-hd with browser-TTS fallback.
- **Data sources:** BSE announcements (`bse` package — plain httpx gets Akamai 403), yfinance EOD, screener.in (quarterly facts + concall transcript links).

---

## 4. Repo layout

```
web/                       Next.js app
  src/app/                 routes: / (Today), /portfolio, /research, /research/[symbol],
                           /company/[symbol], /settings; api/ask, api/research, api/push,
                           api/triggers, api/tts; loading.tsx per route
  src/components/          TodayView, DetailStack, ResearchView, MetricsPanel, Ask,
                           FloatingBot, BottomNav, Masthead, Badges, Sparkline, PriceChart,
                           ListenBriefing, RunResearch, TriggerSettings, Skeletons, ErrorBoundary
  src/lib/                 queries.ts (all SQL), assistant.ts (multi-agent), llm.ts (Groq+Gemini
                           gateway), format.ts (display helpers), types.ts, db.ts
  src/app/globals.css      design tokens (palette, type scale, radius, shadow, motion, components)
worker/finn_worker/        pipelines/ (filings, eod, research, enrich, tiering, verdicts, push,
                           calendar), sources/ (bse, http, pdf, prices, screener), llm/gateway.py,
                           verify/quotes.py, cli.py
  worker/prompts/          versioned prompt files (filing_summary_v2.md, promises_v2, etc.)
supabase/migrations/       20261112000000_init.sql, 20261113000000_research.sql; seed.sql (portfolio)
.github/workflows/         filings.yml, eod.yml, research.yml
eval/                      labelled data + eval results (numbers quoted in the writeup)
docs/                      DESIGN.md (intent + decisions log), WRITEUP.md (covering note),
                           SUBMISSION.md (email + checklist), ARCHITECTURE_AUDIT.md, UX_AUDIT.md,
                           this HANDOFF.md
```

---

## 5. The design system (shipped)

- **Palette (light only):** off-white `#f7f5f2` page, white cards, ink `#101420` text/primary, muted `#4b5261`, faint `#5f6678`, line `#e5e1d8`. Reserved **coral** `#ff6b4a` for the one primary action + the hero count. Pastels: lavender `#ece4f7`, peach `#ffe4d6`. Up `#1c7c54`, down `#c8372d` (brighter `#5fd9a0` / `#ff8a6b` on the dark hero). All tokens in `web/src/app/globals.css`.
- **One typeface:** Geist (sans), `tabular-nums` for all figures. No serif. No em dashes in UI copy (house rule).
- **Dock:** ink capsule active tab + icon-only inactive; a floating coral "FINN" bot (bottom-right) is the assistant entry point (replaced the old Ask bar).
- **Colour only carries meaning.** Chips share one `.chip` anatomy. Avoid AI-slop tells (no thick side-rail borders — this was flagged and removed).

---

## 6. The guardrails (the product's backbone — do not weaken)

Enforced in code, not prompts:
1. **No number from the model.** Figures extracted from the filing, each must appear on its cited page; EBITDA computed (PBT + finance costs + D&A), labelled; PBT−tax reconciled vs PAT; cross-checked vs screener. All arithmetic in code.
2. **Every quote verified against its page** (fuzzy match); dropped if it doesn't match (`verify/quotes.py`, `research.py`).
3. **Every assistant sentence must carry a valid source id**; a post-check deletes uncited sentences (`assistant.ts` verify).
4. **Classifier fails upward in code** — low-confidence/failed → `worth_knowing`, never `routine` (`tiering.py:184`, `enrich.py:157-165`, per-filing `except` at `:132`). Verified enforced.
5. **Pull side is primary sources only** (transcripts + results), enforced by agent data access.
6. **"Not in the documents" / "no explicit guidance found" are valid outputs.** Scorecard counts only judgeable commitments; `not_measurable` is dropped from the UI entirely (`cleanScorecard` in format.ts).

---

## 7. What changed in the latest sessions (most recent first)

All on `main`, deployed. (Git history was rewritten to remove the Claude co-author trailer — Claude is not a contributor; do **not** re-add attribution to commits.)

- Portfolio hero redesigned (balanced "Today" chip + up/down/need-you stat row, brighter on-dark colours for contrast).
- Assistant: added a visible **Send** button + a "FINN is reading… this can take a few seconds" waiting message. Removed the coral dot from Needs-you cards.
- Research: promise cards ordered Delivered → Partly → Missed → Quietly dropped → Too early; landing heading broadened to "The numbers, and whether management kept their word."; dropped "not measurable" everywhere; fixed the broken growth-bar chart scale (was a flex/height bug) and added a terminal-style stat header + proper bar/line charts.
- Today default window is **7d** (was 24h); the hero count shows last-24h urgent only so a 30-day window never shows "104 need you".
- **Fixed a P0 crash:** `scrollIntoView({behavior:'smooth'})` returns a Promise in current Chrome; an expression-arrow `useEffect` returned it as the cleanup, so React called it as `destroy()` → "destroy is not a function" → white screen on asking a question. Braced the effect body (`Ask.tsx`) and wrapped the answer in an `ErrorBoundary`.
- Listen reverted to browser speechSynthesis so Stop is instant (the OpenAI path kept playing after Stop).
- Full palette/typography redesign (off-white + ink + pastels, Geist-only), floating bot, loading skeletons, naturalised filing titles.

---

## 8. Known issues / caveats

- **OpenAI TTS** has no account credits → Listen falls back to the browser voice (still works). `/api/tts` route exists but is currently unused by the client.
- **web-push build warning** ("does not contain a default export") is pre-existing and harmless; build succeeds.
- **Assistant latency ~14–18s** — it's a 5-stage multi-agent pipeline; biggest next win is streaming + parallelising (see `ARCHITECTURE_AUDIT.md`).
- **Feed pages are `force-dynamic`** (re-query per nav); tag-caching is the documented next optimisation.
- The `GROQ_API_KEY` and `OPENAI_API_KEY` are set in both `web/.env.local` and Vercel production env. Gemini/Supabase/VAPID/GitHub-dispatch secrets are in Vercel + GitHub Actions secrets. **Never commit secrets.**

---

## 9. How to run locally

```bash
# worker
cd worker && py -m venv .venv && .venv/Scripts/python -m pip install -e ".[dev]"
.venv/Scripts/python -m pytest
.venv/Scripts/python -m finn_worker.cli ingest-filings --dry-run --out .cache/dry.json
# web
cd ../web && npm install && npm run dev   # needs web/.env.local with Supabase + GROQ + OPENAI keys
```

Deploy: push to `main` → Vercel auto-deploys. Root directory is `web`. Build: `cd web && npm run build` (type-check with `./node_modules/.bin/tsc --noEmit`). On Windows, kill any stray dev server on port 3000/3001 before `next build` (they clash over `.next`).

---

## 10. Key facts / numbers (for the writeup, from `eval/`)

- Portfolio: 19 NSE companies (RELIANCE 10%, HDFCBANK 9, ICICIBANK 7, INFY 7, BHARTIARTL 6, LT 6, BAJFINANCE 6, TITAN 5, SUNPHARMA 5, TATASTEEL 5, ASIANPAINT 4, CIPLA 4, LUPIN 4, TRENT 4, DIXON 4, PERSISTENT 4, KPITTECH 4, SUZLON 3, IDEA 3).
- Research demo set: DIXON, PERSISTENT, KPITTECH, SUZLON (portfolio) + POLYCAB (outside). Works on any NSE ticker.
- Classifier 91.9% (rules+model) on 99 labelled filings; of 8 errors, 7 safe (routine shown), 1 material hidden.
- Results numbers vs screener: 84% within 1% after cross-check. Promise quotes verified on-page: 86.5% pass. Cost: $0 actual (free tier), ~$0.04/research run, 24% cache hit.
- Signature insight: "quietly dropped" guidance (stated once, then silent). Live example: KPIT guided 30% FY27 revenue growth, tracking 7.6%, stopped mentioning it.

---

## 11. Decisions log & deeper docs

- Product + system intent and the full dated decisions log: `docs/DESIGN.md` (including a "what shipped vs plan" reconciliation).
- The covering-note pitch: `docs/WRITEUP.md`. The email + pre-send checklist: `docs/SUBMISSION.md`.
- CTO-level systems/reliability review (top-20 issues, latency, scaling options): `docs/ARCHITECTURE_AUDIT.md`.
- Design/UX audit (scores, top-15, design system): `docs/UX_AUDIT.md`.
- Build rules / conventions / guardrails: `CLAUDE.md` at repo root.

That's the whole picture. Start from `docs/SUBMISSION.md` to send, or from the file map in §4 to keep building.
