drop index if exists public.lipstick_images_item_position_idx;
drop index if exists public.lipstick_images_draft_position_idx;

alter table public.lipstick_images
  add constraint lipstick_images_item_position_unique
  unique (item_id, position) deferrable initially deferred;

alter table public.lipstick_images
  add constraint lipstick_images_draft_position_unique
  unique (draft_id, position) deferrable initially deferred;

create or replace function public.save_lipstick_draft(
  p_draft_id uuid,
  p_payload jsonb
)
returns public.drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_draft public.drafts%rowtype;
  requested_image_ids uuid[] := array(
    select jsonb_array_elements_text(coalesce(p_payload->'image_ids', '[]'::jsonb))::uuid
  );
begin
  if cardinality(requested_image_ids) <> (
    select count(*) from public.lipstick_images
    where draft_id = p_draft_id and status = 'temp' and width is not null
  ) or cardinality(requested_image_ids) <> (
    select count(*) from public.lipstick_images
    where draft_id = p_draft_id and status = 'temp' and width is not null
      and id = any(requested_image_ids)
  ) then
    raise exception 'IMAGE_VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  set constraints lipstick_images_draft_position_unique deferred;
  update public.lipstick_images as image
  set position = requested.position
  from (
    select id, (ordinality - 1)::smallint as position
    from unnest(requested_image_ids) with ordinality as ordered(id, ordinality)
  ) as requested
  where image.id = requested.id and image.draft_id = p_draft_id;

  update public.drafts
  set payload = p_payload,
      updated_at = now(),
      expires_at = now() + interval '90 days'
  where id = p_draft_id and kind = 'new'
  returning * into saved_draft;
  return saved_draft;
end;
$$;

create or replace function public.update_lipstick_item(
  p_item_id uuid,
  p_revision integer,
  p_item jsonb
)
returns public.lipstick_items
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_item public.lipstick_items%rowtype;
  requested_image_ids uuid[] := array(
    select jsonb_array_elements_text(coalesce(p_item->'image_ids', '[]'::jsonb))::uuid
  );
begin
  if cardinality(requested_image_ids) <> (
    select count(*) from public.lipstick_images
    where item_id = p_item_id and status = 'attached'
  ) or cardinality(requested_image_ids) <> (
    select count(*) from public.lipstick_images
    where item_id = p_item_id and status = 'attached' and id = any(requested_image_ids)
  ) then
    raise exception 'IMAGE_VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  set constraints lipstick_images_item_position_unique deferred;
  update public.lipstick_images as image
  set position = requested.position
  from (
    select id, (ordinality - 1)::smallint as position
    from unnest(requested_image_ids) with ordinality as ordered(id, ordinality)
  ) as requested
  where image.id = requested.id and image.item_id = p_item_id;

  update public.lipstick_items
  set display_name = p_item->>'display_name',
      brand = nullif(p_item->>'brand', ''),
      series = nullif(p_item->>'series', ''),
      shade_code = nullif(p_item->>'shade_code', ''),
      color_family = nullif(p_item->>'color_family', '')::public.color_family,
      color_description = nullif(p_item->>'color_description', ''),
      texture = nullif(p_item->>'texture', ''),
      lifecycle = (p_item->>'lifecycle')::public.inventory_lifecycle,
      opened_on = nullif(p_item->>'opened_on', '')::date,
      opening_precision = (p_item->>'opening_precision')::public.opening_precision,
      pao_months = nullif(p_item->>'pao_months', '')::smallint,
      manufactured_on = nullif(p_item->>'manufactured_on', '')::date,
      shelf_life_months = nullif(p_item->>'shelf_life_months', '')::smallint,
      expires_on = nullif(p_item->>'expires_on', '')::date,
      expiry_source = nullif(p_item->>'expiry_source', '')::public.expiry_source,
      note = nullif(p_item->>'note', ''),
      cover_image_id = requested_image_ids[1],
      revision = revision + 1,
      updated_at = now()
  where id = p_item_id and revision = p_revision and lifecycle <> 'discarded'
  returning * into updated_item;
  return updated_item;
end;
$$;

revoke all on function public.save_lipstick_draft(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_lipstick_draft(uuid, jsonb) to service_role;
revoke all on function public.update_lipstick_item(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.update_lipstick_item(uuid, integer, jsonb) to service_role;
