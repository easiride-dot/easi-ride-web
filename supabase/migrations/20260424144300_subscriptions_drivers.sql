-- ============ DRIVERS ============
create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  vehicle text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.drivers enable row level security;

create policy "Authenticated users can view active drivers"
  on public.drivers for select to authenticated
  using (status = 'active');

create policy "Admins can view all drivers"
  on public.drivers for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can insert drivers"
  on public.drivers for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update drivers"
  on public.drivers for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============ SUBSCRIPTIONS ============
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_type text not null,
  status text not null default 'active',
  start_date timestamptz not null default now(),
  end_date timestamptz not null,
  rides_used integer not null default 0,
  rides_limit integer not null default 14,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can view their own subscriptions"
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own subscriptions"
  on public.subscriptions for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own subscriptions"
  on public.subscriptions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins can view all subscriptions"
  on public.subscriptions for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update all subscriptions"
  on public.subscriptions for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.update_updated_at();

-- ============ DEFAULT DRIVERS ============
insert into public.drivers (full_name, phone, vehicle) values
  ('Ibrahim S.', '+23278000111', 'Keke • SLE-318'),
  ('Aminata B.', '+23278000222', 'Keke • SLE-742'),
  ('Joseph T.', '+23278000333', 'Keke • SLE-091');
