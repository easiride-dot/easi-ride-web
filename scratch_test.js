import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://mxbvkomrxkqdlajxhosk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14YnZrb21yeGtxZGxhanhob3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MjkyMzksImV4cCI6MjA5MjUwNTIzOX0.BO4j6X8I6rVW1elatMJCHtTrukFmDggaJhWDptVfmIA'
);

async function run() {
  const { data, error } = await supabase.from('rides').select('*');
  console.log('Rides Data:', data);
  console.log('Rides Error:', error);
}

run();
