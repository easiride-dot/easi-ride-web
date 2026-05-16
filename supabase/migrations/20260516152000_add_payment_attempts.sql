create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_type text not null check (plan_type in ('shared', 'solo')),
  amount integer not null,
  currency text not null default 'SLE',
  order_id text not null unique,
  monime_session_id text unique,
  monime_order_number text,
  redirect_url text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled', 'expired', 'failed')),
  monime_status text,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_attempts enable row level security;

create policy "Users can view their own payment attempts"
  on public.payment_attempts for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own payment attempts"
  on public.payment_attempts for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own payment attempts"
  on public.payment_attempts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins can view all payment attempts"
  on public.payment_attempts for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger payment_attempts_updated_at
  before update on public.payment_attempts
  for each row execute function public.update_updated_at();
