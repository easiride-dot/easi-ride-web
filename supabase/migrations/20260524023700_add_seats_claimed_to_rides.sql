-- Add seats_claimed column to track how many friends have claimed seats in shared rides
-- Shared rides have 3 seats total: creator + 2 friends

alter table public.rides
  add column if not exists seats_claimed integer not null default 0;

-- Add constraint to ensure seats_claimed doesn't exceed 2 (max 2 friends can claim)
alter table public.rides
  add constraint rides_seats_claimed_check
  check (seats_claimed >= 0 and seats_claimed <= 2);
