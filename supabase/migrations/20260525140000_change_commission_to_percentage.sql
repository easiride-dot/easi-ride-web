-- Change commission from fixed NLe to percentage
-- First, drop the check constraint on commission
alter table public.pricing_config drop constraint if exists pricing_config_commission_check;

-- Alter commission column to store percentage (0-100)
alter table public.pricing_config 
  alter column commission type numeric using commission::numeric;

-- Add new check constraint for percentage (0-100)
alter table public.pricing_config 
  add constraint pricing_config_commission_check 
  check (commission >= 0 and commission <= 100);

-- Update existing data: convert fixed amounts to percentages
-- Short distance: solo 5 NLe of 25 = 20%, shared 3 NLe of 15 = 20%
update public.pricing_config 
  set commission = 20.0 
  where distance_bracket = 'short';

-- Medium distance: solo 11 NLe of 55 = 20%, shared 5 NLe of 25 = 20%
update public.pricing_config 
  set commission = 20.0 
  where distance_bracket = 'medium';

-- Long distance: solo 8.5 NLe of 85 = 10%, shared 9 NLe of 45 = 20%
update public.pricing_config 
  set commission = case 
    when distance_bracket = 'long' and ride_type = 'solo' then 10.0
    when distance_bracket = 'long' and ride_type = 'shared' then 20.0
  end
  where distance_bracket = 'long';
