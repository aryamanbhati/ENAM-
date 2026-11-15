# FINN — Systems Architecture, Performance & Reliability Audit

Prepared as founding-CTO review. Grounded in the actual source at the commit audited (`main`), not the intended design. Every claim cites a file. Where a number would require production telemetry it is marked **[needs instrumentation]** rather than invented.

Scope reviewed: `web/` (App Router, API routes, assistant), `worker/finn_worker/` (pipelines, llm gateway, sources, verify), `supabase/migrations/`, `.github/workflows/`, `docs/DESIGN.md`, `CLAUDE.md`.

---

## A. Current architecture reconstruction

```
                          ┌─────────────────────────── BROWSER (PWA) ───────────────────────────┐
                          │  Next.js App Router pages (RSC) · Ask sheet · service worker · push   │
                          └───────▲───────────────▲──────────────────▲────────────────▲──────────┘
                                  │ HTML/RSC        │ /api/ask          │ /api/research   │ Supabase Realtime
                                  │ (force-dynamic) │ (Node, 60s)       │ (dispatch)      │ (jobs row)
                   ┌──────────────┴───────┐  ┌──────┴───────┐   ┌───────┴────────┐        │
                   │ Vercel RSC render    │  │ assistant.ts │   │ research route │        │
                   │ queries.ts (service  │  │ router→agents│   │ idempotency +  │        │
                   │ role, server-only)   │  │ →composer→   │   │ rate/budget +  │        │
                   └──────────┬───────────┘  │ verifier     │   │ gh dispatch    │        │
                              │              └──────┬───────┘   └───────┬────────┘        │
                              │ SQL                 │ SQL + Gemini       │ GitHub REST     │
                   ┌──────────▼─────────────────────▼────────────────────────────────────▼──────────┐
                   │                          SUPABASE POSTGRES (service role)                         │
                   │  companies holdings prices_eod filings signals documents chunks(hnsw,gin)         │
                   │  facts promises promise_mentions alerts jobs llm_calls llm_cache qa_cache research │
                   └──────────▲───────────────────────────────▲───────────────────────────▲──────────┘
                              │ writes (service role)          │ progress writes           │
        ┌─────────────────────┴───────┐         ┌──────────────┴──────────────┐            │
        │ GitHub Actions: filings.yml  │         │ GitHub Actions: research.yml │────────────┘ (workflow_dispatch)
        │  (cron */15, concurrency grp)│         │  (per-ticker concurrency grp)│
        │ eod.yml (cron 13:00 UTC)     │         └──────────────┬──────────────┘
        └──────────────┬───────────────┘                        │
                       │ Python CLI (finn_worker)               │
        ┌──────────────▼───────────────────────────────────────▼──────────────┐
        │ sources: bse.py http.py pdf.py prices.py screener.py (source_cache)   │
        │ pipelines: filings tiering enrich eod research verdicts push calendar │
        │ llm/gateway.py (Gemini REST, fallback chain, llm_cache, throttle)     │
        │ verify/quotes.py (number_in_text, quote fuzzy-match)                  │
        └──────────────────────────────────────────────────────────────────────┘
```

**Data ownership.** Postgres is the single source of truth. The worker is the only writer of `filings/facts/promises/signals/research`; the web app writes only `jobs`, `alerts` (via research/push paths), `llm_calls/qa_cache` (assistant). Both use the **service role key** server-side; there is no RLS-enforced multi-tenant boundary (deliberate: single seeded user, `triggers.id = 1`).

**Sync vs async.** Synchronous, user-facing: RSC feed render, `/api/ask` (≤60s, `web/src/app/api/ask/route.ts`). Asynchronous, background: all ingestion and research run in GitHub Actions; the UI observes progress through Supabase Realtime on the `jobs` row (`web/src/components/RunResearch.tsx`) with a 4s polling fallback.

**Failure boundaries.** (1) BSE/screener/yfinance fetch (worker, cached, degrades to "filings may be delayed"). (2) Gemini (worker + web, fallback chain). (3) GitHub dispatch (web → job marked `failed` on non-2xx). (4) Realtime (web, polling fallback). (5) Vercel 60s function cap on `/api/ask`.

### Documentation drift found
- **Provider:** `CLAUDE.md` says "model names from env, never hardcoded" and "ask before choosing a provider." The web gateway (`web/src/lib/llm.ts`) now defaults its chain to **Groq** (`openai/gpt-oss-*`) with Gemini fallback; the worker gateway (`worker/finn_worker/llm/gateway.py`) is still **Gemini-only** (hardcoded `API` base, `x-goog-api-key`). The two halves of the system now use different providers. DESIGN.md still describes a Gemini-only system.
- **LiteLLM:** `CLAUDE.md` stack table says the Python side uses a "LiteLLM gateway." The actual worker gateway is a hand-rolled `httpx` client against the Gemini REST API, not LiteLLM. Harmless, but the doc is wrong.
- **Default window:** DESIGN implies a 24h-first Today; the app now defaults to 7d (`web/src/app/page.tsx`).

---

## B. Existing decisions register

| Decision | Where | Rationale | Still justified? |
|---|---|---|---|
| Next.js RSC + Vercel | `web/` | One deploy, server-only service-role access, cheap | Yes. |
| GitHub Actions as the worker | `.github/workflows/*` | No hosted worker to run/pay for; cron + dispatch | Yes for this scale; see §F for the ceiling. |
| Per-ticker concurrency group | `research.yml` | Serialize same-company research, no lock table needed | Yes — elegant, free. |
| DB-backed job table + in-flight attach | `api/research/route.ts` | Idempotent dispatch without a queue | Yes. |
| Supabase single Postgres for ops + analytics | all | One store, pgvector + tsvector in-db | Yes now; split read model later (§F). |
| Service-role everywhere, single user | `web/src/lib/db.ts`, `triggers.id=1` | Build-scope simplification | Yes **as scoped**, but see §7. |
| Numbers in code, never LLM | `verify/`, `verdicts.py` | Correctness guardrail | Yes — the system's best property. |
| LLM cache by (chain+promptver+input) | `gateway.py`, `llm_cache` | Cost + reproducibility | Yes. |
| doc_set_hash research cache | `research.py:194` | Skip unchanged rebuilds | Yes. |
| `force-dynamic` on feed pages | `page.tsx`, `portfolio`, `research` | Always-fresh feed | **Partially** — see I#1. |
| Groq for the assistant, Gemini fallback | `web/src/lib/llm.ts` | Latency (added this session) | Yes, but worker still Gemini — unify intentionally. |

---

## C. Top 20 engineering issues

| # | Issue | File / component | Evidence | Impact | Sev | Proposed fix |
|---|---|---|---|---|---|---|
| 1 | Assistant pipeline is **sequential** (router → agents → composer → verifier), ~14–18s wall time | `web/src/lib/assistant.ts` `answer()` | trace `ms:13833` measured live; 5 serial Gemini/Groq calls | Users assume it hung | P1 | Run router-independent agents in parallel (already `Promise.all` on agents; parallelize router+context prep); merge verifier into a deterministic pass; **stream** composer tokens |
| 2 | `/api/ask` not streaming; `maxDuration=60` | `api/ask/route.ts` | returns one JSON blob after full pipeline | No time-to-first-token; 60s cliff risk on cold strong models | P1 | Stream with the AI SDK; return partial answer + citations as they resolve |
| 3 | Feed pages `force-dynamic` re-run all SQL every nav | `page.tsx`, `portfolio/page.tsx`, `research/page.tsx` | `export const dynamic="force-dynamic"` | Repeated identical queries; slower tab switches | P1 | `unstable_cache` keyed by window + `revalidateTag('filings'|'eod')` from the worker after ingest; keep Today dynamic only for the live window |
| 4 | Today page fires **4+ sequential awaits** incl. a `limit(5000)` history scan | `page.tsx` `Today()` | `db().from('filings')…limit(5000)` for category history | Largest feed-render contributor | P1 | Precompute per-company category counts into a small table/materialized view; drop the 5000-row scan from the request path |
| 5 | Worker gateway is **Gemini-only & hardcoded**, diverged from web (Groq) | `worker/…/llm/gateway.py:111` | `base_url=API`, `x-goog-api-key` | Two providers, two behaviours; doc drift | P1 | Single provider abstraction or at least shared env chain; decide one truth |
| 6 | No **mid-pipeline checkpoint** in research; partial failure after embedding restarts from scratch on force/changed docs | `research.py:_run` | linear stages, only doc_set_hash gate | Wasted tokens/time on retry | P2 | Persist a `stage` on `jobs`; resume from last completed stage |
| 7 | Research transcript processing is **sequential** | `research.py:214` `for period,url in transcripts` | per-transcript extract serial | Longer research runs | P2 | Bounded parallelism (respect per-model throttle) across transcripts |
| 8 | `prices_eod` has no index on `date` alone; feed uses `in(company_id)…gte(date)` | `migrations/init.sql` PK `(company_id,date)` | OK via PK prefix, but 50-day×N scan every load | Minor now | P2 | Fine at 19 holdings; add `(date)` BRIN if prices grow |
| 9 | Assistant per-IP limit is **per server instance** (in-memory `Map`) | `api/ask/route.ts` `hits` | `const hits = new Map()` | Limit resets per lambda; weak protection | P2 | Move counter to Postgres (like research route already does) or Vercel KV |
| 10 | No request-level **cancellation** of stale feed fetches on fast filter switching | client nav | RSC refetch per nav | Wasted DB work | P2 | `revalidateTag` cache (issue 3) makes most switches free |
| 11 | `llm_calls` logged but **no p50/p95 rollups**; cost per step not surfaced | `gateway.py:_log`, `web llm.ts log()` | rows exist, no aggregation | Can't see the expensive step | P2 | A nightly rollup view + a `/internal/cost` RSC page |
| 12 | Service-role key is the **only** auth; any server bug exposes full write | `web/src/lib/db.ts` | `canWrite()` gate only | Blast radius if a route leaks it | P2 (scoped) | Keep for build; before multi-user, add RLS + anon read role for the feed |
| 13 | `/api/ask` has **no budget cap** (research does) | `api/ask/route.ts` | only a 20/min/IP memory limit | A loop could run cost up | P2 | Daily token/cost cap in Postgres, mirrors research `DAILY_CAP` |
| 14 | Verifier is an **LLM-adjacent** step where it could be deterministic-first | `assistant.ts` verify / `verify/quotes.py` | `verify()` strips uncited sentences (already code) — good; but composer still always runs strong | Extra strong-model call | P2 | Confirm verify is fully deterministic (it is in worker); ensure web mirrors it, skip a model round where possible |
| 15 | Realtime missed-update window relies on 4s poll fallback | `RunResearch.tsx` | poll loop every 4000ms | Up to 4s stale on dropped socket | P3 | Acceptable; lower to 2.5s during `running` |
| 16 | PDF parsing memory/time unmeasured | `sources/pdf.py` | no limits visible | Could spike Action RAM on huge filings | P3 | Cap page count / size; stream parse |
| 17 | `source_cache`/`llm_cache`/`qa_cache` have **no TTL / eviction** | migrations | `text primary key` only | Unbounded storage growth | P3 | Periodic prune job (keep N days); cheap |
| 18 | No **cache-stampede** guard on research: two users on a never-researched ticker | `api/research/route.ts` | in-flight check is a non-atomic read-then-insert | Rare double dispatch | P3 | Rely on per-ticker Action concurrency group (already dedupes the actual work) — acceptable; could add a unique partial index on `jobs(ticker) where status in (queued,running)` |
| 19 | ~~Classifier fail-upward unverified~~ **Confirmed enforced** | `tiering.py:184`, `enrich.py:157-165,132` | rules never return routine for vague filings (→ `worth_knowing`, `needs_llm`); the LLM only demotes to routine when `not material && confidence>=0.75`; the per-filing `except` leaves failures at worth_knowing | — | ✓ OK | No action — keep a regression test that injects an LLM error and asserts the tier stays `worth_knowing` |
| 20 | Financial units consistency across worker→db→web | `facts` (`unit` col), `format.ts` `num()` | `rs_cr`/`pct`/`rs` strings | A unit mismatch mis-renders a figure | P1 (correctness) | A single enum + a test asserting every `facts.unit` has a renderer |

---

## D. Latency analysis

Legend: **[M]** measured this session · **[E]** estimated from code · **[I]** needs instrumentation.

### Journey A — Open FINN (Today, 7d)
| Stage | Latency | Note |
|---|---|---|
| Vercel edge → Node RSC | **[I]** | TTFB needs RUM |
| `itemsInWindow` + `upcoming` + `marketState` + **history `limit(5000)`** | **[E]** dominant | 4 awaits, one 5000-row scan (C#4) |
| Prod page HTML | **[M]** ~1.0–1.9s HTTP 200 | `curl` this session |
| Hydrate + chart SVG | **[E]** small | SVG inline, no layout shift after loading.tsx |

### Journey B — Change time filter
Each switch is a full RSC navigation that **re-runs all feed SQL** (C#3). 24h→7d→30d refetch identical base data. Fix: tag-cache so only the live window is dynamic.

### Journey C — Open a filing
Enrichment is **pre-generated** by the worker (`pipelines/enrich.py`), stored on `filings.enrichment` (JSONB). The detail view renders stored data — **no on-demand LLM**. Good. Lazy summaries for lower tiers are generated out of band.

### Journey D — Ask the assistant
| Stage | Latency | Source |
|---|---|---|
| Router (1 model call) | **[E]** 2–4s | `assistant.ts` |
| Agents (market/filings/fundamentals) | **[E]** parallel `Promise.all` | already concurrent |
| Composer (strong) | **[E]** 2–4s | one call |
| Verifier (code) | **[E]** ms | `verify()` deterministic |
| **Total** | **[M]** ~14–18s, cost **$0.0012–0.005**, 2.9k–8.2k tokens | live traces |
Biggest win: stream + collapse router/composer (C#1,2).

### Journey E — Trigger research
`frontend → /api/research (idempotency + rate/budget, ~2–4 DB round trips) → GitHub dispatch (~0.5–1s) → Action cold start (~20–40s) → pip install → worker (2–4 min) → progress via Realtime`. Dominant cost: **Action cold start + pip install** before any work. Fix candidate: a prebuilt container image or dependency cache (already `cache: pip`).

---

## E. Data & AI reliability report

**Strong (keep):**
- Numbers never from the LLM: `verdicts.py` computes QoQ/YoY/margins in code; `verify/quotes.py` `number_in_text` requires guided numbers to appear in the cited quote.
- Quote verification: `research.py:223` drops commitments whose quote doesn't match the page.
- Source untrusted: `gateway.py` wraps document text in `<document>` and passes **no tools**.
- Dedupe at the source: `filings.py:dedupe_results` collapses a board-outcome + results into one alert; `alerts` has a unique `(source_type, source_id)`.
- Research idempotent by `doc_set_hash`; filings idempotent by exchange ID upsert.
- **Classifier fail-upward (guardrail 5): confirmed enforced in code**, not just the prompt. `tiering.py:184-192` sends vague filings to `worth_knowing` with `needs_llm=True` and never returns `needs_you` from rules; `enrich.py:157-165` only demotes to `routine` when `not s.material and s.confidence >= 0.75`; the per-filing `except (LlmError, Exception)` at `enrich.py:132` means an LLM failure leaves the filing at its (worth_knowing) rule tier. A material event is never silently buried.

**Gaps to verify/enforce:**
1. **Unit integrity (C#20):** one `facts.unit` enum with a guaranteed renderer + a test.
2. **Web verifier parity:** ensure `web` assistant `verify()` is as strict as the worker's (every sentence keeps a valid source id; numbers checked against sources).
3. **Not-measurable** is now dropped at the UI (this session) — confirmed never counted as "kept" (`keptLine` only counts delivered/partly/missed).

---

## F. Infrastructure & scalability assessment

First bottlenecks as load grows, in the order they will bite:
1. **Feed SQL on every nav** (C#3/#4) — bites first, at a handful of concurrent users. Cache it.
2. **GitHub Actions concurrency** — research is serialized per-ticker (good), but total concurrent Actions and monthly minutes are the ceiling. At ~dozens of research runs/day you're fine; at hundreds, cold-start + minutes cost dominate → move research to a container worker (Option B).
3. **Single Postgres doing ops + vector + analytics** — fine to thousands of filings; when the 5000-row history scans and HNSW queries contend with feed reads, split a **read model** (precomputed feed table) from the write store.
4. **Assistant cost** — bounded by cache + rate limit; add a daily cap (C#13).

---

## G. Recommended architecture

**Three options:**

**Option A — Optimise what exists (recommended now).** Keep Next.js/Vercel/Supabase/GitHub Actions/Gemini+Groq. Changes: tag-cached feed read model (C#3/#4), stream the assistant (C#1/#2), move the two in-memory limits to Postgres (C#9/#13), unify the provider story (C#5), checkpoint research (C#6). *Latency:* tab switches ~instant; assistant TTFT <2s; feed render minus the 5000-row scan. *Cost:* lower (fewer repeat queries/model calls). *Migration:* days, no new infra. *Adopt:* immediately.

**Option B — Production-grade evolution.** Add a **dedicated container worker** (Fly/Railway/Render) for research only, keep Actions for cron ingest; a Postgres-backed durable queue (the `jobs` table already is one — add `stage`, a worker that long-polls it); a precomputed `feed_items` read model refreshed by the worker. *Adopt when:* research volume > ~hundreds/day or cold-start latency becomes the top complaint.

**Option C — Future scale.** Partition `filings`/`prices_eod` by time; separate the vector/search workload (pgvector read replica or a dedicated index service) from operational Postgres; event-driven ingestion (webhook/queue) instead of 15-min cron; multi-tenant with RLS. *Adopt when:* multiple portfolios/users and ingestion spans the whole market, not one portfolio.

**Verdict: Option A.** The current design is correctly scoped; nothing here warrants new infrastructure yet. The GitHub-Actions-as-worker decision is genuinely good and should be kept until research volume forces Option B.

---

## H. Prioritised engineering roadmap

**P0 — correctness/reliability (do before demo)**
- C#20 unit enum + renderer test. *Test:* every `facts.unit` renders. (C#19 fail-upward is already enforced — just add the regression test.)

**P1 — high-impact performance**
- C#3/#4 tag-cached feed + kill the 5000-row scan (precompute category counts). *Validate:* tab-switch p95 drops; one SQL round trip per load.
- C#1/#2 stream the assistant, parallelize router/context. *Validate:* TTFT < 2s.
- C#5 unify provider truth. *Validate:* one chain config, docs match.

**P2 — operational maturity**
- C#9/#13 Postgres-backed rate + daily cost cap for `/api/ask`.
- C#6/#7 research checkpointing + bounded parallelism.
- C#11 cost rollup view.

**P3 — future**
- C#17 cache TTL/prune job; C#16 PDF limits; Option B worker when volume demands.

---

## I. ADRs (for the P1 changes)

**ADR-1: Tag-cached feed read path.** *Context:* feed pages are `force-dynamic`, re-running all SQL per nav. *Problem:* repeated identical queries, slow filter switches. *Alternatives:* (a) client-side caching, (b) materialized view, (c) `unstable_cache` + `revalidateTag`. *Decision:* (c) — the worker calls `revalidateTag('filings')`/`('eod')` after each ingest; pages read cache except the live 24h window. *Trade-off:* up to one ingest-interval of staleness on wide windows (acceptable; the data changes on that cadence anyway). *Migration:* wrap `holdings()`/`researchedCompanies()`/window queries; add a revalidate webhook the worker hits.

**ADR-2: Stream the assistant.** *Context:* 14–18s single-blob answer. *Problem:* no time-to-first-token; 60s cliff risk. *Alternatives:* keep blocking; stream. *Decision:* stream composer tokens via the AI SDK; resolve citations server-side first, stream prose. *Trade-off:* verifier must run on the completed text before final citations lock — stream prose, then reconcile citations in a final frame. *Migration:* `/api/ask` → streaming response; `Ask.tsx` reads the stream.

**ADR-3: One provider truth.** *Context:* web uses Groq, worker uses Gemini, docs say LiteLLM/Gemini. *Problem:* drift, two behaviours. *Decision:* document both tiers explicitly and share the env-driven chain shape; do not hardcode a base URL in the worker. *Trade-off:* minor refactor of `gateway.py` to accept provider from env. *Migration:* env + a thin provider switch mirroring `web/src/lib/llm.ts`.

---

## J. Founding-CTO verdict

1. **Is the architecture right for the requirements?** Yes. For a single-portfolio intelligence product with background ingestion and an on-demand assistant, Next.js+Supabase+Actions is correctly scoped and cheap. Nothing is obviously over- or under-built for the stated goal.
2. **Three best decisions.** (a) Numbers-in-code / quote verification — the trust backbone. (b) GitHub Actions as the worker with per-ticker concurrency groups and a DB job table — a free, idempotent queue. (c) Content-hash + doc-set-hash + llm_cache caching — real cost control.
3. **Three weakest.** (a) `force-dynamic` feed with a 5000-row history scan on the request path. (b) Blocking, sequential assistant. (c) Provider drift (web Groq vs worker Gemini vs docs) and two in-memory limiters.
4. **Biggest latency bottleneck.** The assistant's serial 5-stage pipeline (measured ~14–18s), then the uncached feed SQL.
5. **Biggest reliability risk.** The feed read path, not correctness: an uncached `force-dynamic` feed with a 5000-row scan is what degrades first under load. (The one failure that would break the product promise — silently burying a material event — is already guarded: fail-upward is enforced in code.)
6. **Biggest financial-integrity risk.** Unit/basis mismatch (consolidated vs standalone, `rs_cr` vs `rs`) rendering a wrong figure — mitigate with a unit enum + test.
7. **Over-engineered anywhere?** No. If anything it's pragmatically under-built in the right places (single user, no queue infra). Don't add Redis or microservices.
8. **Optimise immediately.** Tag-cache the feed + drop the 5000-row scan; stream the assistant.
9. **Leave alone.** GitHub Actions worker model, the job table, the caching layers, the verification/guardrail code. These are good.
10. **Three days to improve FINN.** Day 1: confirm classifier fail-upward + unit test (P0 correctness); stream the assistant. Day 2: tag-cached feed read model + remove the history scan. Day 3: Postgres-backed ask rate/cost cap, unify the provider story, add a cost rollup view. No new infrastructure.

---

*Operating rules honoured: no files, migrations, secrets or production config changed by this audit; no load tests run against production; no measurements invented (all marked [M]/[E]/[I]).*
