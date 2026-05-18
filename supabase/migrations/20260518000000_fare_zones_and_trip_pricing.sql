-- ============================================================
-- Easy Ride Dynamic Pricing Database Schema Migration
-- Drops constraints and extends schema for GPS/dynamic pricing
-- ============================================================

-- Drop the obsolete fare_zones table if it exists
drop table if exists public.fare_zones cascade;

-- ============================================================
-- Extend subscriptions table for dynamic weekly pricing
-- ============================================================
alter table public.subscriptions
  add column if not exists pickup_area text,
  add column if not exists campus text,
  add column if not exists amount_paid numeric;

-- ============================================================
-- Extend rides table for pay-per-trip support
-- payment_type: 'subscription' (existing) | 'trip' (new)
-- ============================================================
alter table public.rides
  add column if not exists payment_type text not null default 'subscription',
  add column if not exists distance_km numeric,
  add column if not exists fare_amount numeric;

-- ============================================================
-- Allow 'trip' as a valid plan_type in payment_attempts
-- ============================================================
alter table public.payment_attempts drop constraint if exists payment_attempts_plan_type_check;
alter table public.payment_attempts add constraint payment_attempts_plan_type_check check (plan_type in ('shared', 'solo', 'trip'));
