-- ============ ENUMS ============
create type public.app_role as enum ('admin', 'student');
create type public.ride_type as enum ('shared', 'solo');
create type public.ride_status as enum ('pending', 'assigned', 'completed');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  campus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Security definer to avoid recursive RLS
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- ============ RIDES ============
create table public.rides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pickup text not null,
  destination text not null,
  time_slot text not null,
  type ride_type not null,
  price integer not null,
  status ride_status not null default 'pending',
  driver_name text,
  driver_phone text,
  vehicle text,
  eta_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rides enable row level security;

create index rides_user_id_idx on public.rides(user_id);
create index rides_status_idx on public.rides(status);

-- ============ POLICIES: profiles ============
create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- ============ POLICIES: user_roles ============
create policy "Users can view their own roles"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all roles"
  on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============ POLICIES: rides ============
create policy "Users can view their own rides"
  on public.rides for select to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all rides"
  on public.rides for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Users can create their own rides"
  on public.rides for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own pending rides"
  on public.rides for update to authenticated
  using (auth.uid() = user_id and status = 'pending');

create policy "Admins can update any ride"
  on public.rides for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============ TRIGGERS ============
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger rides_updated_at
  before update on public.rides
  for each row execute function public.update_updated_at();

-- Auto-create profile + default student role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone, '')
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'student');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();