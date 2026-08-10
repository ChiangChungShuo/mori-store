-- 物流追蹤碼 -------------------------------------------------------------------
-- The shipping mail could only say "已出貨", so every customer still had to ask
-- where the parcel was. The owner pastes the 7-ELEVEN 貨態查詢碼 here and it goes
-- into the mail and onto the order page.

alter table public.orders
  add column if not exists tracking_code text
    check (tracking_code is null or char_length(tracking_code) <= 60);

create or replace function public.admin_set_order_tracking_code(
  p_order_id uuid,
  p_tracking_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := nullif(btrim(coalesce(p_tracking_code, '')), '');
begin
  if not public.is_admin() then
    raise exception 'admin role required';
  end if;
  if cleaned is not null and char_length(cleaned) > 60 then
    raise exception 'tracking code too long';
  end if;

  update public.orders
  set tracking_code = cleaned
  where id = p_order_id;
end;
$$;

revoke all on function public.admin_set_order_tracking_code(uuid, text) from public, anon;
grant execute on function public.admin_set_order_tracking_code(uuid, text) to authenticated, service_role;
