import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface AuthCtx {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  accessLoading: boolean
  accessAllowed: boolean
  accessReason: string | null
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
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessAllowed, setAccessAllowed] = useState(true)
  const [accessReason, setAccessReason] = useState<string | null>(null)
  const fetchingRef = useRef(false)

  async function fetchProfile(uid: string) {
    // Prevent duplicate concurrent fetches
    if (fetchingRef.current) return
    fetchingRef.current = true
    console.log('AuthContext: Fetching profile for uid:', uid)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle()
      console.log('AuthContext: Profile data:', data, 'Error:', error)
      
      if (error) {
        console.error('AuthContext: Error fetching profile:', error)
        setProfile(null)
      } else if (!data) {
        console.log('AuthContext: No profile found, creating default profile')
        // Create default profile if it doesn't exist
        const { data: userData } = await supabase.auth.getUser()
        if (userData?.user) {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: uid,
              email: userData.user.email || '',
              full_name: userData.user.user_metadata?.full_name || 'User',
              shop_name: userData.user.user_metadata?.shop_name || 'My Shop',
              role: 'owner'
            })
            .select()
            .single()
          
          if (insertError) {
            console.error('AuthContext: Error creating profile:', insertError)
            setProfile(null)
          } else {
            console.log('AuthContext: Created profile:', newProfile)
            setProfile(newProfile as Profile)
          }
        } else {
          setProfile(null)
        }
      } else {
        setProfile(data as Profile | null)
      }
    } finally {
      fetchingRef.current = false
      setLoading(false)
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  async function checkCentralAccess(accessToken?: string) {
    // Disabled until the Vercel server-only connector variables are configured.
    if (import.meta.env.VITE_CENTRAL_ACCESS_GATE !== 'true') { setAccessAllowed(true); setAccessReason(null); setAccessLoading(false); return }
    if (!accessToken) { setAccessAllowed(false); setAccessReason('session_verification_failed'); setAccessLoading(false); return }
    setAccessLoading(true)
    try {
      const response = await fetch('/api/access', { headers: { Authorization: `Bearer ${accessToken}` } })
      const result = await response.json() as { allowed?: boolean; reason?: string }
      setAccessAllowed(result.allowed === true)
      setAccessReason(result.reason ?? null)
    } catch { setAccessAllowed(false); setAccessReason('access_check_unavailable') } finally { setAccessLoading(false) }
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
        checkCentralAccess(s.access_token)
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
        checkCentralAccess(s.access_token)
      } else {
        setProfile(null)
        setLoading(false)
        setAccessAllowed(false)
        setAccessReason(null)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    // Supabase only fires onAuthStateChange on sign-in or token refresh (roughly
    // hourly), so a pause applied mid-session would otherwise take up to an hour
    // to take effect. Poll independently so a paused user is locked out promptly.
    if (!session?.access_token) return
    const id = window.setInterval(() => checkCentralAccess(session.access_token), 60_000)
    return () => window.clearInterval(id)
  }, [session?.access_token])

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
    <AuthContext.Provider value={{ user, profile, session, loading, accessLoading, accessAllowed, accessReason, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
