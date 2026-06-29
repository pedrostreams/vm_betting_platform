-- Log of daily-summary emails. Lets the admin UI answer "is today's mail sent?".
-- Written + read only by the service role (cron + admin server actions).

create table if not exists summary_sends (
  id            uuid primary key default gen_random_uuid(),
  sent_at       timestamptz not null default now(),
  recipients    integer not null default 0,
  matches       integer not null default 0,
  subject       text,
  reference_id  text,
  test          boolean not null default false
);

create index if not exists summary_sends_sent_at_idx on summary_sends (sent_at desc);

-- RLS on, no client policies by design — only the service role touches this table.
alter table summary_sends enable row level security;
