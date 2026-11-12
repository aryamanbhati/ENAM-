# FINN

A mobile-first financial investment agent. It filters an investor's portfolio news down to what needs them, and analyses what management promised against what it delivered.

**Live:** https://enam-six.vercel.app (on a phone, add it to the home screen so notifications work).

Built for the ENAM Holdings AI Engineer build challenge. Product and system design: [docs/DESIGN.md](docs/DESIGN.md). Build rules: [CLAUDE.md](CLAUDE.md).

## Layout

- `web/` Next.js PWA (UI, API routes, assistant)
- `worker/` Python worker (filings, EOD prices, research), run by GitHub Actions
- `supabase/` schema migrations and seed
- `docs/` design, brief, reference

## Run locally

```bash
cp .env.example .env.local     # fill in Supabase keys
cd worker && py -m venv .venv && .venv/Scripts/python -m pip install -e ".[dev]"
.venv/Scripts/python -m pytest
.venv/Scripts/python -m finn_worker.cli ingest-filings --dry-run --out .cache/dry.json
cd ../web && npm install && npm run dev
```
