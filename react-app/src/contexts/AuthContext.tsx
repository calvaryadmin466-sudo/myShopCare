import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface AuthCtx {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string, shopName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchingRef = useRef(false)

  async function fetchProfile(uid: string) {
    // Prevent duplicate concurrent fetches
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle()
      setProfile(data as Profile | null)
    } finally {
      fetchingRef.current = false
      setLoading(false)
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  useEffect(() => {
    // Kick off session + profile fetch in parallel at startup
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const s = data.session
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        fetchProfile(s.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        fetchProfile(s.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string, fullName: string, shopName: string) {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, shop_name: shopName } }
    })
    if (!error) return { error: null }
    // Extract a human-readable message — Supabase sometimes returns objects without .message
    const msg = error.message || error.status?.toString() || JSON.stringify(error)
    return { error: msg === '{}' ? 'Server error. Please ensure the database schema has been applied.' : msg }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
