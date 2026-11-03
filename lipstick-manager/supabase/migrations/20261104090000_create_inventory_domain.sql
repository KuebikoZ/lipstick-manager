create extension if not exists pgcrypto;

do $$ begin
  create type public.color_family as enum ('nude', 'rose', 'orange', 'red', 'plum', 'brown');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.inventory_lifecycle as enum ('unopened', 'opened', 'unknown', 'discarded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.opening_precision as enum ('exact', 'unknown');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.expiry_source as enum ('explicit', 'calculated');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.draft_kind as enum ('new', 'edit');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.image_status as enum ('temp', 'attached');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.image_mime_type as enum ('image/jpeg', 'image/png', 'image/webp');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ai_task_status as enum (
    'queued', 'recognizing', 'needs_confirmation', 'researching',
    'partial', 'complete', 'failed', 'cancelled', 'timed_out'
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.evidence_kind as enum ('image', 'official', 'authorized_store', 'user');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.cleanup_status as enum ('pending', 'processing', 'complete', 'failed');
exception when duplicate_object then null; end $$;

create table public.lipstick_items (
  id uuid primary key default gen_random_uuid(),
  revision integer not null default 1 check (revision >= 1),
  display_name varchar(100) not null check (char_length(btrim(display_name)) between 1 and 100),
  brand varchar(100),
  series varchar(100),
  shade_code varchar(100),
  color_family public.color_family,
  color_description varchar(200),
  texture varchar(200),
  lifecycle public.inventory_lifecycle not null default 'unknown',
  opened_on date,
  opening_precision public.opening_precision not null default 'unknown',
  pao_months smallint check (pao_months between 1 and 120),
  manufactured_on date,
  shelf_life_months smallint check (shelf_life_months between 1 and 240),
  expires_on date,
  expiry_source public.expiry_source,
  note varchar(500),
  cover_image_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opened_on_precision_check check (opened_on is null or opening_precision = 'exact'),
  constraint expiry_source_check check (
    (expires_on is null and expiry_source is null) or
    (expires_on is not null and expiry_source is not null)
  )
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  kind public.draft_kind not null,
  item_id uuid references public.lipstick_items(id) on delete cascade,
  base_revision integer check (base_revision >= 1),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  suggestion_version integer not null default 0 check (suggestion_version >= 0),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  constraint draft_kind_item_check check (
    (kind = 'new' and item_id is null and base_revision is null) or
    (kind = 'edit' and item_id is not null and base_revision is not null)
  )
);

create unique index drafts_single_new_idx on public.drafts (kind) where kind = 'new';
create unique index drafts_single_edit_per_item_idx on public.drafts (item_id) where kind = 'edit';

create table public.lipstick_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.lipstick_items(id) on delete cascade,
  draft_id uuid references public.drafts(id) on delete cascade,
  storage_path text not null unique check (storage_path !~ '(^|/)\.\.(/|$)' and storage_path !~ '^/'),
  mime_type public.image_mime_type not null,
  byte_size integer not null check (byte_size between 1 and 10485760),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  sha256 char(64) not null check (sha256 ~ '^[0-9a-f]{64}$'),
  position smallint not null check (position between 0 and 2),
  status public.image_status not null default 'temp',
  created_at timestamptz not null default now(),
  constraint image_parent_check check ((item_id is null) <> (draft_id is null)),
  constraint image_status_parent_check check (
    (status = 'temp' and draft_id is not null) or
    (status = 'attached' and item_id is not null)
  )
);

create unique index lipstick_images_item_position_idx
  on public.lipstick_images (item_id, position) where item_id is not null;
create unique index lipstick_images_draft_position_idx
  on public.lipstick_images (draft_id, position) where draft_id is not null;

create or replace function public.validate_cover_image_parent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cover_image_id is not null and not exists (
    select 1 from public.lipstick_images image
    where image.id = new.cover_image_id
      and image.item_id = new.id
      and image.status = 'attached'
  ) then
    raise exception 'cover image must be attached to the same item'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

alter table public.lipstick_items
  add constraint lipstick_items_cover_image_fk
  foreign key (cover_image_id) references public.lipstick_images(id) on delete set null;

create constraint trigger validate_lipstick_cover_image
after insert or update of cover_image_id on public.lipstick_items
deferrable initially deferred
for each row execute function public.validate_cover_image_parent();

create table public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.drafts(id) on delete set null,
  item_id uuid references public.lipstick_items(id) on delete cascade,
  status public.ai_task_status not null default 'queued',
  workflow_version text not null,
  schema_version text not null,
  provider text not null,
  model text not null,
  input_image_ids uuid[] not null default '{}',
  result jsonb,
  error_code text,
  duration_ms integer check (duration_ms >= 0),
  usage_json jsonb,
  estimated_cost_cny numeric(10,4) check (estimated_cost_cny >= 0 and estimated_cost_cny <= 2),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_task_cancelled_check check (
    (status = 'cancelled' and cancelled_at is not null) or status <> 'cancelled'
  ),
  constraint ai_task_images_check check (cardinality(input_image_ids) between 1 and 3),
  constraint ai_task_parent_check check (draft_id is not null or item_id is not null)
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  ai_task_id uuid not null references public.ai_tasks(id) on delete cascade,
  field_name text not null check (char_length(btrim(field_name)) between 1 and 100),
  kind public.evidence_kind not null,
  url text,
  image_id uuid references public.lipstick_images(id) on delete cascade,
  excerpt varchar(500),
  retrieved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint evidence_source_check check (
    (kind = 'image' and image_id is not null and url is null) or
    (kind in ('official', 'authorized_store') and url is not null and retrieved_at is not null and image_id is null) or
    (kind = 'user' and url is null)
  )
);

create table public.item_idempotency_keys (
  fixed_principal text not null default 'fixed_admin' check (fixed_principal = 'fixed_admin'),
  idempotency_key uuid not null,
  request_hash char(64) not null check (request_hash ~ '^[0-9a-f]{64}$'),
  item_id uuid not null references public.lipstick_items(id) on delete cascade,
  response_status smallint not null default 201 check (response_status = 201),
  created_at timestamptz not null default now(),
  primary key (fixed_principal, idempotency_key)
);

create table public.storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  status public.cleanup_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lipstick_items_current_idx on public.lipstick_items (lifecycle, created_at desc);
create index lipstick_items_expiry_idx on public.lipstick_items (expires_on) where lifecycle <> 'discarded';
create index lipstick_images_temp_cleanup_idx on public.lipstick_images (created_at) where status = 'temp';
create index drafts_expiry_idx on public.drafts (expires_at);
create index ai_tasks_draft_idx on public.ai_tasks (draft_id, created_at desc);
create index ai_tasks_item_idx on public.ai_tasks (item_id) where item_id is not null;
create index evidence_task_idx on public.evidence (ai_task_id);
create index storage_cleanup_pending_idx on public.storage_cleanup_jobs (created_at) where status in ('pending', 'failed');

alter table public.lipstick_items enable row level security;
alter table public.drafts enable row level security;
alter table public.lipstick_images enable row level security;
alter table public.ai_tasks enable row level security;
alter table public.evidence enable row level security;
alter table public.item_idempotency_keys enable row level security;
alter table public.storage_cleanup_jobs enable row level security;

revoke all on table public.lipstick_items, public.drafts, public.lipstick_images,
  public.ai_tasks, public.evidence, public.item_idempotency_keys,
  public.storage_cleanup_jobs from anon, authenticated;
grant select, insert, update, delete on table public.lipstick_items, public.drafts,
  public.lipstick_images, public.ai_tasks, public.evidence, public.item_idempotency_keys,
  public.storage_cleanup_jobs to service_role;
revoke all on function public.validate_cover_image_parent() from public, anon, authenticated;
grant execute on function public.validate_cover_image_parent() to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lipstick-images',
  'lipstick-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Intentionally create no anon/authenticated storage.objects policy. All object
-- operations run server-side with SUPABASE_SECRET_KEY after Auth.js validation.
