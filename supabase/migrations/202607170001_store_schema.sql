create type public.age_band as enum ('0-2', '3-5', '6-9', '10-12');
create type public.order_status as enum ('pending_payment', 'paid', 'preparing', 'shipped', 'collected', 'cancelled');
create type public.store_chain as enum ('seven_eleven', 'family_mart');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  category text not null,
  age_bands public.age_band[] not null,
  material text not null default '',
  care_instructions text not null default '',
  size_guide text not null default '',
  is_new boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, position)
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  color text not null,
  size text not null,
  price integer not null check (price >= 0),
  compare_at_price integer check (compare_at_price is null or compare_at_price >= price),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, color, size)
);

create table public.store_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default concat('MORI-', upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null check (email = lower(email)),
  recipient_name text not null,
  recipient_phone text not null,
  store_chain public.store_chain not null,
  store_id text not null,
  store_name text not null,
  subtotal integer not null check (subtotal >= 0),
  shipping_fee integer not null check (shipping_fee >= 0),
  total integer not null check (total = subtotal + shipping_fee),
  status public.order_status not null default 'pending_payment',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  product_name text not null,
  sku text not null,
  color text not null,
  size text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null check (email = lower(email)),
  recipient_name text not null,
  recipient_phone text not null,
  store_chain public.store_chain not null,
  store_id text not null,
  store_name text not null,
  subtotal integer not null check (subtotal >= 0),
  shipping_fee integer not null check (shipping_fee >= 0),
  total integer not null check (total = subtotal + shipping_fee),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  provider_reference text unique,
  order_id uuid unique references public.orders(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_id_idx on public.orders (user_id);
create index order_items_order_id_idx on public.order_items (order_id);
create index payment_attempts_user_id_idx on public.payment_attempts (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger product_images_set_updated_at before update on public.product_images
for each row execute function public.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants
for each row execute function public.set_updated_at();
create trigger store_settings_set_updated_at before update on public.store_settings
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger payment_attempts_set_updated_at before update on public.payment_attempts
for each row execute function public.set_updated_at();

create or replace function public.prevent_order_item_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'order items are immutable';
end;
$$;

create trigger order_items_immutable
before update or delete on public.order_items
for each row execute function public.prevent_order_item_mutation();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.complete_test_payment(
  payment_attempt_id uuid,
  provider_reference text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  payment public.payment_attempts%rowtype;
  completed_order public.orders%rowtype;
  variant public.product_variants%rowtype;
  item jsonb;
  requested_variant_id uuid;
  requested_quantity integer;
  calculated_subtotal integer := 0;
begin
  if provider_reference is null or btrim(provider_reference) = '' then
    raise exception 'provider reference is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(provider_reference));

  select orders.* into completed_order
  from public.payment_attempts attempts
  join public.orders on orders.id = attempts.order_id
  where attempts.provider_reference = complete_test_payment.provider_reference;

  if found then
    return completed_order;
  end if;

  select * into payment
  from public.payment_attempts
  where id = payment_attempt_id
  for update;

  if not found then
    raise exception 'payment attempt not found';
  end if;

  if payment.order_id is not null then
    raise exception 'payment attempt already belongs to an order';
  end if;

  if payment.provider_reference is not null then
    raise exception 'payment attempt already has a provider reference';
  end if;

  if exists (
    select 1
    from public.payment_attempts
    where provider_reference = complete_test_payment.provider_reference
  ) then
    raise exception 'provider reference already belongs to another payment attempt';
  end if;

  insert into public.orders (
    user_id, email, recipient_name, recipient_phone, store_chain, store_id, store_name,
    subtotal, shipping_fee, total, status
  ) values (
    payment.user_id, payment.email, payment.recipient_name, payment.recipient_phone,
    payment.store_chain, payment.store_id, payment.store_name,
    payment.subtotal, payment.shipping_fee, payment.total, 'paid'
  ) returning * into completed_order;

  for item in select value from jsonb_array_elements(payment.items)
  loop
    requested_variant_id := (item ->> 'variant_id')::uuid;
    requested_quantity := (item ->> 'quantity')::integer;

    if requested_quantity is null or requested_quantity <= 0 then
      raise exception 'item quantity must be positive';
    end if;

    select * into variant
    from public.product_variants
    where id = requested_variant_id
    for update;

    if not found then
      raise exception 'product variant not found';
    end if;

    if variant.stock < requested_quantity then
      raise exception 'insufficient stock';
    end if;

    calculated_subtotal := calculated_subtotal + variant.price * requested_quantity;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, sku, color, size, unit_price, quantity
    )
    select completed_order.id, products.id, variant.id, products.name, variant.sku,
      variant.color, variant.size, variant.price, requested_quantity
    from public.products products
    where products.id = variant.product_id;

    update public.product_variants
    set stock = stock - requested_quantity
    where id = variant.id;
  end loop;

  if calculated_subtotal <> payment.subtotal then
    raise exception 'payment subtotal does not match current product prices';
  end if;

  update public.payment_attempts
  set provider_reference = complete_test_payment.provider_reference,
    order_id = completed_order.id,
    paid_at = now()
  where id = payment.id;

  return completed_order;
end;
$$;

revoke all on function public.complete_test_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_test_payment(uuid, text) to service_role;
