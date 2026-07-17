insert into public.store_settings (key, value)
values
  ('shipping_fee', '{"amount": 60}'::jsonb),
  ('free_shipping_threshold', '{"amount": 1500}'::jsonb)
on conflict (key) do nothing;

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
  if p_shipping_fee is null
    or p_shipping_fee < 0
    or (p_free_shipping_threshold is not null and p_free_shipping_threshold < 0)
    or p_contact_email is null
    or char_length(btrim(p_contact_email)) > 254
    or btrim(p_contact_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
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

revoke all on function public.admin_update_store_settings(integer, integer, text) from public, anon;
grant execute on function public.admin_update_store_settings(integer, integer, text) to authenticated;
