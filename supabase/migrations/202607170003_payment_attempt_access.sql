alter table public.payment_attempts
add column payment_access_token_hash text;

-- Existing guest attempts become inaccessible rather than receiving a usable browser token.
update public.payment_attempts
set payment_access_token_hash = encode(gen_random_bytes(32), 'hex')
where user_id is null and payment_access_token_hash is null;

alter table public.payment_attempts
add constraint payment_attempts_access_owner_check check (
  payment_access_token_hash is null
  or (user_id is null and payment_access_token_hash ~ '^[0-9a-f]{64}$')
);
