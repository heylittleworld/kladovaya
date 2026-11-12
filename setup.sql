-- Кладовая — настройка базы Supabase.
-- Вставь весь этот текст в Supabase → SQL Editor → New query и нажми Run. Один раз.

create extension if not exists pgcrypto;

-- «Дом» — общее хранилище. В нём может быть один человек или вся семья.
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text,
  invite_code text unique not null default upper(substr(md5(random()::text), 1, 6)),
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Все данные приложения: продукты, рецепты, дневник, закупки — по одной строке на запись.
create table if not exists public.items (
  household_id uuid not null references public.households(id) on delete cascade,
  key text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (household_id, key)
);
create index if not exists items_hh_updated on public.items (household_id, updated_at);

-- Время изменения ставит сервер, чтобы телефон и компьютер не путались из-за разных часов.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists items_touch on public.items;
create trigger items_touch before insert or update on public.items
for each row execute function public.touch_updated_at();

-- Кто в каком доме
create or replace function public.is_member(hh uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.members where household_id = hh and user_id = auth.uid());
$$;

-- Защита: каждый видит и меняет только данные своего дома.
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.items enable row level security;

drop policy if exists hh_select on public.households;
create policy hh_select on public.households for select using (public.is_member(id));

drop policy if exists mem_select on public.members;
create policy mem_select on public.members for select using (public.is_member(household_id));

drop policy if exists items_select on public.items;
create policy items_select on public.items for select using (public.is_member(household_id));
drop policy if exists items_insert on public.items;
create policy items_insert on public.items for insert with check (public.is_member(household_id));
drop policy if exists items_update on public.items;
create policy items_update on public.items for update using (public.is_member(household_id)) with check (public.is_member(household_id));

-- Создать дом (вызывает приложение)
create or replace function public.create_household(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Нужно войти'; end if;
  insert into public.households (name) values (coalesce(p_name, 'Кладовая')) returning id into v_id;
  insert into public.members (household_id, user_id, email) values (v_id, auth.uid(), auth.jwt() ->> 'email');
  return v_id;
end $$;

-- Присоединиться к дому по коду (для семьи)
create or replace function public.join_household(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Нужно войти'; end if;
  select id into v_id from public.households where invite_code = upper(trim(p_code));
  if v_id is null then raise exception 'Код не найден'; end if;
  insert into public.members (household_id, user_id, email) values (v_id, auth.uid(), auth.jwt() ->> 'email')
  on conflict do nothing;
  return v_id;
end $$;

revoke all on function public.create_household(text) from public, anon;
revoke all on function public.join_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
