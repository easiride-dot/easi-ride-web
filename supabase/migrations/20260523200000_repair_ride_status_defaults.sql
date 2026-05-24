-- ===========================================================================
-- Repair ride status defaults/functions after replacing public.ride_status.
-- This ensures no database default or booking RPC still writes the old
-- 'pending' ride_status value.
-- ===========================================================================

alter table public.rides alter column status drop default;
alter table public.rides alter column status set default 'pool_locked_awaiting_driver'::public.ride_status;

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

  -- Input validation
  if p_price < 0 then
    raise exception 'Price cannot be negative';
  end if;

  if length(trim(p_pickup)) < 3 or length(trim(p_pickup)) > 500 then
    raise exception 'Pickup location must be between 3 and 500 characters';
  end if;

  if length(trim(p_destination)) < 3 or length(trim(p_destination)) > 500 then
    raise exception 'Destination must be between 3 and 500 characters';
  end if;

  if length(trim(p_time_slot)) < 3 or length(trim(p_time_slot)) > 50 then
    raise exception 'Time slot must be between 3 and 50 characters';
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
    payment_type,
    payment_status,
    status
  )
  values (
    current_user_id,
    trim(p_pickup),
    trim(p_destination),
    trim(p_time_slot),
    p_type,
    p_price,
    'subscription',
    'paid',
    case
      when p_type = 'shared'::public.ride_type then 'pending_friend_commitment'::public.ride_status
      else 'pool_locked_awaiting_driver'::public.ride_status
    end
  )
  returning *
  into new_ride;

  return new_ride;
end;
$$;

grant execute on function public.create_ride_booking(text, text, text, public.ride_type, integer) to authenticated;

create or replace function public.create_trip_booking(
  p_pickup text,
  p_destination text,
  p_time_slot text,
  p_price integer,
  p_type public.ride_type default 'solo'::public.ride_type,
  p_distance_km numeric default null,
  p_fare_amount numeric default null
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  profile_status text;
  new_ride public.rides%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Input validation
  if p_price < 0 then
    raise exception 'Price cannot be negative';
  end if;

  if p_distance_km is not null and p_distance_km < 0 then
    raise exception 'Distance cannot be negative';
  end if;

  if p_fare_amount is not null and p_fare_amount < 0 then
    raise exception 'Fare amount cannot be negative';
  end if;

  if length(trim(p_pickup)) < 3 or length(trim(p_pickup)) > 500 then
    raise exception 'Pickup location must be between 3 and 500 characters';
  end if;

  if length(trim(p_destination)) < 3 or length(trim(p_destination)) > 500 then
    raise exception 'Destination must be between 3 and 500 characters';
  end if;

  if length(trim(p_time_slot)) < 3 or length(trim(p_time_slot)) > 50 then
    raise exception 'Time slot must be between 3 and 50 characters';
  end if;

  select verification_status
  into profile_status
  from public.profiles
  where id = current_user_id;

  if profile_status is distinct from 'approved' then
    raise exception 'Student ID must be approved before booking a trip.';
  end if;

  insert into public.rides (
    user_id,
    pickup,
    destination,
    time_slot,
    type,
    price,
    payment_type,
    payment_status,
    distance_km,
    fare_amount,
    status
  )
  values (
    current_user_id,
    trim(p_pickup),
    trim(p_destination),
    trim(p_time_slot),
    p_type,
    p_price,
    'trip',
    'pending',
    p_distance_km,
    coalesce(p_fare_amount, p_price),
    case
      when p_type = 'shared'::public.ride_type then 'pending_friend_commitment'::public.ride_status
      else 'pool_locked_awaiting_driver'::public.ride_status
    end
  )
  returning *
  into new_ride;

  return new_ride;
end;
$$;

grant execute on function public.create_trip_booking(text, text, text, integer, public.ride_type, numeric, numeric) to authenticated;
