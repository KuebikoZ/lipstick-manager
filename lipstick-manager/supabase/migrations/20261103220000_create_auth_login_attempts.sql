create table if not exists public.auth_login_attempts (
  key_hash text primary key check (length(key_hash) = 64),
  window_started_at timestamptz not null,
  failure_count integer not null default 0 check (failure_count >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.auth_login_attempts is
  'Hashed fixed-admin login attempt counters. Contains no plaintext IP, username, or password.';

alter table public.auth_login_attempts enable row level security;

revoke all on table public.auth_login_attempts from anon, authenticated;
grant select, insert, update, delete on table public.auth_login_attempts to service_role;

create index if not exists auth_login_attempts_updated_at_idx
  on public.auth_login_attempts (updated_at);

create or replace function public.record_auth_login_failure(
  p_key_hash text,
  p_now timestamptz
)
returns table (
  window_started_at timestamptz,
  failure_count integer,
  locked_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.auth_login_attempts as attempts (
    key_hash,
    window_started_at,
    failure_count,
    locked_until,
    updated_at
  )
  values (p_key_hash, p_now, 1, null, p_now)
  on conflict (key_hash) do update
  set
    window_started_at = case
      when p_now - attempts.window_started_at >= interval '15 minutes' then p_now
      else attempts.window_started_at
    end,
    failure_count = case
      when p_now - attempts.window_started_at >= interval '15 minutes' then 1
      else attempts.failure_count + 1
    end,
    locked_until = case
      when (
        case
          when p_now - attempts.window_started_at >= interval '15 minutes' then 1
          else attempts.failure_count + 1
        end
      ) >= 5 then p_now + interval '15 minutes'
      else null
    end,
    updated_at = p_now
  returning attempts.window_started_at, attempts.failure_count, attempts.locked_until;
end;
$$;

revoke all on function public.record_auth_login_failure(text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_auth_login_failure(text, timestamptz) to service_role;
