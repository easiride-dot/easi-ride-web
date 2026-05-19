-- 1. Remove direct write policies on rides table for normal users
drop policy if exists "Users can create their own rides" on public.rides;
drop policy if exists "Users can update their own pending rides" on public.rides;

-- 2. Remove direct write policies on subscriptions table for normal users
drop policy if exists "Users can insert their own subscriptions" on public.subscriptions;
drop policy if exists "Users can update their own subscriptions" on public.subscriptions;

-- 3. Remove direct write policies on payment_attempts table for normal users
drop policy if exists "Users can create their own payment attempts" on public.payment_attempts;
drop policy if exists "Users can update their own payment attempts" on public.payment_attempts;

-- 4. Update storage bucket to be private
update storage.buckets
set public = false
where id = 'student-ids';
