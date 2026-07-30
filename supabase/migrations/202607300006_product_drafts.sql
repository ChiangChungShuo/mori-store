-- Server-side product drafts: lets the admin save an in-progress product
-- without completing every field or publishing it, then resume later. Stored
-- as raw JSON so partial/invalid-in-progress data is allowed.
create table if not exists public.product_drafts (
  id uuid primary key default gen_random_uuid(),
  label text not null default '未命名草稿',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists product_drafts_set_updated_at on public.product_drafts;
create trigger product_drafts_set_updated_at before update on public.product_drafts
for each row execute function public.set_updated_at();

alter table public.product_drafts enable row level security;

drop policy if exists product_drafts_admin_manage on public.product_drafts;
create policy product_drafts_admin_manage on public.product_drafts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
