alter table public.orders
  add column if not exists merchant_reply text not null default ''
    check (char_length(merchant_reply) <= 1000);
