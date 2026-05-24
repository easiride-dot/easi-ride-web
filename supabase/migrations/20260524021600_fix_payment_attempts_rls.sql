-- Fix RLS policy for payment_attempts table to allow inserts for payment creation
-- This allows the API to create payment attempts using the service role key

-- Drop existing policies if they exist
drop policy if exists "Users can insert payment_attempts" on public.payment_attempts;

-- Create policy to allow authenticated users to insert payment_attempts
create policy "Users can insert payment_attempts"
  on public.payment_attempts for insert to authenticated
  with check (auth.uid() = user_id);

-- Create policy to allow service role to bypass RLS for payment_attempts
-- This is handled automatically by using service role key, but we ensure it's documented
