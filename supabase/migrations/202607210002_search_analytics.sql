alter table public.storefront_events
  add column if not exists search_query text,
  add column if not exists search_result_count integer;

alter table public.storefront_events
  drop constraint if exists storefront_events_event_type_check;

alter table public.storefront_events
  add constraint storefront_events_event_type_check
  check (event_type in ('page_view', 'product_view', 'add_to_cart', 'checkout_started', 'purchase', 'search'));
