alter table public.payment_attempts
  add column if not exists customer_note text not null default ''
    check (char_length(customer_note) <= 500),
  add column if not exists payment_method text not null default 'online_test'
    check (payment_method in ('online_test'));

alter table public.orders
  add column if not exists customer_note text not null default ''
    check (char_length(customer_note) <= 500),
  add column if not exists payment_method text not null default 'online_test'
    check (payment_method in ('online_test'));

create or replace function public.sync_payment_checkout_details_to_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_id is not null then
    update public.orders
    set customer_note = new.customer_note,
      payment_method = new.payment_method
    where id = new.order_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_payment_checkout_details_to_order on public.payment_attempts;
create trigger sync_payment_checkout_details_to_order
after update of order_id on public.payment_attempts
for each row
when (new.order_id is not null)
execute function public.sync_payment_checkout_details_to_order();

update public.orders as orders
set customer_note = payments.customer_note,
  payment_method = payments.payment_method
from public.payment_attempts as payments
where payments.order_id = orders.id;
