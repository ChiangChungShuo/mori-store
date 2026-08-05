-- 到貨通知 (restock requests) ---------------------------------------------------
-- Shoppers who reach a sold-out product are the highest-intent visitors the shop
-- gets. Before this table the "貨到通知我" button only wrote to localStorage, so
-- nobody was ever notified. Requests are written through a security-definer RPC
-- so anonymous visitors can register without any table-level insert grant.

create table if not exists public.restock_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  email text not null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint restock_requests_email_check check (position('@' in email) > 1)
);

-- One pending request per product per email; a second click is a no-op.
create unique index if not exists restock_requests_pending_key
  on public.restock_requests (product_id, lower(email))
  where notified_at is null;

create index if not exists restock_requests_pending_idx
  on public.restock_requests (product_id)
  where notified_at is null;

alter table public.restock_requests enable row level security;

-- No direct anon access: the RPC below is the only write path, and only admins
-- may read the collected addresses.
drop policy if exists "admins manage restock requests" on public.restock_requests;
create policy "admins manage restock requests"
  on public.restock_requests for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.request_restock_notice(
  p_product_id uuid,
  p_email text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null or position('@' in v_email) < 2 or length(v_email) > 200 then
    raise exception 'invalid_email';
  end if;

  -- Only published products can collect requests, so the RPC cannot be used to
  -- probe unpublished rows.
  if not exists (
    select 1 from public.products
    where id = p_product_id and is_published = true
  ) then
    raise exception 'product_not_found';
  end if;

  insert into public.restock_requests (product_id, email)
  values (p_product_id, v_email)
  on conflict do nothing;
end;
$$;

revoke all on function public.request_restock_notice(uuid, text) from public;
grant execute on function public.request_restock_notice(uuid, text) to anon, authenticated;
