alter table public.order_items
  drop constraint order_items_product_id_fkey,
  drop constraint order_items_variant_id_fkey,
  alter column product_id drop not null,
  alter column variant_id drop not null;

alter table public.order_items
  add constraint order_items_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null,
  add constraint order_items_variant_id_fkey
    foreign key (variant_id) references public.product_variants(id) on delete set null;

create or replace function public.prevent_order_item_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and (
      new.product_id is not distinct from old.product_id
      or (old.product_id is not null and new.product_id is null)
    )
    and (
      new.variant_id is not distinct from old.variant_id
      or (old.variant_id is not null and new.variant_id is null)
    )
    and (
      new.product_id is distinct from old.product_id
      or new.variant_id is distinct from old.variant_id
    )
    and new.id is not distinct from old.id
    and new.order_id is not distinct from old.order_id
    and new.product_name is not distinct from old.product_name
    and new.sku is not distinct from old.sku
    and new.color is not distinct from old.color
    and new.size is not distinct from old.size
    and new.unit_price is not distinct from old.unit_price
    and new.quantity is not distinct from old.quantity
    and new.created_at is not distinct from old.created_at
  then
    return new;
  end if;

  raise exception 'order items are immutable';
end;
$$;
