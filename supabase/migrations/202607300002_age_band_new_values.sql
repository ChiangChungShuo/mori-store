-- Introduce the three new storefront age groups (Baby 0-3, Kids 3-6,
-- Junior 6-12). Enum values must be added in their own transaction before any
-- later migration can reference them, so the remap lives in a separate file.
alter type public.age_band add value if not exists '0-3';
alter type public.age_band add value if not exists '3-6';
alter type public.age_band add value if not exists '6-12';
