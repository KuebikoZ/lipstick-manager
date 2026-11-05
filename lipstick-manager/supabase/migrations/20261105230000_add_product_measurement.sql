create table public.analytics_events (
  event_id uuid primary key,
  event_name text not null check (event_name in ('page_view','action','intake_start','ai_result','save_result','intake_end')),
  occurred_at timestamptz not null default now(),
  environment text not null check (environment in ('development','preview','production')),
  session_id uuid not null,
  page_id text not null check (page_id in ('inventory','compare','detail','intake_new','intake_edit')),
  intake_id uuid,
  task_id uuid,
  properties jsonb not null default '{}'::jsonb
);

create index analytics_events_environment_time_idx on public.analytics_events (environment, occurred_at);
create index analytics_events_intake_idx on public.analytics_events (intake_id) where intake_id is not null;
create index analytics_events_task_idx on public.analytics_events (task_id) where task_id is not null;
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;
grant select, insert on public.analytics_events to service_role;
