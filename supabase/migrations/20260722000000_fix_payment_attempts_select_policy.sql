-- Fix RLS for payment_attempts: add SELECT policy so verify endpoint can read
drop policy if exists "Users can view own payment_attempts" on public.payment_attempts;
create policy "Users can view own payment_attempts"
  on public.payment_attempts for select to authenticated
  using (auth.uid() = user_id);

-- Also add UPDATE policy so the checkout API can store the monime_session_id
drop policy if exists "Users can update own payment_attempts" on public.payment_attempts;
create policy "Users can update own payment_attempts"
  on public.payment_attempts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
