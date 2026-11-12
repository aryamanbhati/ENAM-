# FINN: covering note (draft)

**Live:** https://enam-six.vercel.app (on a phone: add to home screen so notifications work)
**Repo:** https://github.com/aryamanbhati/ENAM-
**Build history:** Claude Code sessions (engineering) and the claude.ai design chat (product thinking)

## What I built

FINN answers one question first: does anything need me? Everything else is filtering.

**Push.** The Today screen tiers every filing and market move in a chosen window (24h, 7d, 30d) into *Needs you*, *Worth knowing* and *Routine*. Nothing is deleted; routine is one collapsed line. Needs you is decided only by the user's own alerts (announcement types, a price-move threshold, a volume multiple), and it is the only path to a notification. Tapping opens a full-screen card you swipe through, ending on "You're caught up".
- Results filings show Revenue, EBITDA, PBT and PAT, QoQ and YoY. The model only copies numbers; each must appear on the cited PDF page; EBITDA is computed (PBT + finance costs + D&A) and labelled as computed; PBT minus tax is checked against PAT; figures are cross-checked against screener.
- Management changes show the incoming person's profile, copied from the SEBI disclosure itself (which must include one) and verified on its page. No LinkedIn.
- Price and volume moves are joined with filings from the surrounding 48 hours: "explained by results" or "no filing explains this move".

**Pull.** For any NSE ticker, FINN reads the last six concall transcripts and the quarterly results and answers: what did management promise, and did they deliver? Each commitment becomes a card with a quarter-by-quarter timeline of quotes and page references. Numeric verdicts are computed in code; a model only judges qualitative promises, and only with passages it can cite. The signature insight is *quietly dropped*: guidance that was stated and then never mentioned again. Example from the live data: KPIT guided 30% revenue growth for FY27, is tracking 7.6% after two quarters, and stopped mentioning it.

**Assistant.** An ask bar on every screen opens a sheet that knows the screen and card. A router picks at most three narrow specialists (market data and filings in code; transcripts via hybrid search), a composer writes from their outputs only, and a verifier deletes any sentence without a valid source or whose numbers are not in its sources. "How I answered this" shows agents, sources, tokens and cost. On the research page the assistant can only reach that company's primary documents.

**Habit.** A morning digest notification, silence during market hours except your alerts, an evening run for EOD moves, voice input and "listen to my briefing". No streaks or badges.

## Key decisions and trade-offs

- **Depth over breadth.** One pull feature (promised vs delivered) done properly instead of eight shallow sections.
- **The model never produces a number.** Numbers come from documents and are verified on the page; all arithmetic is code. Quotes that do not match their page are dropped (7 of 28 for Dixon).
- **Fail upward.** Uncertain classifications are shown, never hidden. On 99 labelled filings, 7 of 8 errors were routine items shown, 1 was a material item hidden.
- **Efficiency.** Cheap model for bulk extraction, strong model only for judgement and prose, embeddings for retrieval, caching by prompt version and input, rules before models (most filings never touch a model). Built entirely on Gemini's free tier: actual spend is zero. List-price cost is logged per call.
- **No servers.** Next.js on Vercel; Python workers on GitHub Actions (cron for filings and prices, on-demand dispatch for research); Supabase for Postgres, pgvector and live progress.
- **Honest outputs.** "No explicit guidance found" and "Not in the documents" are valid answers. The scorecard counts only promises that can be judged.

## Evaluation (numbers in `eval/results`)

| What | Result |
|---|---|
| Filing classifier, 99 labelled filings | Rules alone 90.9%, rules plus model 91.9%; errors 7 upward, 1 downward |
| Results numbers vs screener | 78.6% within 1% before the screener cross-check, 84% after; the rest are standalone vs consolidated or definition differences |
| Promise quotes verified on their page | 86.5% pass; the rest are dropped before anyone sees them (6 companies) |
| Cost | $0 actual (free tier); about $0.04 per research run and $0.32 for the whole build's 285 model calls at paid list prices; 24% of calls served from cache |

Labels were written by me (the developer) using the reference categories; promise recall would need independent hand labels.

## What I left out, deliberately

Bull vs bear, multi-year trajectory, balance sheet and cash quality sections; news and broker notes (the pull side is primary sources only); LinkedIn scraping; auth and multiple users; P&L, charts and transactions in Portfolio; a native app (an installable PWA instead); a custom date range in the window picker.

## Where I would take it next

- Read annual reports as well as transcripts, so capex, debt and segment promises can be measured, not only judged.
- Guidance-aware results alerts: "results beat the revenue guide by 3 points" on the push card the moment results land.
- Per-user portfolios and alert tuning from what the user opens and ignores.
- A paid strong model for the judgement step and a small labelled set for promise recall.
