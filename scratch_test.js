import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL',
  process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
);

async function run() {
  const { data, error } = await supabase.from('rides').select('*');
  console.log('Rides Data:', data);
  console.log('Rides Error:', error);
}

run();
