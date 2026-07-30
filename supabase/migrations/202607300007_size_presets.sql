-- Allow a 'size' kind in content_presets so the admin can manage the size
-- dropdown options (like categories / material presets), and seed the defaults.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.content_presets'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%material%'
  loop
    execute format('alter table public.content_presets drop constraint %I', c);
  end loop;
end $$;

alter table public.content_presets
  add constraint content_presets_kind_check check (kind in ('material', 'care', 'size'));

insert into public.content_presets (kind, value, position) values
  ('size', '80', 0),
  ('size', '90', 1),
  ('size', '100', 2),
  ('size', '110', 3),
  ('size', '120', 4),
  ('size', '130', 5),
  ('size', '140', 6)
on conflict (kind, value) do nothing;
