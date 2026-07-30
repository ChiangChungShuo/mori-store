-- Reusable material / care-instruction presets the admin can manage and
-- quick-add when creating a product (same idea as product categories).
create table if not exists public.content_presets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('material', 'care')),
  value text not null check (btrim(value) <> '' and char_length(value) <= 200),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

insert into public.content_presets (kind, value, position) values
  ('material', '100% 純棉', 0),
  ('material', '有機棉', 1),
  ('material', '棉 95% / 彈性纖維 5%', 2),
  ('material', '天絲 TENCEL', 3),
  ('care', '冷水手洗或機洗，請勿漂白', 0),
  ('care', '低溫烘乾或平放晾乾', 1),
  ('care', '翻面洗滌，避免陽光直曬', 2),
  ('care', '深淺色分開洗滌', 3)
on conflict (kind, value) do nothing;

alter table public.content_presets enable row level security;

drop policy if exists content_presets_public_read on public.content_presets;
create policy content_presets_public_read on public.content_presets
  for select using (true);

drop policy if exists content_presets_admin_manage on public.content_presets;
create policy content_presets_admin_manage on public.content_presets
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
