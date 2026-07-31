create or replace function public.admin_reorder_product_images(
  p_product_id uuid,
  p_image_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_count integer;
  existing_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  requested_count := coalesce(array_length(p_image_ids, 1), 0);
  if requested_count = 0
    or (select count(distinct image_id) from unnest(p_image_ids) requested(image_id)) <> requested_count
  then
    raise exception 'image_order_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 0));

  select count(*) into existing_count
  from public.product_images
  where product_id = p_product_id;

  if existing_count <> requested_count
    or exists (
      select 1
      from unnest(p_image_ids) requested(image_id)
      left join public.product_images image
        on image.id = requested.image_id
        and image.product_id = p_product_id
      where image.id is null
    )
  then
    raise exception 'image_order_invalid';
  end if;

  update public.product_images
  set position = position + 1000000
  where product_id = p_product_id;

  update public.product_images
  set
    position = array_position(p_image_ids, id) - 1,
    updated_at = clock_timestamp()
  where product_id = p_product_id;
end;
$$;

revoke all on function public.admin_reorder_product_images(uuid, uuid[]) from public, anon;
grant execute on function public.admin_reorder_product_images(uuid, uuid[]) to authenticated;
