-- Create the notifications table
create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null check (type in ('system', 'ride', 'payment', 'promo')),
    title text not null,
    message text not null,
    read boolean not null default false,
    created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.notifications enable row level security;

-- Create policies so users can only view and update their own notifications
create policy "Users can view their own notifications"
    on public.notifications
    for select
    using (auth.uid() = user_id);

create policy "Users can update their own notifications"
    on public.notifications
    for update
    using (auth.uid() = user_id);

-- Optional: Create index for faster querying by user
create index idx_notifications_user_id on public.notifications(user_id);
create index idx_notifications_created_at on public.notifications(created_at desc);
