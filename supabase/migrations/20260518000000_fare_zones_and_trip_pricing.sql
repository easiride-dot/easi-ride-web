-- ============================================================
-- Fare zones: admin-managed route prices for weekly subscriptions
-- Students never see transport_fare; system calculates weekly price
-- ============================================================
create table public.fare_zones (
  id uuid primary key default gen_random_uuid(),
  pickup_area text not null,
  campus text not null,
  transport_fare numeric not null check (transport_fare > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pickup_area, campus)
);

alter table public.fare_zones enable row level security;

-- Public read: students and guests can see available pickup areas
create policy "Public read fare_zones"
  on public.fare_zones for select
  to anon, authenticated
  using (true);

-- Only admins can create/edit/delete fare zones
create policy "Admins manage fare_zones"
  on public.fare_zones for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Trigger to keep updated_at fresh
create trigger fare_zones_updated_at
  before update on public.fare_zones
  for each row execute function public.update_updated_at();

-- ============================================================
-- Seed with common Freetown routes
-- Admin can update these values from the admin panel
-- weekly_price = transport_fare * 2 * 6 (calculated in API)
-- ============================================================
insert into public.fare_zones (pickup_area, campus, transport_fare) values
  ('Lumley',       'Fourah Bay College', 15),
  ('Aberdeen',     'Fourah Bay College', 12),
  ('Model',        'Fourah Bay College', 10),
  ('Wilberforce',  'Fourah Bay College', 8),
  ('Congo Cross',  'Fourah Bay College', 10),
  ('Murray Town',  'Fourah Bay College', 8),
  ('Kingtom',      'Fourah Bay College', 9),
  ('Brookfields',  'Fourah Bay College', 11),
  ('Wilberforce',  'IPAM Tower Hill',    5),
  ('Congo Cross',  'IPAM Tower Hill',    6),
  ('Murray Town',  'IPAM Tower Hill',    7),
  ('Lumley',       'IPAM Tower Hill',    10),
  ('Aberdeen',     'IPAM Tower Hill',    9),
  ('Kingtom',      'IPAM Tower Hill',    6),
  ('Brookfields',  'IPAM Tower Hill',    8);

-- ============================================================
-- Extend subscriptions table for dynamic weekly pricing
-- ============================================================
alter table public.subscriptions
  add column if not exists pickup_area text,
  add column if not exists campus text,
  add column if not exists amount_paid numeric;

-- ============================================================
-- Extend rides table for pay-per-trip support
-- payment_type: 'subscription' (existing) | 'trip' (new)
-- ============================================================
alter table public.rides
  add column if not exists payment_type text not null default 'subscription',
  add column if not exists distance_km numeric,
  add column if not exists fare_amount numeric;

-- ============================================================
-- Allow 'trip' as a valid plan_type in payment_attempts
-- ============================================================
alter table public.payment_attempts drop constraint if exists payment_attempts_plan_type_check;
alter table public.payment_attempts add constraint payment_attempts_plan_type_check check (plan_type in ('shared', 'solo', 'trip'));
