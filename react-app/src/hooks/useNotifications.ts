import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { systemNotifications } from '../lib/systemNotifications'
import type { Product } from '../types'

export interface AppNotification {
  id: string          // Unique ID like 'expiry-ID' or 'low-stock-ID'
  productId: string
  type: 'expiry' | 'low_stock'
  name: string
  category: string
  expiryDate?: string
  daysLeft?: number   // for expiry (negative = expired)
  stockQuantity?: number  // for low stock
  lowStockThreshold?: number
  unit?: string
}

export function useNotifications() {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [permissionRequested, setPermissionRequested] = useState(false)

  const loadNotifications = useCallback(async () => {
    const businessId = profile?.business_id || profile?.shop_id
    if (!businessId) return
    setLoading(true)

    // Fetch all products to evaluate stock and expiry thresholds
    const { data, error } = await supabase
      .from('products')
      .select('id, name, category, stock_quantity, low_stock_threshold, unit, expiry_date, expiry_days_alert')
      .eq('business_id', businessId)
      .order('name')

    if (error) {
      console.error('Error fetching notifications:', error)
      setLoading(false)
      return
    }

    const products = (data as Product[]) || []
    const list: AppNotification[] = []
    const previousNotifications = notifications

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    products.forEach(p => {
      // 1. Evaluate Low Stock Alert
      if (p.stock_quantity <= p.low_stock_threshold) {
        list.push({
          id: `low-stock-${p.id}`,
          productId: p.id,
          type: 'low_stock',
          name: p.name,
          category: p.category || '',
          stockQuantity: p.stock_quantity,
          lowStockThreshold: p.low_stock_threshold,
          unit: p.unit || 'pcs'
        })

        // Check if this is a new low stock notification
        const wasPreviouslyNotified = previousNotifications.some(
          n => n.id === `low-stock-${p.id}`
        )
        if (!wasPreviouslyNotified && systemNotifications.isPermissionGranted()) {
          systemNotifications.showLowStockNotification(
            p.name,
            p.stock_quantity,
            p.low_stock_threshold
          )
        }
      }

      // 2. Evaluate Expiry Date Alert
      if (p.expiry_date) {
        const exp = new Date(p.expiry_date + 'T00:00:00')
        exp.setHours(0, 0, 0, 0)
        const daysLeft = Math.round((exp.getTime() - today.getTime()) / 86400000)
        const threshold = p.expiry_days_alert ?? 30

        if (daysLeft <= threshold) {
          list.push({
            id: `expiry-${p.id}`,
            productId: p.id,
            type: 'expiry',
            name: p.name,
            category: p.category || '',
            expiryDate: p.expiry_date,
            daysLeft
          })
        }
      }
    })

    setNotifications(list)
    setLoading(false)
  }, [profile?.business_id, profile?.shop_id, notifications])

  useEffect(() => {
    const businessId = profile?.business_id || profile?.shop_id
    if (!businessId) {
      setNotifications([])
      setLoading(false)
      return
    }

    // Request notification permission on first load
    if (!permissionRequested && !systemNotifications.isPermissionDenied()) {
      systemNotifications.requestPermission().then(granted => {
        setPermissionRequested(true)
      })
    }

    const channel = supabase
      .channel(`product-notifications:${businessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `business_id=eq.${businessId}` },
        loadNotifications,
      )
      .subscribe()

    // Expiry alerts also change as a new day begins, even if no product is edited.
    const refreshTimer = window.setInterval(loadNotifications, 60_000)

    return () => {
      window.clearInterval(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [profile?.business_id, profile?.shop_id, loadNotifications, permissionRequested])

  return { notifications, loading, refetch: loadNotifications, requestPermission: () => systemNotifications.requestPermission() }
}
