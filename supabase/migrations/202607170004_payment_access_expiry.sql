alter table public.payment_attempts
add column payment_access_expires_at timestamptz;

update public.payment_attempts
set payment_access_expires_at = created_at + interval '1 hour'
where payment_access_expires_at is null;

alter table public.payment_attempts
alter column payment_access_expires_at set not null;
