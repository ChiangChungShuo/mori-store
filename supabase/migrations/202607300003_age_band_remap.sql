-- Remap existing products from the old four age bands to the new three, then
-- constrain products to the new set. Old enum values remain defined on the
-- type (Postgres can't drop enum values) but are no longer used.
--   0-2  -> 0-3 (Baby)
--   3-5  -> 3-6 (Kids)
--   6-9  -> 6-12 (Junior)
--   10-12 -> 6-12 (Junior)
update public.products p
set age_bands = (
  select array_agg(distinct (case ob::text
    when '0-2' then '0-3'
    when '3-5' then '3-6'
    when '6-9' then '6-12'
    when '10-12' then '6-12'
    else ob::text
  end)::public.age_band)
  from unnest(p.age_bands) as ob
)
where exists (
  select 1 from unnest(p.age_bands) as ob
  where ob::text in ('0-2', '3-5', '6-9', '10-12')
);

alter table public.products drop constraint if exists products_age_bands_allowed;
alter table public.products add constraint products_age_bands_allowed
  check (age_bands <@ array['0-3', '3-6', '6-12']::public.age_band[]);
