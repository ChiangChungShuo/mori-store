alter table public.product_images
add column color text;

alter table public.product_images
add constraint product_images_color_not_blank
check (color is null or btrim(color) <> '');

create or replace function public.admin_insert_product_image(
  p_product_id uuid,
  p_storage_path text,
  p_alt_text text,
  p_color text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  image_id uuid;
  next_position integer;
  normalized_color text := nullif(btrim(p_color), '');
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;
  if btrim(p_storage_path) = '' or btrim(p_alt_text) = '' then
    raise exception 'image_data_required';
  end if;
  if normalized_color is not null and not exists (
    select 1
    from public.product_variants
    where product_id = p_product_id
      and is_active
      and color = normalized_color
  ) then
    raise exception 'product_image_color_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 0));

  select coalesce(max(position), -1) + 1 into next_position
  from public.product_images
  where product_id = p_product_id;

  insert into public.product_images (product_id, storage_path, alt_text, position, color)
  values (p_product_id, p_storage_path, btrim(p_alt_text), next_position, normalized_color)
  returning id into image_id;

  return image_id;
end;
$$;

create or replace function public.admin_set_product_image_color(
  p_product_id uuid,
  p_image_id uuid,
  p_color text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_color text := nullif(btrim(p_color), '');
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;
  if normalized_color is not null and not exists (
    select 1
    from public.product_variants
    where product_id = p_product_id
      and is_active
      and color = normalized_color
  ) then
    raise exception 'product_image_color_invalid';
  end if;

  update public.product_images
  set color = normalized_color,
      updated_at = clock_timestamp()
  where id = p_image_id
    and product_id = p_product_id;

  if not found then
    raise exception 'image_not_found';
  end if;
end;
$$;

revoke all on function public.admin_insert_product_image(uuid, text, text, text) from public, anon;
revoke all on function public.admin_set_product_image_color(uuid, uuid, text) from public, anon;
grant execute on function public.admin_insert_product_image(uuid, text, text, text) to authenticated;
grant execute on function public.admin_set_product_image_color(uuid, uuid, text) to authenticated;
