import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juynjxvxowfvvdyhvhgv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eW5qeHZ4b3dmdnZkeWh2aGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjIzMjMsImV4cCI6MjA5NzM5ODMyM30.cVzEGJyBKs_MoxBijohhmpgjVt48qw8oBxl8i51lB9k'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const email = `testowner_${Date.now()}@example.com`
  console.log(`Testing signup for ${email}...`)
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'Password123!',
    options: {
      data: {
        full_name: 'Test Owner',
        shop_name: 'Test Shop'
      }
    }
  })
  
  if (error) {
    console.error('Error object:', error)
    console.error('Message:', error.message)
    console.error('Status:', error.status)
  } else {
    console.log('Signup succeeded!', data)
  }
}

test()
