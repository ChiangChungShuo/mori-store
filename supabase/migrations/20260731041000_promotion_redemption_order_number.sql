-- Dedupe redemptions by order number: the checkout service knows the order
-- number (not its uuid) when it finishes, and order numbers are unique.
alter table public.promotion_redemptions
  add column if not exists order_number text;

drop index if exists promotion_redemptions_promotion_order_key;
create unique index if not exists promotion_redemptions_promotion_order_number_key
  on public.promotion_redemptions (promotion_id, order_number)
  where order_number is not null;
