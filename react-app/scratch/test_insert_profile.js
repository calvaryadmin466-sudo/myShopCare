import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juynjxvxowfvvdyhvhgv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eW5qeHZ4b3dmdnZkeWh2aGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjIzMjMsImV4cCI6MjA5NzM5ODMyM30.cVzEGJyBKs_MoxBijohhmpgjVt48qw8oBxl8i51lB9k'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const id = '00000000-0000-0000-0000-000000000000' // dummy UUID
  const email = 'test_insert@example.com'
  console.log(`Inserting test profile for ${email}...`)
  
  const { data, error } = await supabase.from('profiles').insert({
    id,
    email,
    full_name: 'Test Insert',
    shop_name: 'Test Insert Shop',
    role: 'owner'
  })
  
  if (error) {
    console.error('Insert error:', error)
  } else {
    console.log('Insert succeeded:', data)
  }
}

test()
