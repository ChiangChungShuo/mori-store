-- 購物金 (member store credit) ------------------------------------------------
-- A ledger, not a balance column: every grant and every spend is a row, so the
-- balance is always explainable and a spend can never be applied twice.
--
-- Rules agreed with the shop owner:
--   * the signup gift is granted to accounts that do not already have one, while
--     the 新會員禮 setting is enabled;
--   * a cancelled order does NOT return the credit.

create table if not exists public.member_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Positive rows grant credit, negative rows spend it.
  amount integer not null check (amount <> 0),
  reason text not null check (reason in ('signup_gift', 'order', 'manual')),
  order_id uuid references public.orders(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists member_credits_user_idx on public.member_credits (user_id, created_at desc);
-- One signup gift per account, and one spend per order, enforced by the database
-- rather than by application logic.
create unique index if not exists member_credits_signup_gift_key
  on public.member_credits (user_id) where reason = 'signup_gift';
create unique index if not exists member_credits_order_key
  on public.member_credits (order_id) where reason = 'order';

alter table public.member_credits enable row level security;

drop policy if exists "members read own credits" on public.member_credits;
create policy "members read own credits"
on public.member_credits for select
using (auth.uid() = user_id or public.is_admin());

-- Writes only ever happen inside the security-definer functions below.

create or replace function public.member_credit_balance(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(amount), 0)::integer
  from public.member_credits
  where user_id = p_user_id;
$$;

revoke all on function public.member_credit_balance(uuid) from public, anon, authenticated;

-- Grants the 新會員禮 once per account. The amount is read from 商店設定 inside the
-- function, never passed in, so a caller cannot ask for a bigger gift.
create or replace function public.claim_signup_credit()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gift jsonb;
  gift_amount integer;
begin
  if uid is null then
    return 0;
  end if;

  select value into gift from public.store_settings where key = 'welcome_gift';
  gift_amount := coalesce((gift ->> 'amount')::integer, 0);

  if coalesce((gift ->> 'enabled')::boolean, false) and gift_amount > 0 then
    insert into public.member_credits (user_id, amount, reason, note)
    select uid, gift_amount, 'signup_gift', gift ->> 'code'
    where not exists (
      select 1 from public.member_credits
      where user_id = uid and reason = 'signup_gift'
    );
  end if;

  return public.member_credit_balance(uid);
end;
$$;

revoke all on function public.claim_signup_credit() from public, anon;
grant execute on function public.claim_signup_credit() to authenticated, service_role;

-- Snapshot columns: how much credit this checkout spends, so the order can show
-- the line and the ledger entry can be written when the order is created.
alter table public.payment_attempts
  add column if not exists credit_applied integer not null default 0
    check (credit_applied >= 0);

alter table public.orders
  add column if not exists credit_applied integer not null default 0
    check (credit_applied >= 0);

-- Spending happens in the same transaction that creates the order, so two
-- checkouts opened side by side cannot both spend the same balance: the second
-- one fails the balance check and rolls back instead of over-discounting.
create or replace function public.finalize_manual_order(
  payment_attempt_id uuid,
  provider_reference text
)
returns public.payment_completion_result
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.payment_completion_result;
  method text;
  attempt_user uuid;
  credit integer := 0;
begin
  select payment_method, user_id, coalesce(credit_applied, 0)
    into method, attempt_user, credit
  from public.payment_attempts
  where id = payment_attempt_id;

  if method not in ('bank_transfer', 'convenience_cod') then
    raise exception 'manual payment method is required';
  end if;

  if credit > 0 and attempt_user is null then
    raise exception 'member_credit_requires_account';
  end if;

  result := public.complete_test_payment(payment_attempt_id, provider_reference);
  if result.status = 'paid' and result.order_id is not null then
    update public.orders
    set status = case
      when method = 'convenience_cod' then 'preparing'::public.order_status
      else 'pending_payment'::public.order_status
    end,
    credit_applied = credit
    where id = result.order_id;

    if credit > 0 then
      perform pg_advisory_xact_lock(hashtext('member_credit:' || attempt_user::text));
      -- The unique index on (order_id) makes a repeated finalisation a no-op, so
      -- the balance check only runs for a spend that has not been recorded yet.
      if not exists (
        select 1 from public.member_credits
        where order_id = result.order_id and reason = 'order'
      ) then
        if public.member_credit_balance(attempt_user) < credit then
          raise exception 'insufficient_member_credit';
        end if;
        insert into public.member_credits (user_id, amount, reason, order_id)
        values (attempt_user, -credit, 'order', result.order_id);
      end if;
    end if;
  end if;
  return result;
end;
$$;

revoke all on function public.finalize_manual_order(uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_manual_order(uuid, text) to service_role;
