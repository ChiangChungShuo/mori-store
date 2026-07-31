-- Product quantity (bundle) pricing -----------------------------------------
-- Lets a shop owner set per-product "buy N for NT$X" tiers, e.g. 2 for 1000
-- and 3 for 1350 on a product whose unit price is 590. Discounts apply
-- automatically at checkout, with no coupon code involved.

create table if not exists public.product_quantity_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity >= 2 and quantity <= 99),
  bundle_price integer not null check (bundle_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, quantity)
);

create index if not exists product_quantity_prices_product_idx
  on public.product_quantity_prices (product_id, quantity);

alter table public.product_quantity_prices enable row level security;

drop policy if exists "quantity prices are publicly readable" on public.product_quantity_prices;
create policy "quantity prices are publicly readable"
  on public.product_quantity_prices for select
  using (
    exists (
      select 1 from public.products
      where products.id = product_quantity_prices.product_id
        and products.is_published
    )
  );

drop policy if exists "admins read every quantity price" on public.product_quantity_prices;
create policy "admins read every quantity price"
  on public.product_quantity_prices for select
  using (public.is_admin());

drop policy if exists "admins manage quantity prices" on public.product_quantity_prices;
create policy "admins manage quantity prices"
  on public.product_quantity_prices for all
  using (public.is_admin())
  with check (public.is_admin());

-- Snapshot columns -----------------------------------------------------------
-- subtotal stays the raw sum of unit prices (complete_test_payment re-checks it
-- against live variant prices), so bundle savings need their own column.

alter table public.payment_attempts
  add column if not exists bundle_discount integer not null default 0
    check (bundle_discount >= 0);

alter table public.orders
  add column if not exists bundle_discount integer not null default 0
    check (bundle_discount >= 0),
  add column if not exists coupon_discount integer not null default 0
    check (coupon_discount >= 0),
  add column if not exists coupon_code text;

-- Allow both discounts to reduce the payable total.
alter table public.payment_attempts
  drop constraint if exists payment_attempts_total_range_check;
alter table public.payment_attempts
  add constraint payment_attempts_total_range_check
    check (total >= 0 and total <= subtotal + shipping_fee);

alter table public.orders
  drop constraint if exists orders_total_range_check;
alter table public.orders
  add constraint orders_total_range_check
    check (total >= 0 and total <= subtotal + shipping_fee);

-- Save tiers inside the product write so a product never persists with stale
-- pricing. Tiers arrive as p_product -> 'quantityPrices'; a missing key leaves
-- existing rows untouched, an empty array clears them.
create or replace function public.admin_update_product(
  p_product_id uuid,
  p_product jsonb,
  p_variants jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  variant_data jsonb;
  variant_id uuid;
  kept_variant_ids uuid[] := '{}'::uuid[];
  quantity_prices jsonb := p_product -> 'quantityPrices';
  series_ids uuid[] := coalesce(
    array(
      select distinct value::uuid
      from jsonb_array_elements_text(coalesce(p_product -> 'seriesIds', '[]'::jsonb)) requested(value)
    ),
    '{}'::uuid[]
  );
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) < 1 then raise exception 'variant_required'; end if;

  if quantity_prices is not null and jsonb_typeof(quantity_prices) <> 'array' then
    raise exception 'quantity_price_invalid';
  end if;

  if quantity_prices is not null and exists (
    select 1 from jsonb_array_elements(quantity_prices) tier(value)
    where coalesce((tier.value ->> 'quantity')::integer, 0) < 2
      or coalesce((tier.value ->> 'quantity')::integer, 0) > 99
      or coalesce((tier.value ->> 'bundlePrice')::integer, -1) < 0
  ) then
    raise exception 'quantity_price_invalid';
  end if;

  if quantity_prices is not null and (
    select count(*) <> count(distinct (tier.value ->> 'quantity')::integer)
    from jsonb_array_elements(quantity_prices) tier(value)
  ) then
    raise exception 'quantity_price_duplicate';
  end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception 'product_not_found'; end if;
  perform id from public.product_variants where product_id = p_product_id order by id for update;
  perform id from public.product_series where id = any(series_ids) order by id for share;

  if exists (
    select 1
    from unnest(series_ids) requested(id)
    left join public.product_series series on series.id = requested.id
    where series.id is null or series.category_name <> btrim(p_product ->> 'category')
  ) then
    raise exception 'product_series_category_mismatch';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_variants) requested(value)
    where requested.value ? 'id' and not exists (
      select 1 from public.product_variants existing
      where existing.id = (requested.value ->> 'id')::uuid and existing.product_id = p_product_id
    )
  ) then raise exception 'variant_not_owned'; end if;

  if (select count(*) <> count(distinct requested.value ->> 'id') from jsonb_array_elements(p_variants) requested(value) where requested.value ? 'id') then
    raise exception 'duplicate_variant_id';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_variants) requested(value)
    join public.product_variants existing on existing.id = (requested.value ->> 'id')::uuid and existing.product_id = p_product_id
    where requested.value ? 'id' and (
      nullif(requested.value ->> 'updatedAt', '') is null
      or existing.updated_at is distinct from (requested.value ->> 'updatedAt')::timestamptz
    )
  ) then raise exception 'stale_product_variant'; end if;

  delete from public.product_series_products
  where product_id = p_product_id;

  update public.products set
    name = p_product ->> 'name', slug = p_product ->> 'slug', category = p_product ->> 'category',
    age_bands = array(select value::public.age_band from jsonb_array_elements_text(p_product -> 'ageBands') age(value)),
    description = coalesce(p_product ->> 'description', ''), material = coalesce(p_product ->> 'material', ''),
    care_instructions = coalesce(p_product ->> 'careInstructions', ''), size_guide = coalesce(p_product ->> 'sizeGuide', ''),
    summary = coalesce(p_product ->> 'summary', ''),
    seo_title = coalesce(p_product ->> 'seoTitle', ''),
    seo_description = coalesce(p_product ->> 'seoDescription', ''),
    tags = coalesce(
      array(
        select btrim(value)
        from jsonb_array_elements_text(coalesce(p_product -> 'tags', '[]'::jsonb)) as t(value)
        where btrim(value) <> ''
      ),
      '{}'::text[]
    ),
    is_new = coalesce((p_product ->> 'isNew')::boolean, false),
    available_at = nullif(p_product ->> 'availableAt', '')::timestamptz
  where id = p_product_id;

  insert into public.product_series_products (product_id, series_id)
  select p_product_id, series_id
  from unnest(series_ids) selected(series_id);

  if quantity_prices is not null then
    delete from public.product_quantity_prices
    where product_id = p_product_id
      and quantity not in (
        select (tier.value ->> 'quantity')::integer
        from jsonb_array_elements(quantity_prices) tier(value)
      );

    insert into public.product_quantity_prices (product_id, quantity, bundle_price)
    select
      p_product_id,
      (tier.value ->> 'quantity')::integer,
      (tier.value ->> 'bundlePrice')::integer
    from jsonb_array_elements(quantity_prices) tier(value)
    on conflict (product_id, quantity) do update
      set bundle_price = excluded.bundle_price,
        updated_at = clock_timestamp();
  end if;

  update public.product_variants set is_active = false, updated_at = clock_timestamp()
  where product_id = p_product_id and is_active;

  for variant_data in select value from jsonb_array_elements(p_variants) loop
    variant_id := nullif(variant_data ->> 'id', '')::uuid;
    if variant_id is null then
      insert into public.product_variants (product_id, sku, color, size, price, cost, compare_at_price, stock, is_active)
      values (
        p_product_id,
        upper(btrim(variant_data ->> 'sku')),
        btrim(variant_data ->> 'color'),
        btrim(variant_data ->> 'size'),
        (variant_data ->> 'price')::integer,
        coalesce((variant_data ->> 'cost')::integer, 0),
        case when variant_data ? 'compareAtPrice' then (variant_data ->> 'compareAtPrice')::integer else null end,
        (variant_data ->> 'stock')::integer,
        true
      ) returning id into variant_id;
    else
      update public.product_variants set
        sku = upper(btrim(variant_data ->> 'sku')),
        color = btrim(variant_data ->> 'color'),
        size = btrim(variant_data ->> 'size'),
        price = (variant_data ->> 'price')::integer,
        cost = coalesce((variant_data ->> 'cost')::integer, 0),
        compare_at_price = case when variant_data ? 'compareAtPrice' then (variant_data ->> 'compareAtPrice')::integer else null end,
        stock = (variant_data ->> 'stock')::integer,
        is_active = true,
        updated_at = clock_timestamp()
      where id = variant_id and product_id = p_product_id;
      if not found then raise exception 'variant_not_owned'; end if;
    end if;
    kept_variant_ids := array_append(kept_variant_ids, variant_id);
  end loop;

  if exists (select 1 from public.product_variants where product_id = p_product_id and is_active and not (id = any(kept_variant_ids))) then
    raise exception 'variant_sync_failed';
  end if;
end;
$$;

revoke all on function public.admin_update_product(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.admin_update_product(uuid, jsonb, jsonb) to authenticated;

-- Carry the discount snapshot onto the order row ------------------------------
-- Derived verbatim from 202607170008 with only the orders insert extended.
create or replace function public.complete_test_payment(
  payment_attempt_id uuid,
  provider_reference text
)
returns public.payment_completion_result
language plpgsql
security definer
set search_path = public
as $$
declare
  payment public.payment_attempts%rowtype;
  existing_attempt public.payment_attempts%rowtype;
  completed_order public.orders%rowtype;
  item record;
  calculated_subtotal integer := 0;
  conflict_code text;
  conflict_reason text;
begin
  if provider_reference is null or btrim(provider_reference) = '' then
    raise exception 'provider reference is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(provider_reference, 0));

  select attempts.* into existing_attempt
  from public.payment_attempts attempts
  where attempts.provider_reference = complete_test_payment.provider_reference;

  if found then
    if existing_attempt.id <> payment_attempt_id then
      raise exception 'provider reference already belongs to another payment attempt';
    end if;

    if existing_attempt.status = 'paid' and existing_attempt.order_id is not null then
      select * into completed_order
      from public.orders
      where id = existing_attempt.order_id;
      return row(
        'paid', completed_order.id, completed_order.order_number, null
      )::public.payment_completion_result;
    end if;

    if existing_attempt.status = 'requires_review' then
      return row(
        'requires_review', null, null, existing_attempt.review_code
      )::public.payment_completion_result;
    end if;

    raise exception 'provider reference is already in use';
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

  if payment.status <> 'pending' then
    raise exception 'payment attempt is not pending';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(payment.items) as entry(value)
    where nullif(entry.value ->> 'variant_id', '') is null
      or nullif(entry.value ->> 'quantity', '') is null
      or (entry.value ->> 'quantity')::integer <= 0
      or nullif(entry.value ->> 'product_name', '') is null
      or nullif(entry.value ->> 'sku', '') is null
      or nullif(entry.value ->> 'color', '') is null
      or nullif(entry.value ->> 'size', '') is null
      or nullif(entry.value ->> 'unit_price', '') is null
  ) then
    conflict_code := 'catalog_changed';
    conflict_reason := '商品資料已變更，請更新購物袋後重新結帳';
  end if;

  if conflict_code is null then
    perform products.id
    from public.products products
    where products.id in (
      select variants.product_id
      from public.product_variants variants
      where variants.id in (
        select distinct (entry.value ->> 'variant_id')::uuid
        from jsonb_array_elements(payment.items) as entry(value)
      )
    )
    order by products.id
    for update;

    perform product_variants.id
    from public.product_variants product_variants
    where product_variants.id in (
      select distinct (entry.value ->> 'variant_id')::uuid
      from jsonb_array_elements(payment.items) as entry(value)
    )
    order by product_variants.id
    for update;

    for item in
      select
        requested.variant_id,
        requested.quantity,
        requested.unit_price,
        requested.product_name,
        requested.sku,
        requested.color,
        requested.size,
        variants.id as current_variant_id,
        variants.price as current_price,
        variants.stock as current_stock,
        variants.sku as current_sku,
        variants.color as current_color,
        variants.size as current_size,
        variants.is_active,
        products.id as current_product_id,
        products.name as current_product_name,
        products.is_published
      from (
        select
          (entry.value ->> 'variant_id')::uuid as variant_id,
          sum((entry.value ->> 'quantity')::integer)::integer as quantity,
          min((entry.value ->> 'unit_price')::integer)::integer as unit_price,
          min(entry.value ->> 'product_name') as product_name,
          min(entry.value ->> 'sku') as sku,
          min(entry.value ->> 'color') as color,
          min(entry.value ->> 'size') as size
        from jsonb_array_elements(payment.items) as entry(value)
        group by (entry.value ->> 'variant_id')::uuid
      ) requested
      left join public.product_variants variants on variants.id = requested.variant_id
      left join public.products products on products.id = variants.product_id
      order by requested.variant_id
    loop
      if item.current_variant_id is null
        or item.current_product_id is null
        or not item.is_published
        or not item.is_active
        or item.current_product_name is distinct from item.product_name
        or item.current_sku is distinct from item.sku
        or item.current_color is distinct from item.color
        or item.current_size is distinct from item.size then
        conflict_code := 'catalog_changed';
        conflict_reason := '商品資料已變更，請更新購物袋後重新結帳';
        exit;
      end if;

      if item.current_price is distinct from item.unit_price then
        conflict_code := 'price_changed';
        conflict_reason := '商品價格已變更，請更新購物袋後重新結帳';
        exit;
      end if;

      if item.current_stock < item.quantity then
        conflict_code := 'stock_unavailable';
        conflict_reason := '商品庫存不足，請更新購物袋後重新結帳';
        exit;
      end if;

      calculated_subtotal := calculated_subtotal + item.current_price * item.quantity;
    end loop;

    if conflict_code is null and calculated_subtotal <> payment.subtotal then
      conflict_code := 'price_changed';
      conflict_reason := '商品價格已變更，請更新購物袋後重新結帳';
    end if;
  end if;

  if conflict_code is not null then
    update public.payment_attempts
    set status = 'requires_review',
      provider_reference = complete_test_payment.provider_reference,
      review_code = conflict_code,
      review_reason = conflict_reason
    where id = payment.id;

    return row(
      'requires_review', null, null, conflict_code
    )::public.payment_completion_result;
  end if;

  insert into public.orders (
    user_id, email, recipient_name, recipient_phone, store_chain, store_id, store_name,
    subtotal, shipping_fee, total, status,
    bundle_discount, coupon_discount, coupon_code
  ) values (
    payment.user_id, lower(btrim(payment.email)), payment.recipient_name, payment.recipient_phone,
    payment.store_chain, payment.store_id, payment.store_name,
    payment.subtotal, payment.shipping_fee, payment.total, 'paid',
    coalesce(payment.bundle_discount, 0), coalesce(payment.discount, 0), payment.coupon_code
  ) returning * into completed_order;

  for item in
    select
      (entry.value ->> 'variant_id')::uuid as variant_id,
      sum((entry.value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(payment.items) as entry(value)
    group by (entry.value ->> 'variant_id')::uuid
    order by (entry.value ->> 'variant_id')::uuid
  loop
    insert into public.order_items (
      order_id, product_id, variant_id, product_name, sku, color, size, unit_price, quantity
    )
    select completed_order.id, products.id, variants.id, products.name, variants.sku,
      variants.color, variants.size, variants.price, item.quantity
    from public.product_variants variants
    join public.products products on products.id = variants.product_id
    where variants.id = item.variant_id;

    update public.product_variants
    set stock = stock - item.quantity,
      updated_at = clock_timestamp()
    where id = item.variant_id;
  end loop;

  update public.payment_attempts
  set provider_reference = complete_test_payment.provider_reference,
    order_id = completed_order.id,
    paid_at = now(),
    status = 'paid',
    review_code = null,
    review_reason = null
  where id = payment.id;

  return row(
    'paid', completed_order.id, completed_order.order_number, null
  )::public.payment_completion_result;
end;
$$;

revoke all on function public.complete_test_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_test_payment(uuid, text) to service_role;
