import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juynjxvxowfvvdyhvhgv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eW5qeHZ4b3dmdnZkeWh2aGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjIzMjMsImV4cCI6MjA5NzM5ODMyM30.cVzEGJyBKs_MoxBijohhmpgjVt48qw8oBxl8i51lB9k'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTable(tableName) {
  console.log(`Checking table: ${tableName}...`)
  const { data, error } = await supabase.from(tableName).select('*').limit(1)
  if (error) {
    console.error(`  Error:`, error.code, error.message, error.details)
  } else {
    console.log(`  Success! Found ${data.length} rows:`, data)
  }
}

async function run() {
  await checkTable('profiles')
  await checkTable('products')
  await checkTable('shops')
  await checkTable('staff')
  await checkTable('sales')
  await checkTable('debts')
}

run()
