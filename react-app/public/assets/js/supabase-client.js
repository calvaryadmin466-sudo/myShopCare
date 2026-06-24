
// myShopCare Supabase Client Configuration
const SUPABASE_URL = 'https://juynjxvxowfvvdyhvhgv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eW5qeHZ4b3dmdnZkeWh2aGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjIzMjMsImV4cCI6MjA5NzM5ODMyM30.cVzEGJyBKs_MoxBijohhmpgjVt48qw8oBxl8i51lB9k';

// Initialize Supabase with explicit headers to fix 406 errors
const { createClient } = supabase;
window.db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  }
});

console.log('✅ myShopCare Supabase client initialized');
