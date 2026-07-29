create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_expected_status public.order_status,
  p_next_status public.order_status,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status public.order_status;
  transition_allowed boolean;
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  select status into current_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;
  if current_status <> p_expected_status then
    raise exception 'order_status_changed';
  end if;

  transition_allowed := case current_status
    when 'pending_payment' then p_next_status in ('paid', 'cancelled')
    when 'paid' then p_next_status in ('preparing', 'cancelled')
    when 'preparing' then p_next_status in ('shipped', 'cancelled')
    when 'shipped' then p_next_status = 'collected'
    else false
  end;
  if not transition_allowed then
    raise exception 'invalid_order_status_transition';
  end if;

  update public.orders
  set status = p_next_status,
    updated_at = p_updated_at
  where id = p_order_id;
end;
$$;

create or replace function public.admin_update_store_settings(
  p_shipping_fee integer,
  p_free_shipping_threshold integer,
  p_contact_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;
  if p_shipping_fee < 0
    or (p_free_shipping_threshold is not null and p_free_shipping_threshold < 0)
    or p_contact_email is null
    or btrim(p_contact_email) = '' then
    raise exception 'invalid_store_settings';
  end if;

  insert into public.store_settings (key, value)
  values
    ('shipping_fee', jsonb_build_object('amount', p_shipping_fee)),
    ('free_shipping_threshold', jsonb_build_object('amount', p_free_shipping_threshold)),
    ('contact_email', jsonb_build_object('email', lower(btrim(p_contact_email))))
  on conflict (key) do update
  set value = excluded.value;
end;
$$;

revoke all on function public.admin_update_order_status(uuid, public.order_status, public.order_status, timestamptz) from public, anon;
revoke all on function public.admin_update_store_settings(integer, integer, text) from public, anon;
grant execute on function public.admin_update_order_status(uuid, public.order_status, public.order_status, timestamptz) to authenticated;
grant execute on function public.admin_update_store_settings(integer, integer, text) to authenticated;
