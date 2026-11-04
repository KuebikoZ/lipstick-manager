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
begin
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into existing_key
  from public.item_idempotency_keys
  where fixed_principal = 'fixed_admin'
    and idempotency_key = p_idempotency_key;

  if found then
    if existing_key.request_hash <> p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    select * into created_item from public.lipstick_items where id = existing_key.item_id;
    return created_item;
  end if;

  insert into public.lipstick_items (
    display_name, brand, series, shade_code, color_family, color_description,
    texture, lifecycle, opened_on, opening_precision, pao_months,
    manufactured_on, shelf_life_months, expires_on, expiry_source, note
  ) values (
    p_item->>'display_name', nullif(p_item->>'brand', ''), nullif(p_item->>'series', ''),
    nullif(p_item->>'shade_code', ''), nullif(p_item->>'color_family', '')::public.color_family,
    nullif(p_item->>'color_description', ''), nullif(p_item->>'texture', ''),
    (p_item->>'lifecycle')::public.inventory_lifecycle,
    nullif(p_item->>'opened_on', '')::date,
    (p_item->>'opening_precision')::public.opening_precision,
    nullif(p_item->>'pao_months', '')::smallint,
    nullif(p_item->>'manufactured_on', '')::date,
    nullif(p_item->>'shelf_life_months', '')::smallint,
    nullif(p_item->>'expires_on', '')::date,
    nullif(p_item->>'expiry_source', '')::public.expiry_source,
    nullif(p_item->>'note', '')
  ) returning * into created_item;

  insert into public.item_idempotency_keys (
    fixed_principal, idempotency_key, request_hash, item_id
  ) values ('fixed_admin', p_idempotency_key, p_request_hash, created_item.id);

  delete from public.drafts where kind = 'new';
  return created_item;
end;
$$;

revoke all on function public.create_lipstick_item(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_lipstick_item(uuid, text, jsonb) to service_role;
