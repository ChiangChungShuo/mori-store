alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

alter table public.profiles drop constraint if exists profiles_phone_format;
alter table public.profiles add constraint profiles_phone_format
check (phone is null or phone ~ '^09[0-9]{8}$');

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
      or new.created_at is distinct from old.created_at
    ) then
    raise exception 'members may only update display_name';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_member_fields on public.profiles;
create trigger profiles_protect_member_fields
before update on public.profiles
for each row execute function public.protect_member_profile();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  signup_phone text := nullif(new.raw_user_meta_data ->> 'phone', '');
  accepted_at text := nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '');
begin
  insert into public.profiles (id, display_name, role, phone, terms_accepted_at)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    'customer',
    case when signup_phone ~ '^09[0-9]{8}$' then signup_phone else null end,
    case
      when accepted_at ~ '^\d{4}-\d{2}-\d{2}T' then accepted_at::timestamptz
      else null
    end
  )
  on conflict (id) do update set
    phone = coalesce(public.profiles.phone, excluded.phone),
    terms_accepted_at = coalesce(public.profiles.terms_accepted_at, excluded.terms_accepted_at);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke all on function public.protect_member_profile() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
