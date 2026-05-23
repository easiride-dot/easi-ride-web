-- ===========================================================================
-- Easy Ride State Machine Migration: New sequential status flow
-- Updates public.ride_status type to:
--   ['pending_friend_commitment', 'pool_locked_awaiting_driver', 'driver_assigned', 'paid_and_dispatched']
-- ===========================================================================

-- Rename the old enum type to allow replacing it
alter type public.ride_status rename to ride_status_old;

-- Create the new enum type
create type public.ride_status as enum (
  'pending_friend_commitment',
  'pool_locked_awaiting_driver',
  'driver_assigned',
  'paid_and_dispatched'
);

-- Drop the old default constraint first
alter table public.rides alter column status drop default;

-- Convert existing columns to the new enum type
alter table public.rides
  alter column status type public.ride_status
  using (
    case status::text
      when 'pending' then 'pool_locked_awaiting_driver'::public.ride_status
      when 'assigned' then 'driver_assigned'::public.ride_status
      when 'completed' then 'paid_and_dispatched'::public.ride_status
      else 'pool_locked_awaiting_driver'::public.ride_status
    end
  );

-- Set the new default value to pending_friend_commitment
alter table public.rides alter column status set default 'pending_friend_commitment'::public.ride_status;

-- Safely clean up the old enum type
drop type public.ride_status_old;

-- ===========================================================================
-- Update public.create_ride_booking RPC function to support the new state flow
-- ===========================================================================
create or replace function public.create_ride_booking(
  p_pickup text,
  p_destination text,
  p_time_slot text,
  p_type public.ride_type,
  p_price integer
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  active_subscription public.subscriptions%rowtype;
  new_ride public.rides%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into active_subscription
  from public.subscriptions
  where user_id = current_user_id
    and status = 'active'
    and end_date > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'You need an active subscription to request a ride.';
  end if;

  if active_subscription.rides_used >= active_subscription.rides_limit then
    raise exception 'You have reached your ride limit for this subscription.';
  end if;

  update public.subscriptions
  set rides_used = rides_used + 1
  where id = active_subscription.id;

  insert into public.rides (
    user_id,
    pickup,
    destination,
    time_slot,
    type,
    price,
    status
  )
  values (
    current_user_id,
    p_pickup,
    p_destination,
    p_time_slot,
    p_type,
    p_price,
    case when p_type = 'shared' then 'pending_friend_commitment'::public.ride_status else 'pool_locked_awaiting_driver'::public.ride_status end
  )
  returning *
  into new_ride;

  return new_ride;
end;
$$;

grant execute on function public.create_ride_booking(text, text, text, public.ride_type, integer) to authenticated;
