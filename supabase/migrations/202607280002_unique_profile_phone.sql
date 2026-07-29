create unique index if not exists profiles_phone_unique
on public.profiles (phone)
where phone is not null;
