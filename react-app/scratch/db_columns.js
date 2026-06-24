import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juynjxvxowfvvdyhvhgv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eW5qeHZ4b3dmdnZkeWh2aGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjIzMjMsImV4cCI6MjA5NzM5ODMyM30.cVzEGJyBKs_MoxBijohhmpgjVt48qw8oBxl8i51lB9k'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  console.log('Querying information_schema for profiles table columns...')
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1) // we just want to see the keys of returned object or inspect columns if we can query pg_attribute
    
  if (error) {
    console.error('Error:', error)
    return
  }
  
  // Let's try to query public schema columns using postgrest RPC or a view if available,
  // or we can see what keys are in a dummy insert attempt's error if we can,
  // or let's try querying information_schema if PostgREST allows it.
  // Wait, does PostgREST allow querying information_schema? Let's check:
  const { data: cols, error: colsErr } = await supabase
    .from('columns')
    .select('column_name, data_type')
    .eq('table_name', 'profiles')
    
  if (colsErr) {
    console.log('Could not query information_schema directly (expected):', colsErr.message)
  } else {
    console.log('Profiles columns:', cols)
  }
}

run()
