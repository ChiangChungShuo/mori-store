-- Retire the "滿件折" promotion type -----------------------------------------
-- It was never applied at checkout (coupon validation only ever reads
-- type = 'coupon'), so setting one had no effect. Per-product quantity tiers
-- now live in product_quantity_prices instead.
--
-- Safe to tighten: production held no quantity_discount rows. The delete below
-- covers any that were created between this being written and applied.

delete from public.promotions where type = 'quantity_discount';

alter table public.promotions
  drop constraint if exists promotions_type_check;
alter table public.promotions
  add constraint promotions_type_check
    check (type in ('coupon', 'threshold_gift'));
