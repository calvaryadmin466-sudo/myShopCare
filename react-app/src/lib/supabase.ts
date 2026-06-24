import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase env vars not set — running in demo mode')
}

export const supabase = createClient(
  supabaseUrl || 'https://demo.supabase.co',
  supabaseAnonKey || 'demo-key'
)

export type SupabaseError = { message: string; code?: string }
