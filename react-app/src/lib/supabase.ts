import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// True only when both required env vars are present. App.tsx/main.tsx should
// check this before rendering the app, so a misconfigured deploy fails loudly
// instead of silently running every Supabase call against a fake project.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.error('Supabase env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) are not set.')
}

export const supabase = createClient(
  supabaseUrl || 'https://demo.supabase.co',
  supabaseAnonKey || 'demo-key'
)

export type SupabaseError = { message: string; code?: string }
