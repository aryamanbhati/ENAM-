# FINN — project handoff

**Last reviewed:** 15 November 2026  
**Purpose:** Give a developer or future AI assistant enough context to understand the product, its architecture, its constraints and the safest next steps.

## 1. Project at a glance

FINN is a mobile-first financial intelligence prototype for the ENAM AI Engineer Build Challenge.

- **Push:** prioritises filings and end-of-day market signals across a seeded 19-company NSE portfolio.
- **Pull:** researches NSE-listed companies using transcripts and results information, with a focus on management commitments and subsequent delivery.
- **Assistant:** answers questions using current screen context and exposes supporting sources.

**Live application:** https://enam-six.vercel.app  
**Repository:** https://github.com/aryamanbhati/ENAM-  
**Submission recipient:** assessment@enam.com  
**Required subject:** `IIT Delhi – AI Engineer - 2027`

The product thesis is **filtering you can trust**. Keep evidence, uncertainty and user attention central to future changes.

## 2. Current product behaviour

### Push
The Today feed combines filings and end-of-day signals. It supports 24h, 7d, 30d and custom windows, with 7d as the current default. Items are grouped into Needs you, Worth knowing and Routine. Only qualifying Needs you items can trigger push notifications.

The urgent hero count remains anchored to the last 24 hours even when the user views a wider history.

### Pull
Research can be dispatched for NSE tickers beyond the demo portfolio when the required source documents are available. The workflow retrieves transcripts and results information, extracts commitments, verifies quotes against pages, links mentions across periods and evaluates measurable targets in code.

**Expected runtime:** allow approximately 5–7 minutes for a research run. External sources, PDF extraction and model providers have variable latency and rate limits. Do not convert this into a hard SLA.

### Assistant
The contextual assistant uses a routing and specialist workflow, followed by composition and source verification. The web assistant uses Groq with Gemini fallback. The Python worker uses Gemini for ingestion and research.

## 3. Architecture

```text
Next.js PWA / Vercel
  ├── server-rendered views
  ├── /api/ask
  └── /api/research
          │
          ├──────────────► Supabase Postgres
          │                  data, cache, jobs
          ▼
       GitHub REST
          │
          ▼
    GitHub Actions
      Python CLI workers
       ├── filings
       ├── EOD prices
       └── company research
          │
          └──────────────► Supabase Postgres
```

- **Web:** `web/` — Next.js App Router, PWA, API routes and assistant.
- **Worker:** `worker/finn_worker/` — Python pipelines, source adapters, LLM gateway and verification.
- **Database:** `supabase/` — migrations and seeded data.
- **Automation:** `.github/workflows/` — scheduled filings/EOD workflows and dispatched research.
- **Evaluation:** `eval/` — labelled data and scripts.
- **Documentation:** `docs/` — product design, build history, write-up, audits and this handoff.

Postgres is the system of record. The current application is single-user and uses server-side service-role access; do not expose service-role credentials to the browser or describe the current setup as multi-tenant secure.

## 4. Non-negotiable product guardrails

1. Financial arithmetic and numeric verdicts stay in code.
2. Extracted quotations must be verified against their cited source pages.
3. Assistant claims must retain valid source references.
4. Ambiguous classification must fail upward, not silently into Routine.
5. Pull-side research must remain grounded in primary company documents available to the pipeline.
6. Missing evidence is a valid result; never invent a commitment or verdict.
7. Treat retrieved documents as untrusted input. Do not allow document text to become tool instructions.
8. Do not present FINN as a buy/sell recommendation engine.

## 5. Operational notes

- Research is asynchronous. The web route dispatches work; the worker writes progress to the `jobs` table; the UI observes that state.
- GitHub Actions concurrency controls help serialize work for the same ticker.
- External source failures and rate limits are expected. Preserve retries, pacing and explicit failure states.
- Do not run destructive research jobs against a shared or production database for benchmarking. Use an isolated staging database for comparative tests.
- Never commit `.env` files, API keys, Supabase service-role keys, VAPID secrets or GitHub dispatch tokens.

## 6. Local development

### Worker

```bash
cd worker
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
python -m pip install -e ".[dev]"
python -m pytest
python -m finn_worker.cli --help
```

### Web

```bash
cd web
npm install
npm run dev
```

The web app and worker require their respective environment variables. Start from `.env.example`; do not copy production secrets into chat, logs or commits.

## 7. Known constraints

- The prototype is single-user; multi-user auth and row-level tenant isolation are not implemented.
- GitHub Actions is a pragmatic background runner, but cold starts and concurrency limits will eventually become constraints.
- Feed pages currently re-query on navigation; a read cache with correct invalidation is a future optimisation.
- Assistant responses can take several seconds; streaming and latency instrumentation are future improvements.
- Pull research commonly takes 5–7 minutes, with runtime dependent on source and provider behaviour.

See [ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md) for measured and code-inspected performance findings, and [UX_AUDIT.md](UX_AUDIT.md) for the dated mobile UX review.

## 8. Where to continue

Recommended order:

1. Read [README.md](../README.md) for setup and repository structure.
2. Read [DESIGN.md](DESIGN.md) for shipped product behaviour and system boundaries.
3. Read [WRITEUP.md](WRITEUP.md) for the product and engineering rationale.
4. Read [BUILD_HISTORY.md](BUILD_HISTORY.md) for the development process and AI collaboration.
5. Use the audits to prioritise the next round of work.

For any future change, first inspect the current implementation. Documentation and code have diverged before; update both when a design decision changes.
