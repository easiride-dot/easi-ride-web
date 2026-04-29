alter table public.profiles
  add column if not exists student_id_url text,
  add column if not exists verification_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_verification_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_verification_status_check
      check (verification_status in ('pending', 'approved', 'rejected'));
  end if;
end
$$;

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
    price
  )
  values (
    current_user_id,
    p_pickup,
    p_destination,
    p_time_slot,
    p_type,
    p_price
  )
  returning *
  into new_ride;

  return new_ride;
end;
$$;

grant execute on function public.create_ride_booking(text, text, text, public.ride_type, integer) to authenticated;

insert into storage.buckets (id, name, public)
values ('student-ids', 'student-ids', true)
on conflict (id) do update
set public = excluded.public;

create policy "Authenticated users can upload their own student IDs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'student-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authenticated users can update their own student IDs"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'student-ids'
    and owner = auth.uid()
  )
  with check (
    bucket_id = 'student-ids'
    and owner = auth.uid()
  );

create policy "Authenticated users can view their own student IDs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'student-ids'
    and owner = auth.uid()
  );

create policy "Authenticated users can delete their own student IDs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'student-ids'
    and owner = auth.uid()
  );

create policy "Admins can manage student IDs"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'student-ids'
    and public.has_role(auth.uid(), 'admin')
  )
  with check (
    bucket_id = 'student-ids'
    and public.has_role(auth.uid(), 'admin')
  );
