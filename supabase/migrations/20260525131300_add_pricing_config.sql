-- Create pricing_config table to allow admin to configure prices for different distance brackets
create table if not exists public.pricing_config (
  id uuid primary key default gen_random_uuid(),
  distance_bracket text not null check (distance_bracket in ('short', 'medium', 'long')),
  ride_type text not null check (ride_type in ('solo', 'shared')),
  gross_fare numeric not null check (gross_fare > 0),
  commission numeric not null check (commission >= 0),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique(distance_bracket, ride_type)
);

-- Insert default pricing values
insert into public.pricing_config (distance_bracket, ride_type, gross_fare, commission) values
  ('short', 'solo', 25.0, 5.0),
  ('short', 'shared', 15.0, 3.0),
  ('medium', 'solo', 55.0, 11.0),
  ('medium', 'shared', 25.0, 5.0),
  ('long', 'solo', 85.0, 8.5),
  ('long', 'shared', 45.0, 9.0)
on conflict (distance_bracket, ride_type) do nothing;

-- Enable RLS
alter table public.pricing_config enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Service role can manage pricing" on public.pricing_config;
drop policy if exists "Admins can manage pricing" on public.pricing_config;
drop policy if exists "Users can read pricing" on public.pricing_config;

-- Allow admin users to manage pricing
create policy "Admins can manage pricing"
  on public.pricing_config
  to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
    )
  );

-- Allow authenticated users to read pricing
create policy "Users can read pricing"
  on public.pricing_config
  for select
  using (auth.role() = 'authenticated');

-- Create function to update updated_at timestamp
create or replace function public.update_pricing_config_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger to update updated_at
create trigger pricing_config_updated_at
  before update on public.pricing_config
  for each row
  execute function public.update_pricing_config_updated_at();
