alter table public.profiles add column if not exists marketing_consent_at timestamptz;

create or replace function public.protect_member_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated'
    and not public.is_admin()
    and (
      new.id is distinct from old.id
      or new.role is distinct from old.role
      or new.phone is distinct from old.phone
      or new.terms_accepted_at is distinct from old.terms_accepted_at
      or new.marketing_consent_at is distinct from old.marketing_consent_at
      or new.created_at is distinct from old.created_at
    ) then
    raise exception 'members may only update display_name';
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  signup_phone text := nullif(new.raw_user_meta_data ->> 'phone', '');
  accepted_at text := nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '');
  marketing_at text := nullif(new.raw_user_meta_data ->> 'marketing_consent_at', '');
begin
  insert into public.profiles (
    id, display_name, role, phone, terms_accepted_at, marketing_consent_at
  )
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    'customer',
    case when signup_phone ~ '^09[0-9]{8}$' then signup_phone else null end,
    case when accepted_at ~ '^\d{4}-\d{2}-\d{2}T' then accepted_at::timestamptz else null end,
    case when marketing_at ~ '^\d{4}-\d{2}-\d{2}T' then marketing_at::timestamptz else null end
  )
  on conflict (id) do update set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    phone = coalesce(public.profiles.phone, excluded.phone),
    terms_accepted_at = coalesce(public.profiles.terms_accepted_at, excluded.terms_accepted_at),
    marketing_consent_at = coalesce(
      public.profiles.marketing_consent_at,
      excluded.marketing_consent_at
    );
  return new;
end;
$$;

revoke all on function public.protect_member_profile() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
