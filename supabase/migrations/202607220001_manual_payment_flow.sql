alter table public.payment_attempts
  drop constraint if exists payment_attempts_payment_method_check;
alter table public.payment_attempts
  alter column payment_method set default 'bank_transfer',
  add constraint payment_attempts_payment_method_check
    check (payment_method in ('online_test', 'bank_transfer', 'convenience_cod'));

alter table public.orders
  drop constraint if exists orders_payment_method_check;
alter table public.orders
  alter column payment_method set default 'bank_transfer',
  add column if not exists bank_transfer_last_five text
    check (bank_transfer_last_five is null or bank_transfer_last_five ~ '^[0-9]{5}$'),
  add column if not exists bank_transfer_submitted_at timestamptz,
  add constraint orders_payment_method_check
    check (payment_method in ('online_test', 'bank_transfer', 'convenience_cod'));

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
begin
  select payment_method into method
  from public.payment_attempts
  where id = payment_attempt_id;

  if method not in ('bank_transfer', 'convenience_cod') then
    raise exception 'manual payment method is required';
  end if;

  result := public.complete_test_payment(payment_attempt_id, provider_reference);
  if result.status = 'paid' and result.order_id is not null then
    update public.orders
    set status = case
      when method = 'convenience_cod' then 'preparing'::public.order_status
      else 'pending_payment'::public.order_status
    end
    where id = result.order_id;
  end if;
  return result;
end;
$$;

revoke all on function public.finalize_manual_order(uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_manual_order(uuid, text) to service_role;
