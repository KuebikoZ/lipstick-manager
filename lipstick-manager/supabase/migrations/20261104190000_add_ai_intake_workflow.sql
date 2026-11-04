alter table public.lipstick_images
  alter column width drop not null,
  alter column height drop not null,
  alter column sha256 drop not null;

alter table public.lipstick_images
  add constraint lipstick_images_metadata_check check (
    (width is null and height is null and sha256 is null and status = 'temp') or
    (width > 0 and height > 0 and sha256 ~ '^[0-9a-f]{64}$')
  );

create or replace function public.create_lipstick_item(
  p_idempotency_key uuid,
  p_request_hash text,
  p_item jsonb
)
returns public.lipstick_items
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_key public.item_idempotency_keys%rowtype;
  created_item public.lipstick_items%rowtype;
  current_draft_id uuid;
  requested_image_ids uuid[] := array(
    select jsonb_array_elements_text(coalesce(p_item->'image_ids', '[]'::jsonb))::uuid
  );
  accepted_task_id uuid := nullif(p_item->>'accepted_ai_task_id', '')::uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into existing_key from public.item_idempotency_keys
  where fixed_principal = 'fixed_admin' and idempotency_key = p_idempotency_key;
  if found then
    if existing_key.request_hash <> p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    select * into created_item from public.lipstick_items where id = existing_key.item_id;
    return created_item;
  end if;

  select id into current_draft_id from public.drafts where kind = 'new';
  if cardinality(requested_image_ids) > 0 and (
    current_draft_id is null or
    (select count(*) from public.lipstick_images
      where id = any(requested_image_ids) and draft_id = current_draft_id
        and status = 'temp' and width is not null) <> cardinality(requested_image_ids)
  ) then
    raise exception 'IMAGE_VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if accepted_task_id is not null and not exists (
    select 1 from public.ai_tasks where id = accepted_task_id
      and draft_id = current_draft_id and status in ('partial', 'complete')
  ) then
    raise exception 'AI_TASK_INVALID' using errcode = 'P0001';
  end if;

  insert into public.lipstick_items (
    display_name, brand, series, shade_code, color_family, color_description,
    texture, lifecycle, opened_on, opening_precision, pao_months,
    manufactured_on, shelf_life_months, expires_on, expiry_source, note
  ) values (
    p_item->>'display_name', nullif(p_item->>'brand', ''), nullif(p_item->>'series', ''),
    nullif(p_item->>'shade_code', ''), nullif(p_item->>'color_family', '')::public.color_family,
    nullif(p_item->>'color_description', ''), nullif(p_item->>'texture', ''),
    (p_item->>'lifecycle')::public.inventory_lifecycle, nullif(p_item->>'opened_on', '')::date,
    (p_item->>'opening_precision')::public.opening_precision, nullif(p_item->>'pao_months', '')::smallint,
    nullif(p_item->>'manufactured_on', '')::date, nullif(p_item->>'shelf_life_months', '')::smallint,
    nullif(p_item->>'expires_on', '')::date, nullif(p_item->>'expiry_source', '')::public.expiry_source,
    nullif(p_item->>'note', '')
  ) returning * into created_item;

  update public.lipstick_images set item_id = created_item.id, draft_id = null, status = 'attached'
  where id = any(requested_image_ids) and draft_id = current_draft_id;
  if cardinality(requested_image_ids) > 0 then
    update public.lipstick_items set cover_image_id = requested_image_ids[1]
    where id = created_item.id returning * into created_item;
  end if;
  if accepted_task_id is not null then
    update public.ai_tasks set item_id = created_item.id, updated_at = now()
    where id = accepted_task_id;
  end if;

  insert into public.item_idempotency_keys (fixed_principal, idempotency_key, request_hash, item_id)
  values ('fixed_admin', p_idempotency_key, p_request_hash, created_item.id);
  delete from public.ai_tasks where draft_id = current_draft_id and id is distinct from accepted_task_id;
  delete from public.drafts where id = current_draft_id;
  return created_item;
end;
$$;

revoke all on function public.create_lipstick_item(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_lipstick_item(uuid, text, jsonb) to service_role;
