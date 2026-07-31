-- ON CONFLICT cannot infer a partial unique index, which would make the
-- redemption upsert fail (and silently skip usage tracking). A plain unique
-- index behaves the same here because Postgres treats NULLs as distinct.
drop index if exists promotion_redemptions_promotion_order_number_key;
create unique index if not exists promotion_redemptions_promotion_order_number_key
  on public.promotion_redemptions (promotion_id, order_number);
