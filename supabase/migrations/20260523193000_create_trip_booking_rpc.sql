-- ===========================================================================
-- Pay-per-trip booking RPC
-- Normal users cannot insert directly into public.rides after the security
-- remediation migration, so trip booking must go through this guarded function.
-- ===========================================================================

alter table public.rides
  add column if not exists payment_status text not null default 'paid';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rides_payment_status_check'
  ) then
    alter table public.rides
      add constraint rides_payment_status_check
      check (payment_status in ('pending', 'paid', 'failed'));
  end if;
end
$$;

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
    p_pickup,
    p_destination,
    p_time_slot,
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

  update public.rides
  set status = 'pool_locked_awaiting_driver'::public.ride_status
  where id = p_ride_id
    and type = 'shared'::public.ride_type
    and status = 'pending_friend_commitment'::public.ride_status
    and user_id <> current_user_id
  returning *
  into claimed_ride;

  if claimed_ride.id is null then
    raise exception 'This pool is no longer accepting seat claims.';
  end if;

  return claimed_ride;
end;
$$;

grant execute on function public.claim_shared_ride_seat(uuid) to authenticated;
