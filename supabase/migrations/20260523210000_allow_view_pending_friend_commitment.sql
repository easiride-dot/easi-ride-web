-- ===========================================================================
-- Allow authenticated users to view rides with status 'pending_friend_commitment'
-- This enables users to access shared ride invitation links to claim seats.
-- ===========================================================================

create policy "Users can view pending_friend_commitment rides"
  on public.rides for select to authenticated
  using (status = 'pending_friend_commitment'::public.ride_status);
