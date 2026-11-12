-- FINN initial schema. Source of truth: docs/DESIGN.md section 6.3.
-- All writes go through the worker or server routes with the service role key.
-- RLS is on everywhere with read-only policies for anon (single seeded user, no auth).

create extension if not exists vector;

-- Reference data -------------------------------------------------------------

create table companies (
  id            bigint generated always as identity primary key,
  nse_symbol    text not null unique,
  bse_code      text unique,
  isin          text,
  name          text not null,
  sector        text,
  yahoo_symbol  text,                -- e.g. RELIANCE.NS
  created_at    timestamptz not null default now()
);

create table holdings (
  company_id    bigint primary key references companies(id) on delete cascade,
  weight        numeric(6,3) not null check (weight > 0 and weight <= 100)
);

-- Market data ----------------------------------------------------------------

create table prices_eod (
  company_id    bigint not null references companies(id) on delete cascade,
  date          date not null,
  open          numeric, high numeric, low numeric, close numeric,
  volume        bigint,
  primary key (company_id, date)
);

create table filings (
  id               text primary key,              -- exchange filing ID (BSE NEWSID)
  company_id       bigint not null references companies(id) on delete cascade,
  exchange         text not null default 'BSE',
  filed_at         timestamptz not null,
  category         text,                           -- exchange category, e.g. 'Company Update'
  subcategory      text,                           -- exchange subcategory, e.g. 'Change in Management'
  subject          text,
  headline         text,
  pdf_url          text,
  content_hash     text,
  text             text,
  finn_category    text,                           -- our taxonomy (reference doc section 1)
  tier             text not null check (tier in ('needs_you','worth_knowing','routine')),
  tier_source      text not null check (tier_source in ('rule','llm','trigger')),
  confidence       numeric,
  reason           text,                           -- "why this is here", shown in the UI
  summary          text,
  enrichment       jsonb,
  summary_status   text not null default 'none' check (summary_status in ('none','pending','ready','failed')),
  raw              jsonb,                          -- original exchange row, for debugging and re-tiering
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index filings_filed_at_idx on filings (filed_at desc);
create index filings_company_idx on filings (company_id, filed_at desc);

create table signals (
  id                     bigint generated always as identity primary key,
  company_id             bigint not null references companies(id) on delete cascade,
  date                   date not null,
  type                   text not null check (type in ('price_move','volume_spike')),
  value                  numeric not null,
  threshold              numeric not null,
  explained_by_filing_id text references filings(id),
  created_at             timestamptz not null default now(),
  unique (company_id, date, type)
);

-- Research -------------------------------------------------------------------

create table documents (
  id            bigint generated always as identity primary key,
  company_id    bigint not null references companies(id) on delete cascade,
  type          text not null check (type in ('transcript','annual_report','results','presentation')),
  period        text,                              -- e.g. 'Q2 FY27'
  url           text not null,
  content_hash  text,
  page_count    int,
  created_at    timestamptz not null default now(),
  unique (company_id, url)
);

create table chunks (
  id            bigint generated always as identity primary key,
  document_id   bigint not null references documents(id) on delete cascade,
  page          int not null,
  text          text not null,
  embedding     vector,                            -- dimension fixed once the embedding model is chosen
  tsv           tsvector generated always as (to_tsvector('english', text)) stored
);
create index chunks_doc_idx on chunks (document_id, page);
create index chunks_tsv_idx on chunks using gin (tsv);

create table facts (
  id                 bigint generated always as identity primary key,
  company_id         bigint not null references companies(id) on delete cascade,
  period             text not null,
  metric             text not null,
  value              numeric not null,
  unit               text not null,
  basis              text not null default 'consolidated' check (basis in ('consolidated','standalone')),
  source_document_id bigint references documents(id),
  source_url         text,
  page               int,
  quote              text,
  extractor          text not null,               -- 'screener', 'results_pdf', ...
  verified           boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (company_id, period, metric, basis, extractor)
);

create table promises (
  id              bigint generated always as identity primary key,
  company_id      bigint not null references companies(id) on delete cascade,
  topic           text not null,
  metric          text,
  target          text,
  timeframe       text,
  rule            jsonb,
  verdict         text check (verdict in ('delivered','partly','missed','dropped','too_early','not_measurable')),
  verdict_reason  text,
  actual_fact_ids bigint[],
  card_text       text,
  importance      int,
  created_at      timestamptz not null default now()
);

create table promise_mentions (
  id           bigint generated always as identity primary key,
  promise_id   bigint not null references promises(id) on delete cascade,
  period       text not null,
  status       text not null check (status in ('stated','reiterated','raised','lowered','silent')),
  quote        text,
  document_id  bigint references documents(id),
  page         int,
  unique (promise_id, period)
);

-- Push -----------------------------------------------------------------------

create table triggers (
  id               int primary key default 1 check (id = 1),   -- single seeded user
  categories       jsonb not null,
  volume_multiple  numeric not null default 2,
  price_pct        numeric not null default 5,
  digest_time      time not null default '08:30',
  updated_at       timestamptz not null default now()
);

create table alerts (
  id           bigint generated always as identity primary key,
  source_type  text not null check (source_type in ('filing','signal')),
  source_id    text not null,
  trigger      text not null,
  created_at   timestamptz not null default now(),
  pushed_at    timestamptz,
  unique (source_type, source_id)                 -- dedupe: one alert per item
);

create table push_subscriptions (
  endpoint    text primary key,
  keys        jsonb not null,
  created_at  timestamptz not null default now()
);

-- Ops ------------------------------------------------------------------------

create table jobs (
  id           uuid primary key default gen_random_uuid(),
  type         text not null,
  ticker       text,
  status       text not null default 'queued' check (status in ('queued','running','done','failed')),
  progress     jsonb not null default '[]'::jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create table llm_calls (
  id              bigint generated always as identity primary key,
  step            text not null,
  model           text not null,
  prompt_version  text,
  tokens_in       int,
  tokens_out      int,
  cost            numeric,
  cache_hit       boolean not null default false,
  latency_ms      int,
  created_at      timestamptz not null default now()
);

create table llm_cache (
  key         text primary key,                   -- hash(model + prompt version + input)
  response    jsonb not null,
  created_at  timestamptz not null default now()
);

create table source_cache (
  url           text primary key,
  content_hash  text not null,
  fetched_at    timestamptz not null default now()
);

-- Read access for the browser (anon). No writes from the client. -------------

do $$
declare t text;
begin
  foreach t in array array['companies','holdings','prices_eod','filings','signals','documents','facts',
                           'promises','promise_mentions','triggers','alerts','jobs']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', t || '_read', t);
  end loop;
  foreach t in array array['chunks','push_subscriptions','llm_calls','llm_cache','source_cache']
  loop
    execute format('alter table %I enable row level security', t);   -- service role only
  end loop;
end $$;

alter publication supabase_realtime add table jobs;
