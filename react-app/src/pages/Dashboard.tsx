import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { useBusiness } from '../contexts/BusinessContext'
import { useLang } from '../contexts/LangContext'
import { ShoppingCart, Package, AlertTriangle, TrendingUp, Users, History, CreditCard, Tag } from 'lucide-react'

function StatSkeleton() {
  return (
    <div className="stats-grid">
      {[1,2,3,4].map(i => (
        <div className="stat-card" key={i} style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--border)', marginBottom: 12 }} />
          <div style={{ width: '60%', height: 12, borderRadius: 6, background: 'var(--border)', marginBottom: 8 }} />
          <div style={{ width: '80%', height: 20, borderRadius: 6, background: 'var(--border)', marginBottom: 6 }} />
          <div style={{ width: '40%', height: 10, borderRadius: 6, background: 'var(--border)' }} />
        </div>
      ))}
    </div>
  )
}

interface Stats {
  today_sales: number
  today_transactions: number
  total_products: number
  low_stock_count: number
  total_debtors: number
  total_debt_amount: number
  week_revenue: { date: string; revenue: number }[]
  top_products: { name: string; qty: number; revenue: number }[]
}

function fmt(n: number) {
  return new Intl.NumberFormat('sw-TZ', { style: 'decimal', maximumFractionDigits: 0 }).format(n)
}

export default function Dashboard() {
  const { currentBusiness, loading: businessLoading } = useBusiness()
  const { t } = useLang()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Wait for the business context to finish resolving before deciding what to do
    if (businessLoading) return

    if (currentBusiness?.id) {
      loadStats()

      // Set up real-time subscription for sales, scoped to the selected business
      const businessId = currentBusiness.id
      const subscription = supabase
        .channel('dashboard-sales-updates')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'sales',
          filter: `business_id=eq.${businessId}`
        }, () => {
          loadStats()
        })
        .subscribe()

      return () => {
        abortControllerRef.current?.abort()
        subscription.unsubscribe()
      }
    } else {
      // No business selected/available for this user
      setLoading(false)
    }
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [currentBusiness?.id, businessLoading])

  async function loadStats() {
    const businessId = currentBusiness?.id
    if (!businessId) {
      setError('Business information not found. Please contact support.')
      setLoading(false)
      return
    }

    // Cancel previous request if still in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

      const [todaySalesRes, productsRes, debtsRes, weekSalesRes, topProductsRes] = await Promise.all([
        supabase.from('sales').select('id, total').eq('business_id', businessId).gte('created_at', today),
        supabase.from('products').select('id, stock_quantity, low_stock_threshold').eq('business_id', businessId),
        supabase.from('debts').select('balance').eq('business_id', businessId).eq('status', 'active'),
        supabase.from('sales').select('created_at, total').eq('business_id', businessId).gte('created_at', weekAgo).order('created_at'),
        supabase.from('sale_items')
          .select('product_name, quantity, total_price, sale_id, sales!inner(business_id)')
          .eq('sales.business_id', businessId)
          .limit(200),
      ])

      // Check if request was aborted
      if (controller.signal.aborted) return

      const todaySalesData = todaySalesRes.data || []
      const todaySales = todaySalesData.reduce((s, r) => s + Number(r.total), 0)
      const todayTx = todaySalesData.length
      const products = productsRes.data || []
      const lowStock = products.filter(p => p.stock_quantity <= p.low_stock_threshold).length
      const debtors = debtsRes.data || []
      const totalDebt = debtors.reduce((s, d) => s + Number(d.balance), 0)

      // Group week sales by date
      const byDate: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
        byDate[d] = 0
      }
      for (const s of (weekSalesRes.data || [])) {
        const d = s.created_at.split('T')[0]
        if (d in byDate) byDate[d] += Number(s.total)
      }
      const week_revenue = Object.entries(byDate).map(([date, revenue]) => ({
        date: new Date(date).toLocaleDateString('sw-TZ', { weekday: 'short' }),
        revenue
      }))

      // Top products
      const prodMap: Record<string, { qty: number; revenue: number }> = {}
      for (const item of (topProductsRes.data || [])) {
        if (!prodMap[item.product_name]) prodMap[item.product_name] = { qty: 0, revenue: 0 }
        prodMap[item.product_name].qty += Number(item.quantity)
        prodMap[item.product_name].revenue += Number(item.total_price)
      }
      const top_products = Object.entries(prodMap)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

      setStats({ today_sales: todaySales, today_transactions: todayTx, total_products: products.length, low_stock_count: lowStock, total_debtors: debtors.length, total_debt_amount: totalDebt, week_revenue, top_products })
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('Dashboard load error:', err)
        setError('Failed to load dashboard data. Please try again.')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }

  if (businessLoading || loading) return (
    <div>
      <div className="page-header">
        <h2><ShoppingCart size={20} />{t('dashboard')}</h2>
      </div>
      <StatSkeleton />
    </div>
  )

  if (!currentBusiness) return (
    <div>
      <div className="page-header">
        <h2><ShoppingCart size={20} />{t('dashboard')}</h2>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <AlertTriangle size={48} style={{ color: 'var(--yellow)', marginBottom: 16 }} />
        <h3 style={{ marginBottom: 8 }}>No Business Selected</h3>
        <p style={{ color: 'var(--text3)' }}>Select or create a business from the header to view your dashboard.</p>
      </div>
    </div>
  )

  if (error) return (
    <div>
      <div className="page-header">
        <h2><ShoppingCart size={20} />{t('dashboard')}</h2>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <AlertTriangle size={48} style={{ color: 'var(--red)', marginBottom: 16 }} />
        <h3 style={{ marginBottom: 8 }}>{t('error_loading_dashboard') || 'Error Loading Dashboard'}</h3>
        <p style={{ color: 'var(--text3)', marginBottom: 24 }}>{error}</p>
        <button 
          className="btn btn-primary" 
          onClick={() => loadStats()}
          style={{ padding: '12px 24px' }}
        >
          {t('retry') || 'Retry'}
        </button>
      </div>
    </div>
  )

  const statCards = [
    { label: t('today_sales'), value: `${fmt(stats?.today_sales || 0)} TZS`, sub: `${stats?.today_transactions || 0} ${t('transactions')}`, icon: <ShoppingCart />, color: 'var(--accent)', bg: 'var(--accent-light)' },
    { label: t('total_products'), value: fmt(stats?.total_products || 0), sub: `${stats?.low_stock_count || 0} ${t('low_stock')}`, icon: <Package />, color: 'var(--green)', bg: 'var(--green-light)' },
    { label: t('total_debtors'), value: fmt(stats?.total_debtors || 0), sub: `${fmt(stats?.total_debt_amount || 0)} TZS`, icon: <Users />, color: 'var(--yellow)', bg: 'var(--yellow-light)' },
    { label: t('low_stock'), value: fmt(stats?.low_stock_count || 0), sub: t('total_products') + ': ' + fmt(stats?.total_products || 0), icon: <AlertTriangle />, color: 'var(--red)', bg: 'var(--red-light)' },
  ]

  const tooltipStyle = { backgroundColor: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }
  const homeActions = [
    { to: '/sales', label: t('sales'), icon: <ShoppingCart size={20} /> },
    { to: '/products', label: t('products'), icon: <Package size={20} /> },
    { to: '/sales-history', label: t('sales_history'), icon: <History size={20} /> },
    { to: '/debts', label: t('debts'), icon: <CreditCard size={20} /> },
    { to: '/deals', label: t('deals'), icon: <Tag size={20} /> },
  ]

  return (
    <div>
      <div className="page-header">
        <h2><ShoppingCart size={20} />{t('dashboard')}</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
          {new Date().toLocaleDateString('sw-TZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      <div className="stats-grid">
        {statCards.map(c => (
          <div className="stat-card" key={c.label}>
            <div className="stat-icon" style={{ background: c.bg, color: c.color }}>{c.icon}</div>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
            <div className="stat-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="home-actions">
        {homeActions.map(action => (
          <Link key={action.to} to={action.to} className="home-action">
            {action.icon}
            <span>{action.label}</span>
          </Link>
        ))}
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-title"><TrendingUp size={15} style={{ display: 'inline', marginRight: 6 }} />{t('weekly_revenue')}</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.week_revenue || []}>
              <XAxis dataKey="date" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${fmt(v)} TZS`, '']} />
              <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title"><Package size={15} style={{ display: 'inline', marginRight: 6 }} />{t('top_products')}</div>
          {stats?.top_products.length === 0 ? (
            <div className="empty-state"><Package /><p>{t('no_data')}</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.top_products || []} layout="vertical">
                <XAxis type="number" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${fmt(v)} TZS`, 'Revenue']} />
                <Bar dataKey="revenue" fill="var(--green)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
