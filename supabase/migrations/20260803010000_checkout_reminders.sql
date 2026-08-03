-- Abandoned-checkout reminder emails ------------------------------------------
-- A pending bank-transfer attempt is a shopper who filled the whole checkout
-- but never paid. The hourly cron mails them once; reminder_sent_at keeps the
-- job idempotent.

alter table public.payment_attempts
  add column if not exists reminder_sent_at timestamptz;

-- The cron scans "pending, not yet reminded, recent" — keep that scan cheap.
create index if not exists payment_attempts_reminder_scan_idx
  on public.payment_attempts (created_at)
  where status = 'pending' and reminder_sent_at is null;

-- Reminder settings live alongside the other storefront settings.
insert into public.store_settings (key, value)
values ('cart_reminder', '{"enabled": false, "delayHours": 24, "subject": "您挑選的商品還在等您完成訂單"}'::jsonb)
on conflict (key) do nothing;
