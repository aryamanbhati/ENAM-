# FINN: product and system design

FINN is a mobile-first financial investment agent for ENAM Holdings' AI Engineer build challenge (deadline 15 November 2026).

## 1. The problem, in one line

Investors drown in prices, filings, announcements and results, and most of it does not matter. The scarce skill is **filtering**: surfacing the few things that matter and burying the rest, beautifully. FINN should become part of an investor's daily workflow.

## 2. Principles

1. **Filter, don't aggregate.** Every screen answers "does anything need me?" before showing anything else.
2. **Verdict first, evidence one tap away.** Lead with the conclusion, always link to the source.
3. **The LLM never produces a number and never makes a claim it cannot point to.**
4. **Respect attention.** Few interruptions, short finished sessions, no gamification.
5. **Depth over breadth.** One hero analysis done properly beats eight shallow ones.

## 3. What already exists (and how we differ)

- **Trendlyne** sends alerts for all corporate filings on a watchlist: aggregation, the problem itself.
- **Tijori (inside Zerodha Console)** filters announcements for significance and adds AI results summaries to a chronological portfolio timeline.

So filtered announcements and AI results summaries are table stakes. FINN differs by:
- triaging into tiers with explainable reasons instead of a chronological feed,
- fusing price/volume moves with filings ("no filing explains this move"),
- checking results against what management promised, including guidance that was quietly dropped,
- an honest "you're caught up" end state.

## 4. Portfolio and demo companies

- **Portfolio:** 15 to 20 NSE/BSE companies, mixed sectors and sizes, with weights. *To be chosen.* Prefer a mix that guarantees demo moments: recent results, a management change, an M&A or fund raise filing, a volatile smallcap for volume alerts.
- **Research demo set:** 3 to 5 companies (can be outside the portfolio) that hold regular concalls and give explicit guidance. *To be chosen.*
- **Generalisation:** research must work on any NSE ticker where screener has data and transcripts.

## 5. Product

### 5.1 Push: the Today screen (windowed digest)

- **Summary line** at the top: "2 things need you. 31 routine filings hidden."
- **Window picker:** 24h (default), 7d, 30d, custom. Changing it re-filters the same tiers and counts.
- **Three tiers**, covering every filing in the window (nothing deleted, routine only collapsed):

| Tier | What lands there | Shown as |
|---|---|---|
| Needs you | Matched a user trigger (announcement category or market threshold) | Full card with enrichment |
| Worth knowing | Material but not on the user's trigger list | One-line summary |
| Routine | Everything else (trading window, newspaper ads, share certificate issues) | One collapsed line, expandable, filing link only |

- **Upcoming strip:** "Reliance reports Thursday."
- User preferences reorder items, they never hide them (turning off an M&A trigger moves M&A filings to Worth knowing).

### 5.2 Triggers (alerts)

Settings behind the bell icon.
- **Announcement triggers:** category toggles (results, M&A, management change, fund raise, etc.). Sensible defaults on.
- **Market triggers:** volume above N× its 20-day average (default 2), price move beyond ±X% in a day (default 5). Both editable.
- Matching a trigger puts the item in Needs you **and sends one web push notification**. This is the only path to a notification.

### 5.3 Tier classification

1. **Rules first** from BSE's category and subject fields (and the reference taxonomy when available).
2. **Cheap LLM only for vague categories** ("Updates", "General", "Others"). Input: title, subject, first page of the PDF. Output (structured): `tier` in {worth_knowing, routine}, one-line summary, short reason, confidence.
3. Low confidence or failure means **worth_knowing** (fail upward).
4. Classified once, cached by filing ID. The reason is visible in the UI ("why this is here").

### 5.4 Detail view and swipe stack

Tapping any item opens a full-screen detail view:
1. Header: company, category, time, tier badge, why this is here.
2. Enrichment: results table, incoming person's bio, or price/volume context.
3. Summary: 3 to 5 key points, each with a page reference chip.
4. What it means for you: one line (position size, rarity of the event).
5. Original filing PDF button.
6. Next steps: one-tap questions leading into pull research.

Depth by tier: Needs you is pre-generated (opens instantly). Worth knowing and Routine summaries are generated on first tap, then cached.

**Swipe left/right** moves through items in the same tier. After the last card: **"You're caught up"** with what's coming next.

### 5.5 Enrichment for the two examples in the brief

**Quarterly results.** The standard SEBI results filing has three columns: current quarter, previous quarter, same quarter last year. So one filing gives Revenue, EBITDA, PBT and PAT with QoQ and YoY.
- Every number must appear in the PDF text.
- Consistency check: PBT minus tax should roughly equal PAT.
- EBITDA is usually not reported, so compute **EBITDA = PBT + finance costs + depreciation and amortisation** and show the formula in the UI.
- Consolidated by default, clearly labelled. Cross-check against screener once it updates.
- One extra line linking to pull: "Guided 15% growth, tracking 9%."

**Management change.** SEBI disclosures for an appointment include a brief profile of the person. Extract the bio from the filing (primary, free, reliable). Only if missing, fall back to a web search, labelled as an outside source. No LinkedIn scraping.

**Market moves.** Price/volume alerts are joined with filings from the last 48 hours: "explained by results" or "no filing explains this move".

### 5.6 Pull: the company research page

Scope from the brief's menu:

| Menu item | Depth |
|---|---|
| Guidance + Narrative vs numbers (as Promised vs Delivered) | **Deep, the hero** |
| Business snapshot | Lean |
| Financial snapshot | Lean, computed with code |
| Trajectory, balance sheet, cash quality, bull vs bear | Cut, named in the writeup |

Page layout, top to bottom:
1. **Header + snapshot:** one sentence on what the company does, four headline numbers, and a line "From N concall transcripts and N results filings".
2. **Scorecard:** "Kept 2 of 5 promises" with a split bar (delivered, partly, missed, quietly dropped, too early).
3. **Promise cards,** sorted by importance (missed and dropped first). Each expands into a quarter-by-quarter timeline with quotes and page references.
4. **Suggested questions** generated from findings ("Why did margins fall?") and the ask bar.

Promise statuses per quarter: stated, reiterated, raised, lowered, silent. **Silent after being stated means quietly dropped**, the signature insight.

Verdicts: delivered, partly delivered, missed, too early, not measurable. Code decides numeric verdicts; the strong model only judges qualitative ones.

Edge cases: no concalls or no guidance means "No explicit guidance found in the last N transcripts". A new ticker shows live progress ("Reading Q2 FY27 transcript...") and is cached afterwards.

Optional if time allows: actual vs guided chart for numeric promises; a "How we read this" method note.

### 5.7 The assistant (everywhere, context-aware, multi-agent)

- Opens as a half-height sheet from the ask bar on every screen. Knows the current screen and card ("why?" is understood in context).
- Short answers with source chips; can point back into the page ("see the revenue promise card").
- Session memory for follow-ups.
- Knowledge scope follows the screen: research page means that company's primary documents only; filing detail means that filing; Today and Portfolio mean portfolio filings and price data.

Agents:

| Agent | Job | Can only access | Model |
|---|---|---|---|
| Router | Read question + screen context, pick specialists | Question, context | Cheap |
| Market | Price, volume, moves vs averages | EOD prices, signals | None (code) |
| Filings | Announcements in a window | Filings | Cheap |
| Fundamentals | Guidance, transcripts, annual reports | Primary documents, facts, promises | Cheap (search) |
| Composer | Write the answer from specialist outputs | Specialist outputs only | Strong |
| Verifier | Check every citation and number | Answer + sources | Mostly code |

Rules: specialists never talk to each other, at most 3 per question, called in parallel, hard step limit.

**"How I answered this":** expandable line under each answer showing agents used, sources, and cost.

Build order: Router + Fundamentals + Verifier + Composer on the research page first; Market and Filings agents for Today next.

### 5.8 Daily habit

| Moment | What FINN gives |
|---|---|
| Before the open (8:30 to 9:15 IST) | Overnight digest notification, swipe stack, "You're caught up" |
| Market hours | Silence except triggered alerts |
| Evening | Day wrap: unusual moves, late filings, what's coming tomorrow |

Plus: user picks the digest notification time, results-day mode, upcoming strip. No streaks, badges or gamification.

### 5.9 Look and navigation

- **Calm editorial:** serif headlines and summaries, clean sans UI, tabular numerals for all figures.
- **Colour only carries meaning** (green, red, amber, grey for verdicts and direction).
- Light and dark mode.
- **Bottom nav:** Today, Portfolio, Research. Ask bar above the nav on every screen. Triggers behind the bell.
- **Portfolio tab:** holdings sorted by what's happening (alerts first, then biggest movers), day move plus a dot if the holding has items in Needs you or Worth knowing. Tap opens a **company hub**: recent filings on top, research page below. No charts, P&L or transaction history.
- **Installable PWA** so web push works on phones (including iPhone once added to the home screen). Onboarding prompts "add to home screen".

### 5.10 Voice (final-day extra)

Using the browser's built-in speech APIs (no model cost):
- Speak into the ask bar.
- "Listen to my briefing": FINN reads the morning summary aloud.

### 5.11 Deliberate cuts (for the writeup)

Bull vs bear, trajectory, balance sheet and cash quality sections; multi-source news; LinkedIn scraping; auth and multi-user; holdings P&L and charts; native app (PWA instead).

## 6. System design

### 6.1 Where each piece runs

| Piece | Runs on | Why |
|---|---|---|
| UI + assistant | Next.js on Vercel | No cold starts, streaming answers |
| Scheduled jobs | GitHub Actions cron | Free, no server, built-in logs |
| Research jobs | GitHub Actions workflow_dispatch | No server to host or wake up, plenty of memory for PDF parsing, free for public repos |
| Data, vectors, live progress | Supabase | Postgres + pgvector + realtime |
| Models | LiteLLM (Python), Vercel AI SDK (TS) | Model routing is a config change |

The worker is plain Python CLI commands, so it can move to a hosted service (e.g. Render) later without code changes.

Research dispatch flow: Vercel API route checks rate limit and daily budget, creates a `jobs` row, calls the GitHub REST API to dispatch `research.yml` with `ticker` and `job_id` (fine-grained token with Actions write, stored in Vercel env). The worker writes progress to `jobs`; the UI subscribes via Supabase realtime.

Cron schedule (GitHub cron is UTC and can run a few minutes late):
- Filings poll: every 15 min on weekdays, 03:30 to 10:30 UTC (9:00 to 16:00 IST).
- Morning catch-up: 02:30 UTC (8:00 IST).
- EOD prices and day wrap: 13:00 UTC (18:30 IST).

No auth: a single seeded user. All writes go through server routes or the worker using the service role key, never from the client.

### 6.2 Pipelines

**A. Filings**
1. Fetch new BSE announcements for portfolio companies (NSE fallback). Map NSE symbols to BSE codes once from BSE's scrip list.
2. Upsert by exchange filing ID. Rules tier.
3. Cheap LLM tier for vague categories (fail upward).
4. If a trigger matches: enrich, create an alert (deduplicated), send web push (`pywebpush`, VAPID keys).

**B. End of day**
1. yfinance closes and volumes.
2. Compute day move and volume vs 20-day average in code. Over-threshold signals become alerts.
3. Join signals with filings from the last 48 hours.
4. Build the evening wrap.

**C. Research**
1. Fetch screener page: quarterly numbers into `facts` with code. Collect last 4 to 5 transcript links.
2. Extract transcript text page by page (PyMuPDF / pdfplumber).
3. Cheap model extracts promises per transcript: topic, metric, target, timeframe, quote, page.
4. Verify every quote on its cited page. Drop failures.
5. Link the same promise across quarters (embedding similarity, cheap model confirms). Assign per-quarter status.
6. Convert each promise into a measurable rule. Code computes actuals and verdicts.
7. Strong model writes card text and suggested questions, citing only fact and quote IDs. Suggested questions answered and cached.
8. Progress written to `jobs` throughout.

**D. Assistant:** router, specialists in parallel, composer, verifier.

### 6.3 Data model

| Table | Key fields |
|---|---|
| `companies` | id, nse_symbol, bse_code, isin, name, sector |
| `holdings` | company_id, weight |
| `prices_eod` | company_id, date, open, high, low, close, volume |
| `signals` | company_id, date, type (price_move, volume_spike), value, threshold, explained_by_filing_id |
| `filings` | id (exchange ID), company_id, filed_at, category, subject, pdf_url, content_hash, text, tier, tier_source (rule, llm), confidence, reason, summary, enrichment (json), summary_status |
| `documents` | id, company_id, type (transcript, annual_report, results), period, url, content_hash, page_count |
| `chunks` | document_id, page, text, embedding, tsvector |
| `facts` | id, company_id, period, metric, value, unit, basis (consolidated, standalone), source_document_id, page, quote, extractor, verified |
| `promises` | id, company_id, topic, metric, target, timeframe, rule (json), verdict, verdict_reason, actual_fact_ids |
| `promise_mentions` | promise_id, period, status (stated, reiterated, raised, lowered, silent), quote, document_id, page |
| `triggers` | categories (json), volume_multiple, price_pct, digest_time |
| `alerts` | id, source_type, source_id, trigger, created_at, pushed_at |
| `push_subscriptions` | endpoint, keys (json), created_at |
| `jobs` | id, type, ticker, status, progress (json), created_at, finished_at |
| `llm_calls` | step, model, prompt_version, tokens_in, tokens_out, cost, cache_hit, latency_ms, created_at |
| `llm_cache` | key (hash of model + prompt version + input), response, created_at |

The LLM writes into `facts` and `promises` only through verification. Everything shown to the user reads from these tables with citable IDs.

### 6.4 Model routing

| Step | Model tier |
|---|---|
| Tiering vague filings | Cheap |
| Filing summaries | Cheap |
| Results extraction | Cheap + code checks |
| Promise extraction | Cheap, long context |
| Linking promises across quarters | Embeddings + cheap |
| Qualitative verdicts, card text | Strong |
| Assistant router and query rewrite | Cheap |
| Assistant final answer | Strong |
| Price/volume maths, numeric verdicts | No model (code) |

**Providers and keys: not decided. Ask the user when first needed.** Configure via `FINN_MODEL_CHEAP`, `FINN_MODEL_STRONG`, `FINN_EMBED_MODEL`.

Retrieval: hybrid search (Postgres full-text + pgvector), same embedding model at index and query time.

### 6.5 Caching and cost

- Source cache: every page and PDF stored by content hash.
- LLM cache: model + prompt version + input hash.
- Research cache: keyed by the company's document set; rebuilt only when a new document appears.
- Assistant cache: suggested questions pre-answered; repeat questions per company cached.
- Lazy generation for Worth knowing and Routine summaries.
- Every call logged to `llm_calls`, so the writeup reports measured cost per research run (first run vs repeat).

### 6.6 Guardrails, end to end

1. Numbers never from the model; verified extraction, maths in code.
2. Quotes verified against the cited page or dropped.
3. Assistant sentences without a valid source are removed.
4. Agents reach only their own data (primary-sources rule enforced by access).
5. Classifier uncertainty goes up a tier.
6. "Not in the documents" and "no guidance found" are valid outputs.
7. Document text treated as untrusted data; reading models have no tools.
8. No buy or sell advice.
9. Structured outputs with schema validation and limited retries.
10. Cost protection: per-IP rate limits and a daily budget cap on research jobs.

### 6.7 Reliability

- Demo portfolio and research set pre-processed, so the demo never depends on a live scrape.
- Retries with backoff; source failures shown as "may be delayed", never a crash.
- Idempotent jobs: a crash halfway resumes cleanly.

### 6.8 Evaluation

| What | How | Reported as |
|---|---|---|
| Tier classifier | ~100 hand-labelled filings | Accuracy, and how often uncertain items were pushed up |
| Promise extraction | Hand-labelled promises for 3 companies | Precision and recall |
| Results extraction | Our numbers vs screener | Exact-match rate |

Stored in `/eval`, numbers quoted in the writeup.

## 7. Submission checklist

- Deployed PWA link (with "add to home screen" note so push works).
- Public GitHub repo.
- AI build history: Claude Code sessions (engineering) + the claude.ai design chat (product thinking).
- Writeup in the covering email: what we built, key decisions and trade-offs, deliberate cuts, where we'd take it next.
- Email to assessment@enam.com, subject "IIT Delhi – AI Engineer - 2027".

## 8. Open decisions

- Model providers and keys (ask the user when first needed).
- Portfolio: draft of 19 in `supabase/seed.sql`, awaiting user approval (see decisions log, 12 Nov).
- Research demo set of 3 to 5 companies.
- Companion reference document: added as `docs/reference.pdf`; its categories are the FINN taxonomy in the rules tier.

## 9. Decisions log

| Date | Decision |
|---|---|
| 11 Nov | Depth over breadth. Drivers: push dashboard, interaction model, design and daily habit, system design. Promised vs Delivered is the hero pull feature. |
| 11 Nov | Three tiers (Needs you, Worth knowing, Routine) form the windowed digest; triggers decide Needs you and are the only path to notifications. |
| 11 Nov | Rules plus cheap LLM for tier classification, failing upward. |
| 11 Nov | Full-screen detail view with depth by tier; swipe through a tier; "You're caught up" end state. |
| 11 Nov | Quietly dropped guidance as the signature insight. |
| 11 Nov | Assistant everywhere, context-aware, multi-agent with a router, narrow specialists, composer and verifier. |
| 11 Nov | Calm editorial look with tabular numerals; Portfolio tab kept as a company hub. |
| 11 Nov | Voice input and "listen to my briefing" as final-day extras. |
| 11 Nov | GitHub Actions for both scheduled and research jobs (no hosted worker). |
| 11 Nov | Evaluation included. |
| 11 Nov | Build in Claude Code locally; design discussion in claude.ai. |
| 12 Nov | Data spike: BSE's API blocks plain HTTP clients (Akamai 403), so filings use the `bse` package with 1.5s throttling and backoff retries (BSE intermittently returns empty bodies). PDFs via `AnnPdfOpen.aspx?Pname=`. Screener (quarterly table to Sep 2026, concall links pointing at BSE PDFs) and yfinance `.NS` both work. |
| 12 Nov | "General" is BSE's most common subcategory (about 20% of filings) and the vaguest, so subject keyword rules run first and the cheap LLM handles what is left. |
| 12 Nov | Results are often filed twice on one day (Financial Results plus the board outcome enclosing it); only the results filing triggers, the outcome drops to Worth knowing. |
| 12 Nov | Draft portfolio of 19 (weights sum to 100), picked from 30 days of live filings for demo moments: RELIANCE 10, HDFCBANK 9, ICICIBANK 7, INFY 7, BHARTIARTL 6, LT 6, BAJFINANCE 6, TITAN 5, SUNPHARMA 5, TATASTEEL 5, ASIANPAINT 4, CIPLA 4, LUPIN 4, TRENT 4, DIXON 4, PERSISTENT 4, KPITTECH 4, SUZLON 3, IDEA 3. Management changes at CIPLA, LUPIN, TRENT, KPITTECH, IDEA, ASIANPAINT; acquisitions at TITAN, TATASTEEL, KPITTECH; volatile names SUZLON, IDEA, KPITTECH. |
| 12 Nov | Worker on Python 3.12 (what is installed locally), pinned in Actions. |
