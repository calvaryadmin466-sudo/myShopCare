const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://juynjxvxowfvvdyhvhgv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eW5qeHZ4b3dmdnZkeWh2aGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjIzMjMsImV4cCI6MjA5NzM5ODMyM30.cVzEGJyBKs_MoxBijohhmpgjVt48qw8oBxl8i51lB9k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const email = 'test_confirmed_jun23@gmail.com';
    const password = 'DebugTest123!';
    
    console.log('Logging in...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (authError) {
      console.error('Auth Error:', authError);
      return;
    }
    
    console.log('Login successful. UID:', authData.user.id);
    
    console.log('Fetching profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();
      
    if (profileError) {
      console.error('Profile Fetch Error:', profileError);
    } else {
      console.log('Profile:', profile);
    }
    
    console.log('Fetching products...');
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', profile.shop_id);
      
    if (productsError) {
      console.error('Products Fetch Error:', productsError);
    } else {
      console.log('Products:', products);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

run();
