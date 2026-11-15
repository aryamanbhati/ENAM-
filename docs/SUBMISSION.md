# FINN — submission package

Everything needed to submit to ENAM, in one place.

## Send the email

- **To:** assessment@enam.com
- **Subject:** `IIT Delhi – AI Engineer - 2027`

### Email body (copy-paste, then personalise the greeting/sign-off)

---

Hi,

Please find my submission for the AI Engineer build challenge below.

**FINN — a mobile-first financial investment agent.** It filters an investor's portfolio news down to the few things that actually need them, and on demand it analyses what a company's management promised against what they delivered.

- **Live app (try on a phone, add to home screen):** https://enam-six.vercel.app
- **Repository:** https://github.com/aryamanbhati/ENAM-
- **AI build history:** Claude Code engineering sessions + the claude.ai product-design chat — [share/export links here]

**What I built**

- **Push — the Today feed.** Every filing and market move across a 15-company portfolio, tiered into *Needs you / Worth knowing / Routine* for a window I pick (24h, 7d default, 30d, custom). Routine is collapsed, not deleted. "Needs you" is driven only by my own configurable alerts (announcement types, a price-move %, a volume multiple) and is the only thing that notifies me. Results filings show Revenue/EBITDA/PBT/PAT QoQ and YoY; management changes pull the incoming person's bio from the filing itself; price/volume moves are matched to the filing that explains them.
- **Pull — promised vs delivered.** For any NSE ticker, FINN reads the last ~6 concall transcripts and quarterly results and tracks every explicit commitment quarter by quarter, with quotes and page references. It computes the verdict in code and flags *quietly dropped* guidance — a target stated once and never mentioned again. Alongside it, a code-only numbers panel: 8-quarter revenue, net-profit and operating-margin trajectory, and director turnover.
- **Assistant.** A floating agent on every screen, scoped to what's on screen. A router picks ≤3 narrow specialists, a composer writes only from their outputs, and a verifier deletes any sentence without a valid source. "How I answered this" shows the agents, sources, tokens and cost.

**Key decisions & trade-offs**

- **The model never produces a number.** Every figure is extracted from a document, verified against the cited page, and all arithmetic (QoQ/YoY/margins/verdicts) is done in code. Quotes that don't match their page are dropped before anyone sees them.
- **Fail upward.** Uncertain classifications are shown, never hidden — the one error the product can't afford is burying something material.
- **Depth over breadth.** One pull analysis done rigorously beats eight shallow sections.
- **Right tool per step, cheaply.** Rules before models; a cheap model for bulk extraction; a stronger model only for judgement; Groq for the interactive assistant because the product has to feel instant; caching everywhere. Ingestion runs on free tiers.
- **No servers.** Next.js on Vercel, Python workers on GitHub Actions, Supabase for Postgres + pgvector + live progress.

**What I left out:** bull/bear, balance-sheet and cash-quality sections; news and broker notes (pull side is primary sources only); auth/multi-user; a native app (installable PWA instead).

**Where I'd take it next:** read annual reports as well as transcripts so capex/debt/segment promises can be measured; guidance-aware results alerts ("beat the revenue guide by 3 points") the moment results land; per-user portfolios tuned from what I open and ignore.

Full write-up and architecture are in the repo (`docs/WRITEUP.md`, `docs/DESIGN.md`).

Thanks for reviewing,
[Your name]

---

## Pre-send checklist

- [ ] **Make the repo public** — it is currently private (`aryamanbhati/ENAM-`). ENAM must be able to open it.
- [ ] **Confirm the live app loads on a phone** — https://enam-six.vercel.app (Today, Portfolio, Research, Ask, a research run).
- [ ] **Export the AI build history** — this Claude Code session ("Enam Build challenge project session") + the claude.ai design chat. Paste share links into the email where marked.
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
