# FINN — submission package

Everything needed to submit to ENAM, in one place.

## Send the email

- **To:** assessment@enam.com
- **Subject:** `IIT Delhi – AI Engineer - 2027`

### Email body (copy-paste, then personalise the greeting/sign-off)

---

Hi,

My submission for the AI Engineer build challenge is below. Links first, then the thinking.

- **Live app (open on a phone, add to home screen for notifications):** https://enam-six.vercel.app
- **Repository:** https://github.com/aryamanbhati/ENAM-
- **AI build history:** `FINN-ai-build-history.zip` [Drive link] (two Claude Code sessions + an index), plus the claude.ai product-design chat [share link]

**The bet I made**

The brief says the scarce skill is not aggregating information, it is filtering it. I took that one step further: for an investment firm, the scarce skill is *filtering you can trust*. A feed that is 95% right is worse than no feed, because you stop believing any of it and go back to reading filings yourself. So I did not build a prettier news reader. I built FINN around a single question the investor asks every morning, "does anything actually need me," and I spent most of the effort making every answer on the screen provable from a primary document. The product is the filtering; the architecture is the proof.

**What it does**

*Push (it tells you).* The Today feed takes every filing and end-of-day move across a 15-company portfolio and sorts it into **Needs you / Worth knowing / Routine** for whatever window you pick (24h, 7d, 30d, custom). Routine collapses to one line, it is never deleted. "Needs you" is driven only by *your* configurable alerts (announcement types, a price-move %, a volume multiple), and it is the only thing allowed to notify you. One detail I am proud of: the hero count stays the last-24h urgent number even on a 30-day window, so widening the window never turns the triage promise into a 104-item wall. Results filings arrive with Revenue / EBITDA / PBT / PAT, QoQ and YoY. A management change arrives with the incoming person's bio pulled from the filing itself. A price spike arrives already joined to the filing that explains it, or labelled "no filing explains this move."

*Pull (you ask it).* For **any** NSE ticker, not just my demo set, FINN reads the last ~6 concall transcripts plus quarterly results and answers the question the brief said it values most: what did management promise, and did they deliver? Every explicit commitment becomes a card with a quarter-by-quarter timeline of quotes and page references, a verdict computed in code, and the signal I think is genuinely differentiated, **quietly dropped**: a target stated once and then never mentioned again. That is the difference between summarising management and analysing them. Example from live data: KPIT guided 30% FY27 revenue growth, is tracking 7.6% after two quarters, and stopped bringing it up.

*Assistant.* A floating agent on every screen, scoped to what is on screen. It is a small multi-agent loop (router → ≤3 narrow specialists → composer → verifier), and "How I answered this" exposes the agents, sources, tokens and cost on every answer. On the research page it is walled to that company's own primary documents and nothing else.

**The architecture, and why it is shaped this way**

```
Browser (Next.js PWA) ──┬─ RSC feed render ─────────────► Supabase Postgres
                        ├─ /api/ask (multi-agent) ──────► (service role, server-only)
                        └─ /api/research (dispatch) ──► GitHub REST
                                                          │
         GitHub Actions workers ◄──── jobs table = queue ┘
         filings · eod · research (Python CLI, cron + dispatch)
                 │  Gemini (cheap/strong chain) · rules-first · caches
                 └──────────────► writes facts/promises/signals back to Postgres
```

Three deliberate calls:

1. **No servers to babysit.** The entire backend runs as a Python CLI on GitHub Actions: cron for filings and prices, per-ticker concurrency-grouped `workflow_dispatch` for research. The `jobs` table *is* the queue. This gives me idempotent, serialized, retryable background work with zero hosted infrastructure and zero idle cost, which is exactly right at this scale. The repo includes a CTO-level audit (`docs/ARCHITECTURE_AUDIT.md`) that reasons about where this stops being enough and what I would change then, because knowing the ceiling matters as much as the choice.
2. **Deterministic and probabilistic work are physically separated.** The model classifies, extracts and writes prose. Code does every number and every verdict. They never cross.
3. **Everything is cached by content.** Source pages and PDFs by content hash, LLM calls by (model + prompt-version + input), research by a hash of the transcript set. 24% of model calls are served from cache; a re-run with unchanged documents does zero work.

**The part I care about most: the guardrails**

This is what separates a finance product from a demo. Six rules, enforced in code, not in a prompt:

- **No number comes from the model.** Figures are extracted from the filing, each one must appear on its cited page, EBITDA is *computed* (PBT + finance costs + D&A) and labelled as computed, PBT − tax is reconciled against PAT, and results are cross-checked against screener. All arithmetic is code.
- **Every quote is verified against the page it cites** (normalised fuzzy match). If it does not match, it is dropped before anyone sees it. For Dixon, 7 of 28 extracted quotes were dropped this way.
- **Every assistant sentence must carry a valid source id.** A post-check deletes any sentence that does not, so the model literally cannot speak without a citation.
- **Classifier uncertainty fails *upward*, in code.** A low-confidence or failed call lands a filing in "Worth knowing," never "Routine." The one error this product cannot afford is silently burying something material, so the code guarantees it never does. (I verified this holds in `tiering.py` / `enrich.py`, not just that the prompt asks for it.)
- **The pull side is primary sources only.** Transcripts and results filings, no news, no broker notes, no model outside-knowledge. This is enforced by what each agent is allowed to read, not by asking nicely.
- **"Not in the documents" and "no explicit guidance found" are valid answers.** The scorecard counts only commitments it can actually judge; it never invents a verdict to fill a card.

**Efficiency (free-tier by design)**

Rules handle most filings before any model runs. A cheap model does bulk extraction; a stronger model is reserved for judgement and prose; embeddings do retrieval. Ingestion and research run entirely on Gemini's free tier, so actual spend is zero; at paid list prices the whole build's 285 model calls would cost ~$0.32, and a research run ~$0.04. Every call is logged with model, tokens, latency and cost. The one place I spent latency budget instead of money: the interactive assistant runs on Groq, because a product you reach for all day has to feel instant, and sub-second inference is the reasoning that matters there.

**Honest evaluation** (data and scripts in `eval/`)

| What | Result |
|---|---|
| Filing classifier (99 labelled) | 90.9% rules-only, 91.9% with the model; of 8 errors, 7 were routine items shown (safe), 1 was a material item hidden |
| Results numbers vs screener | 78.6% within 1% before the cross-check, 84% after |
| Promise quotes verified on-page | 86.5% pass; the rest dropped before display |
| Cost | $0 actual; ~$0.04 per research run; 24% cache hit rate |

I labelled the eval set myself, so these measure precision and the pipeline, not independent recall. I would rather tell you that than quote a number I cannot stand behind.

**What I deliberately left out:** bull/bear, balance-sheet and cash-quality sections; auth and multi-user; a native app (installable PWA instead). Thin-but-working: one pull analysis done rigorously beats eight shallow ones.

**Where I would take it next:** read annual reports as well as transcripts so capex, debt and segment promises can be *measured* and not only judged; guidance-aware results alerts ("beat the revenue guide by 3 points") the instant results land; per-user portfolios tuned from what you open and ignore.

Fuller detail is in `docs/WRITEUP.md`, `docs/DESIGN.md` and the architecture and UX audits in `docs/`.

Thanks for reading this far, and for a genuinely fun problem.

Best,
[Your name]

---

## Pre-send checklist

- [ ] **Make the repo public** — it is currently private (`aryamanbhati/ENAM-`). ENAM must be able to open it.
- [ ] **Confirm the live app loads on a phone** — https://enam-six.vercel.app (Today, Portfolio, Research, Ask, a research run).
- [ ] **AI build history is compiled** → `C:\Users\aryam\Downloads\FINN-ai-build-history.zip` (both Claude Code sessions + an INDEX). **It is ~42 MB, over most email limits** — upload it to Google Drive / WeTransfer and paste the link in the email, or attach the two ~20 MB zips inside it separately. Add the claude.ai design-chat share link too.
- [ ] **(Optional) Record a 60–90s demo** — Today triage → open a Needs-you card → run research on a ticker → ask the assistant. Attach or link it.
- [ ] **OpenAI credits for Listen voice** — add credits so "Listen" uses the natural voice, or leave it on the browser fallback (works either way).
- [ ] **Send** to assessment@enam.com with the exact subject line above.

## What's in the repo for reviewers

- `README.md` — what it is, layout, how to run.
- `docs/WRITEUP.md` — the full covering note.
- `docs/DESIGN.md` — product + system design, decisions log.
- `docs/ARCHITECTURE_AUDIT.md` — a CTO-level architecture/reliability review.
- `docs/UX_AUDIT.md` — a design/UX audit with scores and fixes.
- `eval/` — labelled data and the evaluation numbers quoted in the write-up.
