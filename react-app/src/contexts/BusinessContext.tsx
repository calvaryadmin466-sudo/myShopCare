import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Business, BusinessUser } from '../types'

interface BusinessCtx {
  businesses: Business[]
  currentBusiness: Business | null
  businessRole: 'owner' | 'manager' | 'cashier' | null
  loading: boolean
  error: string | null
  setCurrentBusiness: (business: Business | null) => void
  refreshBusinesses: () => Promise<void>
  createBusiness: (name: string, themeColor: string, currency: string) => Promise<{ error: string | null; business?: Business }>
  updateBusiness: (id: string, updates: Partial<Business>) => Promise<{ error: string | null }>
  deleteBusiness: (id: string) => Promise<{ error: string | null }>
}

const BusinessContext = createContext<BusinessCtx | null>(null)

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [currentBusiness, setCurrentBusinessState] = useState<Business | null>(null)
  const [businessRole, setBusinessRole] = useState<'owner' | 'manager' | 'cashier' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Load user's businesses
  const loadBusinesses = useCallback(async () => {
    if (!userId) return
    
    try {
      setLoading(true)
      setError(null)
      
      // Get businesses where user is owner or member
      const { data: ownerBusinesses, error: ownerError } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', userId)
      
      if (ownerError) throw ownerError
      
      const { data: memberBusinesses, error: memberError } = await supabase
        .from('business_users')
        .select('business_id, role, businesses(*)')
        .eq('user_id', userId)
      
      if (memberError) throw memberError
      
      // Combine and deduplicate businesses
      const allBusinesses = new Map<string, Business>()
      
      // Add owner businesses
      ownerBusinesses?.forEach((business: Business) => {
        allBusinesses.set(business.id, { ...business, _role: 'owner' as const })
      })
      
      // Add member businesses with their role
      memberBusinesses?.forEach((item: any) => {
        if (item.businesses && !allBusinesses.has(item.business_id)) {
          allBusinesses.set(item.business_id, { 
            ...item.businesses, 
            _role: item.role 
          })
        }
      })
      
      const businessList = Array.from(allBusinesses.values())
      setBusinesses(businessList)
      
      // Set current business from localStorage or first available
      const savedBusinessId = localStorage.getItem('currentBusinessId')
      if (savedBusinessId) {
        const saved = businessList.find(b => b.id === savedBusinessId)
        if (saved) {
          setCurrentBusinessState(saved)
          setBusinessRole((saved as any)._role || 'owner')
          return
        }
      }
      
      // Default to first business
      if (businessList.length > 0) {
        const first = businessList[0]
        setCurrentBusinessState(first)
        setBusinessRole((first as any)._role || 'owner')
        localStorage.setItem('currentBusinessId', first.id)
      }
    } catch (err: any) {
      console.error('Error loading businesses:', err)
      setError(err.message || 'Failed to load businesses')
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Set current business
  const setCurrentBusiness = useCallback((business: Business | null) => {
    setCurrentBusinessState(business)
    if (business) {
      localStorage.setItem('currentBusinessId', business.id)
      setBusinessRole((business as any)._role || 'owner')
    } else {
      localStorage.removeItem('currentBusinessId')
      setBusinessRole(null)
    }
  }, [])

  // Refresh businesses
  const refreshBusinesses = useCallback(async () => {
    await loadBusinesses()
  }, [loadBusinesses])

  // Create new business
  const createBusiness = useCallback(async (
    name: string, 
    themeColor: string, 
    currency: string
  ): Promise<{ error: string | null; business?: Business }> => {
    if (!userId) return { error: 'Not authenticated' }
    
    try {
      const { data, error } = await supabase
        .from('businesses')
        .insert({
          name,
          theme_color: themeColor,
          currency,
          owner_id: userId
        })
        .select()
        .single()
      
      if (error) throw error
      
      // Add user as owner
      await supabase
        .from('business_users')
        .insert({
          business_id: data.id,
          user_id: userId,
          role: 'owner'
        })
      
      // Refresh businesses
      await loadBusinesses()
      
      return { error: null, business: data as Business }
    } catch (err: any) {
      console.error('Error creating business:', err)
      return { error: err.message || 'Failed to create business' }
    }
  }, [userId, loadBusinesses])

  // Update business
  const updateBusiness = useCallback(async (
    id: string, 
    updates: Partial<Business>
  ): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
      
      if (error) throw error
      
      // Refresh businesses
      await loadBusinesses()
      
      return { error: null }
    } catch (err: any) {
      console.error('Error updating business:', err)
      return { error: err.message || 'Failed to update business' }
    }
  }, [loadBusinesses])

  // Delete business
  const deleteBusiness = useCallback(async (id: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase
        .from('businesses')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      // If deleting current business, switch to another
      if (currentBusiness?.id === id) {
        const remaining = businesses.filter(b => b.id !== id)
        if (remaining.length > 0) {
          setCurrentBusiness(remaining[0])
        } else {
          setCurrentBusiness(null)
        }
      }
      
      // Refresh businesses
      await loadBusinesses()
      
      return { error: null }
    } catch (err: any) {
      console.error('Error deleting business:', err)
      return { error: err.message || 'Failed to delete business' }
    }
  }, [currentBusiness, businesses, loadBusinesses, setCurrentBusiness])

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
      }
    })
  }, [])

  // Load businesses when userId is set
  useEffect(() => {
    if (userId) {
      loadBusinesses()
    }
  }, [userId, loadBusinesses])

  return (
    <BusinessContext.Provider value={{
      businesses,
      currentBusiness,
      businessRole,
      loading,
      error,
      setCurrentBusiness,
      refreshBusinesses,
      createBusiness,
      updateBusiness,
      deleteBusiness
    }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error('useBusiness must be used inside BusinessProvider')
  return ctx
}
