import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juynjxvxowfvvdyhvhgv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eW5qeHZ4b3dmdnZkeWh2aGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjIzMjMsImV4cCI6MjA5NzM5ODMyM30.cVzEGJyBKs_MoxBijohhmpgjVt48qw8oBxl8i51lB9k'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const shopId = '00000000-0000-0000-0000-000000000000'
  console.log(`Inserting test product...`)
  
  const { data, error } = await supabase.from('products').insert({
    shop_id: shopId,
    name: 'Test Product',
    sku: 'TEST-SKU',
    buying_price: 100,
    selling_price: 150,
    stock_quantity: 10
  })
  
  if (error) {
    console.error('Insert error:', error)
  } else {
    console.log('Insert succeeded:', data)
  }
}

test()
