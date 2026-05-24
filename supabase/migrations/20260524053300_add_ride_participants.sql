-- Create ride_participants table to track users who claimed seats in shared rides
-- This allows us to show claimed seats on user dashboards and track payment status

create table if not exists public.ride_participants (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamp with time zone not null default now(),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  unique(ride_id, user_id)
);

-- Enable RLS
alter table public.ride_participants enable row level security;

-- Users can view their own ride participations
create policy "Users can view their own ride participations"
  on public.ride_participants for select
  using (auth.uid() = user_id);

-- Service role can insert ride participations
create policy "Service role can insert ride participations"
  on public.ride_participants for insert
  to service_role
  with check (true);

-- Service role can update ride participations
create policy "Service role can update ride participations"
  on public.ride_participants for update
  to service_role
  with check (true);

-- Update claim_shared_ride_seat RPC to also insert into ride_participants
create or replace function public.claim_shared_ride_seat(
  p_ride_id uuid
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  profile_status text;
  claimed_ride public.rides%rowtype;
  seats_claimed_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select verification_status
  into profile_status
  from public.profiles
  where id = current_user_id;

  if profile_status is distinct from 'approved' then
    raise exception 'Student ID must be approved before claiming a seat.';
  end if;

  -- Check current seats claimed
  select seats_claimed
  into seats_claimed_count
  from public.rides
  where id = p_ride_id
    and type = 'shared'::public.ride_type
    and status = 'pending_friend_commitment'::public.ride_status
    and user_id <> current_user_id
  for update;

  if seats_claimed_count is null then
    raise exception 'This pool is no longer accepting seat claims.';
  end if;

  if seats_claimed_count >= 2 then
    raise exception 'This pool is already full (2 friends have already claimed seats).';
  end if;

  -- Insert into ride_participants
  insert into public.ride_participants (ride_id, user_id, payment_status)
  values (p_ride_id, current_user_id, 'unpaid')
  on conflict (ride_id, user_id) do nothing;

  -- Increment seats claimed and update status if full
  update public.rides
  set
    seats_claimed = seats_claimed + 1,
    status = case
      when seats_claimed + 1 >= 2 then 'pool_locked_awaiting_driver'::public.ride_status
      else 'pending_friend_commitment'::public.ride_status
    end
  where id = p_ride_id
    and type = 'shared'::public.ride_type
    and status = 'pending_friend_commitment'::public.ride_status
  returning *
  into claimed_ride;

  if claimed_ride.id is null then
    raise exception 'This pool is no longer accepting seat claims.';
  end if;

  return claimed_ride;
end;
$$;
