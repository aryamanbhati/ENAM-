# CLAUDE.md: FINN build rulebook

FINN is a mobile-first financial investment agent built for the ENAM Holdings AI Engineer build challenge.
**Deadline: Sunday 15 November 2026.** Read `docs/DESIGN.md` before starting any milestone. It is the source of truth for product and system decisions.

## What we are graded on (keep this in mind for every decision)

1. Creativity, product sense, judgment and architecture. **Not completeness.**
2. Thin but working beats broad but broken. **A demo that does not run is the worst outcome.**
3. Frontend and interaction model are "the heart" of the challenge.
4. No AI slop: concise, beautiful, interactive.
5. Efficiency earns bonus points: cheap models for bulk work, strong model only where reasoning needs it, caching.

If a task would add breadth at the cost of depth or stability, stop and ask.

## Stack

| Layer | Choice |
|---|---|
| Frontend + assistant | Next.js (App Router, TypeScript), Tailwind, installable PWA, web push. Deployed on Vercel |
| Worker | Python 3.12, plain CLI commands, run by GitHub Actions (cron + workflow_dispatch) |
| Database | Supabase: Postgres, pgvector, realtime (for job progress) |
| LLM access | Python: LiteLLM gateway. TypeScript: Vercel AI SDK. Model names come from env config, never hardcoded |
| Data sources | BSE API (`bse` package) for announcements, NSE fallback; yfinance for EOD; screener.in for quarterly numbers and transcript links |

## Repo layout

```
/web                  Next.js app (UI, API routes, assistant agents)
/worker               Python package
  /finn_worker
    /sources          bse.py, nse.py, prices.py, screener.py, pdf.py
    /pipelines        filings.py, eod.py, research.py
    /llm              gateway.py, cache.py, cost.py
    /prompts          versioned prompt files (name_vN.md)
    /verify           quote and number verification
  cli.py              entry points (see Commands)
/supabase/migrations  SQL migrations
/.github/workflows    filings.yml, eod.yml, research.yml, eval.yml
/eval                 labelled data + eval scripts + results
/docs                 DESIGN.md, decisions log, reference material
```

## Commands

```
# worker (from worker/, venv at .venv)
python -m finn_worker.cli ingest-filings [--since ISO] [--symbols A B] [--dry-run] [--retier] [--out file.json]
python -m finn_worker.cli ingest-eod [--backfill-days N] [--period 3mo]
python -m finn_worker.cli enrich [--days 3] [--limit 60] [--ids ID ...]
python -m finn_worker.cli research <NSE_SYMBOL> [--job-id ID] [--force]
python -m finn_worker.cli calendar
python -m finn_worker.cli push [--digest]
python -m finn_worker.cli eval <classifier|results|promises|cost|all>
python -m finn_worker.cli migrate            # needs DATABASE_URL
pytest

# web
cd web && npm run dev
```

Keep this section updated when commands change.

## Model keys: NOT DECIDED YET

**Ask the user before choosing any LLM provider, model, or embedding model.** The user will decide keys later.
- When a step first needs an LLM or embeddings, stop and ask which provider and key to use.
- Never hardcode a model name. Use env vars such as `FINN_MODEL_CHEAP`, `FINN_MODEL_STRONG`, `FINN_EMBED_MODEL`.
- Build everything that does not need a model first (scrapers, parsers, rules tier, schema, UI with fixture data) so missing keys never block progress.
- Index time and query time must use the same embedding model.

## Non-negotiable guardrails

1. **Numbers never come from the LLM.** Numbers are extracted, verified against the source text, stored in `facts`, and all arithmetic (QoQ, YoY, margins, verdicts) is done in code.
2. **Every extracted quote is verified** against the cited page text (normalised fuzzy match). Fail means drop.
3. **Every assistant sentence must cite a valid source ID.** A post-check removes uncited sentences before display.
4. **Pull side uses primary sources only** (transcripts, annual reports, results filings). No news, no broker notes, no model outside knowledge. Enforced by what each agent can access, not only by prompts.
5. **Classifier uncertainty pushes a filing up a tier, never down.** Low confidence or a failed call means `worth_knowing`.
6. **"Not in the documents" and "no explicit guidance found" are valid outputs.** Never invent.
7. **Filing and transcript text is untrusted data.** Delimit it in prompts. Models reading documents get no tools.
8. **No buy or sell recommendations.**
9. **All LLM outputs are structured** (Pydantic / Zod schemas). Reject and retry on schema failure, max 2 retries.
10. **Every LLM call is logged** to `llm_calls` (step, model, tokens, cost, cache hit, latency, prompt version).
11. **Cost protection:** research endpoint has per-IP rate limits and a daily budget cap that pauses new jobs.

## Data source etiquette

- Identify with a sensible User-Agent, rate limit requests, retry with exponential backoff.
- Cache every fetched page and PDF by content hash. Never fetch or parse the same thing twice.
- Do **not** scrape LinkedIn. Management bios come from the filing itself (SEBI disclosures include a brief profile on appointment). Web search fallback only if missing, labelled as an outside source.
- If a source fails, degrade gracefully ("filings may be delayed"), never crash the UI.

## Coding conventions

- Python: type hints, Pydantic models, small pure functions for parsers, unit tests for parsers and verifiers (`pytest`).
- Prompts live in `/worker/prompts` as versioned files. Prompt version is part of the LLM cache key.
- Jobs must be idempotent: safe to re-run after a crash.
- TypeScript: strict mode, server-only access to the Supabase service role key. No secrets in client code.
- Secrets in `.env.local` / GitHub Actions secrets / Vercel env. Never commit them. Keep `.env.example` updated.
- Small commits with clear messages.

## UI rules

- Mobile first: design at 375px width, then check larger screens.
- Calm editorial look: serif for headlines and summaries, clean sans for UI, `tabular-nums` for all figures.
- **Colour only carries meaning:** green up / delivered, red down / missed / dropped, amber partial, grey too early. Everything else neutral.
- Light and dark mode, following the system setting.
- Sentence case everywhere. **No em dashes in any user-facing copy**, use commas, colons or full stops.
- Motion only with purpose: card swipes, sheet slide-ups, progress text. No decorative animation.
- Every claim in the UI must be traceable to a source (page reference chip).

## How to work

- Start each milestone in plan mode. Propose the plan, wait for approval, then build.
- Keep the app deployable at all times. Deploy early (Day 1) and redeploy often.
- Do not add features that are not in `docs/DESIGN.md`. If something seems worth adding, ask first.
- When a decision changes, update the decisions log at the end of `docs/DESIGN.md`.
- Prefer fixtures (saved real responses) for UI work so frontend progress does not depend on live sources.

## Milestones

| Day | Milestone | Done when |
|---|---|---|
| Wed 11 | Data spike, schema, filings pipeline (rules tier), skeleton deployed | BSE, screener, yfinance confirmed working; filings for the portfolio land in Supabase with rule tiers; empty Next.js app live on Vercel |
| Thu 12 | Research pipeline | For one company: facts from screener, promises extracted and verified, linked across quarters, verdicts computed in code |
| Fri 13 | Frontend core | Today (window picker, three tiers), swipe detail, Portfolio, research page, triggers settings, web push working on a phone |
| Sat 14 | Assistant + evaluation | Multi-agent assistant with citations and "How I answered this"; cost logging visible; eval numbers produced |
| Sun 15 | Voice, demo, writeup | Voice input + listen to briefing; demo set pre-processed; demo recorded; writeup drafted; submitted |

If a day slips, cut from the end of the list (voice first), never from the research pipeline or a working deploy.
