-- ===========================================================================
-- Allow unauthenticated users to view rides with status 'pending_friend_commitment'
-- This enables users to access shared ride invitation links without signing in first.
-- ===========================================================================

create policy "Anonymous users can view pending_friend_commitment rides"
  on public.rides for select to anon
  using (status = 'pending_friend_commitment'::public.ride_status);
