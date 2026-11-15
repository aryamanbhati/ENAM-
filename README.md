# FINN

**Financial intelligence for investors who need signal, not another feed.**

FINN is a mobile-first financial research prototype built for the ENAM AI Engineer Build Challenge. It has two complementary workflows:

- **Push:** monitors a 19-company NSE portfolio and prioritises filings and market signals as **Needs you**, **Worth knowing**, or **Routine**.
- **Pull:** researches an NSE-listed company using primary documents, tracking what management said it would do against what the reported evidence shows.

The product is built around one principle: **an AI-generated answer is only useful when the user can inspect the evidence behind it.**

## Try the app

**Live application:** https://enam-six.vercel.app

FINN is an installable PWA. For the intended mobile experience, open it on your phone, add it to your home screen, and enable notifications. Push notifications are delivered through the browser's web-push support.

**Research runtime:** a Pull run can take approximately **5–7 minutes**. It retrieves external transcripts and filings, extracts and verifies evidence, and computes the resulting analysis. Public data sources and APIs have variable response times and rate limits, so allow the run to finish.

## Product tour

### Push — a focused portfolio briefing

The Today view covers filings and end-of-day price/volume signals across the seeded portfolio. A selectable time window helps users catch up without losing the distinction between urgent and routine activity.

- **Needs you:** items matching configured announcement or market triggers. This is the only tier that can notify.
- **Worth knowing:** relevant items that do not match a personal trigger.
- **Routine:** retained, but collapsed to reduce noise.

Results filings are enriched with headline metrics and period comparisons. Management changes include profile information available in the filing. Price and volume moves are connected to nearby filings when a plausible explanation exists; otherwise, FINN says that no filing explains the move.

### Pull — management commitments, followed over time

Research can be started for NSE tickers beyond the seeded portfolio, where source material is available. FINN extracts commitments from earnings-call transcripts, verifies quotations against their cited pages, links mentions across periods, and evaluates measurable commitments in code.

A distinctive signal is **quietly dropped guidance**: a target that was stated and later goes unmentioned. The system treats silence as evidence only under explicit rules; it does not infer a dropped commitment from one missing mention.

### Assistant — answers with visible provenance

A contextual assistant is available throughout the app. It routes questions to a small set of specialised data/retrieval paths, composes an answer, and checks citations. The **How I answered this** view exposes the sources and model usage behind an answer.

## Architecture at a glance

```text
Next.js PWA on Vercel
  ├── Server-rendered feed and research views ──────┐
  ├── /api/ask: contextual assistant                │
  └── /api/research: guarded job dispatch           │
                                                    ▼
                                             Supabase Postgres
                                             data + jobs + cache
                                                    ▲
                                                    │
GitHub Actions ── Python worker ────────────────────┘
  ├── scheduled filings ingestion
  ├── end-of-day price/volume processing
  └── on-demand company research
       ├── external filings and transcript sources
       ├── rules-first processing
       ├── Gemini extraction/research calls
       └── evidence verification and code-based verdicts
```

The interactive web assistant uses Groq with Gemini fallback. The ingestion and research worker uses Gemini. Supabase is the persistence layer; GitHub Actions runs scheduled and dispatched Python jobs. The architecture is intentionally lightweight for a prototype, not presented as a high-volume production design.

## Engineering principles

1. **Numbers are computed or verified in code.** The model does not get to invent financial figures or calculate numeric verdicts.
2. **Quotes must match their cited source page.** Failed quote checks are dropped.
3. **Uncertainty is surfaced, not hidden.** Ambiguous filing classifications are kept visible at a higher-priority tier.
4. **Primary sources anchor research.** Pull-side analysis uses company filings and transcripts rather than news or broker commentary.
5. **Repeat work should be cheap.** Source, model-call, and research results are cached using content-derived keys.

## Repository map

| Path | Purpose |
|---|---|
| `web/` | Next.js application, PWA, API routes, assistant and UI |
| `worker/finn_worker/` | Python ingestion, enrichment, research and verification pipelines |
| `worker/prompts/` | Versioned prompts used by worker pipelines |
| `supabase/` | Database migrations and seeded portfolio |
| `.github/workflows/` | Scheduled ingestion and on-demand research workflows |
| `eval/` | Labelled evaluation data, scripts and results |
| `docs/` | Product design, build history, submission note and engineering audits |

## Run locally

You need Python 3.12, Node.js, npm, and a Supabase project. Copy the example environment file and provide the required credentials locally; **never commit secrets**.

### Python worker

```bash
cd worker
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

python -m pip install -e ".[dev]"
python -m pytest
python -m finn_worker.cli --help
```

A dry-run example (confirm the command's available options with `--help`):

```bash
python -m finn_worker.cli ingest-filings --dry-run --out .cache/dry.json
```

### Web application

```bash
cd web
npm install
npm run dev
```

The web app requires its local environment configuration, including the Supabase connection and the model-provider credentials used by the assistant. Worker workflows require their own environment variables and GitHub Actions secrets.

## Documentation

- [Product and system design](docs/DESIGN.md)
- [Build history and AI collaboration](docs/BUILD_HISTORY.md)
- [Technical write-up](docs/WRITEUP.md)
- [Submission email and checklist](docs/SUBMISSION.md)
- [Architecture, performance and reliability audit](docs/ARCHITECTURE_AUDIT.md)
- [UX and product design audit](docs/UX_AUDIT.md)
- [Project handoff](docs/HANDOFF.md)
- [Audit methodology — how I used AI to review the product and architecture](docs/AUDIT_METHODOLOGY.md)
- [Audit index and reusable review briefs](docs/audits/README.md)

## Evaluation and limitations

The evaluation set is hand-labelled by the builder. Its metrics are useful for understanding pipeline behaviour on those examples; they are not independent estimates of production recall. The current prototype is single-user and does not implement a full multi-tenant security model. The background worker design is appropriate for the current scale, with its operational limits documented in the architecture audit.

FINN is a research and information product, not investment advice or a recommendation to buy or sell securities.
