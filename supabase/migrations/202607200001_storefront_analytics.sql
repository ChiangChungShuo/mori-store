create table public.storefront_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  event_type text not null check (event_type in ('page_view', 'product_view', 'add_to_cart', 'checkout_started', 'purchase')),
  product_name text,
  path text not null check (left(path, 1) = '/'),
  created_at timestamptz not null default now()
);

create index storefront_events_created_at_idx on public.storefront_events (created_at desc);
create index storefront_events_session_id_idx on public.storefront_events (session_id);

alter table public.storefront_events enable row level security;

create policy "admins read storefront analytics"
on public.storefront_events for select
using (public.is_admin());

revoke all on public.storefront_events from anon, authenticated;
grant select on public.storefront_events to authenticated;
