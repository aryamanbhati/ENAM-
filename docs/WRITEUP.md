# FINN — covering note

**Live:** https://enam-six.vercel.app (on a phone: add to home screen so notifications work)
**Repo:** https://github.com/aryamanbhati/ENAM-
**Build history:** Claude Code engineering sessions + the claude.ai product-design chat

---

## The one idea

The brief says the scarce skill is not aggregating information, it is filtering it. I pushed on that: for an investment firm, the scarce skill is **filtering you can trust**. A feed that is 95% right is worse than no feed, because the first time it buries something that mattered, the investor stops believing it and goes back to reading filings by hand. Trust, not coverage, is the product.

So FINN is not a prettier news reader. It is built around one question the investor asks every morning, *does anything actually need me,* and almost all of the engineering went into making every claim on the screen provable from a primary document. The product you see is the filtering. The architecture underneath is the proof.

## What it does

**Push, the Today feed.** Every corporate filing and end-of-day move across a 19-company portfolio, sorted into **Needs you / Worth knowing / Routine** for a window you choose (24h, 7d by default, 30d, or a custom range). Routine collapses to a single expandable line; nothing is ever deleted. "Needs you" is driven only by *your* configurable triggers (announcement categories, a price-move %, a volume multiple over the 20-day average) and is the only thing permitted to send a notification. Tapping any item opens a full-screen card you swipe through, tier by tier, ending on an honest "You're caught up."

Two enrichments the brief called out, and the rest by judgment:
- **Quarterly results** arrive with Revenue, EBITDA, PBT and PAT, QoQ and YoY, read straight from the SEBI results filing (which carries all three columns in one document).
- **Management changes** arrive with the incoming person's bio, pulled from the appointment filing itself, which SEBI requires to contain one. No LinkedIn.
- **Price and volume spikes** arrive already joined to the filing in the surrounding 48 hours that explains them, or labelled "no filing explains this move," which is itself a signal.

One triage detail I am proud of: the hero count is the *last-24h* urgent number even on a 30-day window, so widening the window to catch up never turns the promise into a 104-item wall of alarm. Older items read as a calm "+N earlier this month."

**Pull, promised vs delivered.** For **any** NSE ticker where the data exists, not just my demo set, FINN reads the last six concall transcripts and the quarterly results and answers the question the brief said it values most: what did management promise, and did they deliver? Every explicit commitment becomes a card with a quarter-by-quarter timeline of quotes and page references, a verdict computed in code, and the signal I think is genuinely differentiated, **quietly dropped**: a target stated once and then never mentioned again. That is the line between summarising management and analysing them. Example from live data: KPIT guided 30% FY27 revenue growth, is tracking 7.6% after two quarters, and stopped bringing it up. Alongside it sits a code-only numbers panel: eight-quarter revenue, net-profit and operating-margin trajectory, and director turnover.

**Assistant.** A floating agent on every screen, scoped to what is on screen. A router reads the question and context and picks at most three narrow specialists (market and filings answered in code, transcripts via hybrid search), a composer writes only from their outputs, and a verifier strips any sentence without a valid source. "How I answered this" exposes the agents, sources, tokens and cost on every answer. On the research page the agent is walled to that company's own primary documents.

## The hard problems (this is where the real work went)

The data layer is "plumbing," but the plumbing is where correctness is won or lost. A few that took real judgment:

- **BSE blocks plain HTTP clients** (Akamai returns 403 to `httpx`), and intermittently returns empty bodies even when it answers. Filings go through the `bse` package with a 1.5s throttle and backoff retries; I confirmed GitHub Actions runners are accepted, so the cron needs no other host.
- **Results are filed twice on the same day** (the "Financial Results" document, and the board-meeting outcome that encloses it). Naively that double-counts and double-alerts. `dedupe_results` keeps one: the results filing triggers, the enclosing outcome steps down to Worth knowing, deduped at the alert layer with a unique `(source_type, source_id)`.
- **EBITDA is almost never reported** in the filing. So I never ask the model for it: it is computed as PBT + finance costs + depreciation and amortisation, labelled "computed" in the UI, and PBT − tax is reconciled against PAT as a consistency check.
- **"Quietly dropped" has to be earned, not guessed.** It requires two consecutive silent calls, or one silent call while the numbers are already behind. Never when the company is on or ahead of target, and never once the deadline year is complete (that earns a real verdict instead). This is the difference between an insight and a hallucination.
- **Commitments carry a scope.** Only company-wide targets are compared against reported totals; a segment target is routed to the evidence-based qualitative judge, never silently measured against the company total. Margin targets in basis points are measured as a *change*, not a level.
- **"General" is BSE's vaguest and most common subcategory** (~20% of filings). Subject-keyword rules run first; the cheap model only handles what the rules cannot place, and it may only move a filing *down* to routine when it is confident.

## The architecture, and the judgment behind it

```
Browser (Next.js PWA) ─┬─ RSC feed render ───────────────► Supabase Postgres
                       ├─ /api/ask  (router→agents→          (service role,
                       │             composer→verifier) ───►  server-only,
                       └─ /api/research (rate+budget,         pgvector + tsv +
                                        dispatch) ──► GitHub   realtime)
                                                      REST       ▲
   GitHub Actions workers ◄──── jobs table = the queue ─────────┘
   filings (cron) · eod (cron) · research (per-ticker dispatch)
   Python CLI · rules-first · Gemini cheap/strong chain · content caches
         └──────────────► writes facts / promises / signals back
```

Three calls I would defend in a design review:

1. **No servers to babysit.** The whole backend is a Python CLI run by GitHub Actions: cron for filings and prices, per-ticker concurrency-grouped `workflow_dispatch` for research. The `jobs` table *is* the queue. That buys idempotent, serialized, retryable background work with zero hosted infrastructure and zero idle cost, which is correct at this scale. The research route is properly idempotent: already-researched opens instantly; an in-flight run attaches instead of dispatching a duplicate; per-IP and daily budget caps protect cost. I also wrote a CTO-level audit (`docs/ARCHITECTURE_AUDIT.md`) that reasons about exactly when this stops being enough and what I would move to then, because knowing the ceiling is part of the decision.

2. **Deterministic and probabilistic work are physically separated.** The model classifies, extracts and writes prose. Code does every number and every verdict. They never cross. This is the single most important structural choice in a finance product, and it is enforced by what each component is allowed to do, not by a prompt.

3. **Everything is cached by content.** Source pages and PDFs by content hash, LLM calls by `hash(model chain + prompt version + input)`, research by a hash of the transcript set. 24% of model calls are served from cache, and a research re-run on unchanged documents does literally zero work.

## The part I care about most: the guardrails

This is what separates a product an investment firm could rely on from a demo. Six rules, enforced in code:

1. **No number comes from the model.** Figures are extracted from the filing, each must appear on its cited page, EBITDA is computed, PBT − tax is reconciled against PAT, results are cross-checked against screener. All arithmetic is code.
2. **Every quote is verified against the page it cites** (normalised fuzzy match). No match, dropped before anyone sees it. For Dixon, 7 of 28 extracted quotes were dropped this way.
3. **Every assistant sentence must carry a valid source id.** A post-check deletes any that does not, so the model cannot speak without a citation.
4. **Classifier uncertainty fails *upward*, in code.** A low-confidence or failed classification lands in Worth knowing, never Routine. The one error this product cannot afford is silently burying something material, and the code (`tiering.py`, `enrich.py`) guarantees it never does, not just the prompt.
5. **The pull side is primary sources only** (transcripts and results filings), enforced by what each agent may read, not by instruction. No news, no broker notes, no model outside-knowledge.
6. **"Not in the documents" and "no explicit guidance found" are valid answers.** The scorecard counts only commitments it can actually judge; it never invents a verdict to fill a card.

## Efficiency (free-tier by design)

Rules settle most filings before any model runs. A cheap model does bulk extraction; a stronger model is reserved for judgement and prose; embeddings do retrieval; everything is cached. The ingestion and research pipelines run entirely on Gemini's free tier, so actual spend is zero. At paid list prices the whole build's 285 model calls would be ~$0.32, and a single research run ~$0.04. Every call is logged with model, tokens, latency and cost. The one place I spent latency budget rather than money is the interactive assistant, which runs on Groq: a product you reach for all day has to feel instant, and sub-second inference is the reasoning that matters there. Gemini stays as the fallback.

## Honest evaluation (data and scripts in `eval/`)

| What | Result |
|---|---|
| Filing classifier, 99 labelled filings | 90.9% rules-only, 91.9% with the model; of 8 errors, **7 were routine items shown (safe), 1 was a material item hidden** |
| Results numbers vs screener | 78.6% within 1% before the cross-check, 84% after; the rest are standalone-vs-consolidated or definition differences |
| Promise quotes verified on-page | 86.5% pass; the rest are dropped before display (6 companies) |
| Cost | $0 actual (free tier); ~$0.04 per research run; ~$0.32 list-price for the whole build; 24% cache hit rate |

I labelled the eval set myself, so these measure precision and the pipeline, not independent recall. I would rather say that plainly than quote a number I cannot stand behind. The one hidden-material error is the error class I care about most, and it is the thing I would drive to zero next.

## What I left out, deliberately

Bull vs bear, balance-sheet and cash-quality sections; news and broker notes (the pull side is primary sources only, by design); LinkedIn scraping; auth and multiple users; a native app (an installable PWA instead, so web push still works on a phone). Thin-but-working: one pull analysis done rigorously beats eight shallow ones, and the brief grades judgment, not coverage.

## Where I would take it next

- Read annual reports as well as transcripts, so capex, debt, working-capital and segment promises can be *measured* in code, not only judged by a model.
- Guidance-aware results alerts: "results beat the revenue guide by 3 points" on the push card the instant results land, fusing the push and pull sides.
- Per-user portfolios and alert tuning learned from what the investor opens and ignores.
- Drive the one hidden-material classifier error toward zero with a larger labelled set and a stronger judge on the ambiguous tail.
