import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
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

  const loadNotifications = useCallback(async () => {
    if (!profile?.shop_id) return
    setLoading(true)

    // Fetch all products to evaluate stock and expiry thresholds
    const { data, error } = await supabase
      .from('products')
      .select('id, name, category, stock_quantity, low_stock_threshold, unit, expiry_date, expiry_days_alert')
      .eq('shop_id', profile.shop_id)
      .order('name')

    if (error) {
      console.error('Error fetching notifications:', error)
      setLoading(false)
      return
    }

    const products = (data as Product[]) || []
    const list: AppNotification[] = []

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
  }, [profile?.shop_id])

  useEffect(() => {
    const shopId = profile?.shop_id
    if (!shopId) {
      setNotifications([])
      setLoading(false)
      return
    }

    loadNotifications()

    // Keep the bell current when products are added, sold, or edited elsewhere.
    const channel = supabase
      .channel(`product-notifications:${shopId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `shop_id=eq.${shopId}` },
        loadNotifications,
      )
      .subscribe()

    // Expiry alerts also change as a new day begins, even if no product is edited.
    const refreshTimer = window.setInterval(loadNotifications, 60_000)

    return () => {
      window.clearInterval(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [profile?.shop_id, loadNotifications])

  return { notifications, loading, refetch: loadNotifications }
}
