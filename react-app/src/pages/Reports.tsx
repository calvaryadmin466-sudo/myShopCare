import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import type { Expense, Sale, SaleItem } from '../types'
import { BarChart3, Download, Printer, RefreshCw, FileText } from 'lucide-react'
import * as XLSX from 'xlsx'

type Period = 'week' | 'month' | 'year'
type View = 'product' | 'category' | 'order'
type PaymentMethodFilter = 'all' | 'cash' | 'mobile_money' | 'card' | 'bank' | 'other'

type SaleWithItems = Sale & { sale_items?: SaleItem[] }

type PaymentRow = {
  payment_date: string
  payment_method: string
  source: 'sale' | 'debt_payment'
  source_id: string
  sale_id: string
  customer_name: string
  cashier_name: string
  product_id: string
  product_name: string
  category: string
  qty: number
  revenue: number
  cogs: number
  gross_profit: number
}

function fmt(n: number) {
  return new Intl.NumberFormat().format(Math.round(n))
}

function toDateInput(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function startOfWeek(d: Date) {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}

function rangeForPeriod(period: Period, weekStart: string, month: string, year: string) {
  if (period === 'week') {
    const start = new Date(`${weekStart}T00:00:00`)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return { start, end }
  }
  if (period === 'month') {
    const [y, m] = month.split('-').map(Number)
    const start = new Date(y, (m || 1) - 1, 1, 0, 0, 0, 0)
    const end = new Date(y, (m || 1), 1, 0, 0, 0, 0)
    return { start, end }
  }
  const y = Number(year)
  const start = new Date(y, 0, 1, 0, 0, 0, 0)
  const end = new Date(y + 1, 0, 1, 0, 0, 0, 0)
  return { start, end }
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function safeDiv(a: number, b: number) {
  return b === 0 ? 0 : a / b
}

export default function Reports() {
  const { profile } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [period, setPeriod] = useState<Period>(searchParams.get('period') as Period || 'week')
  const [view, setView] = useState<View>('product')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodFilter>('all')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])

  const now = new Date()
  const defaultWeekStart = toDateInput(startOfWeek(now))
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const defaultYear = String(now.getFullYear())

  const [weekStart, setWeekStart] = useState(defaultWeekStart)
  const [month, setMonth] = useState(defaultMonth)
  const [year, setYear] = useState(defaultYear)

  const { start, end } = useMemo(() => rangeForPeriod(period, weekStart, month, year), [period, weekStart, month, year])

  useEffect(() => { if (profile) load() }, [profile, period, weekStart, month, year, paymentMethod])

  function goToSalesHistory() {
    const dateFilterMap: Record<Period, string> = {
      week: 'week',
      month: 'month',
      year: 'all'
    }
    navigate(`/sales-history?filter=${dateFilterMap[period]}`)
  }

  async function load() {
    if (!profile) return
    setLoading(true)
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    const pmFilter = paymentMethod === 'all' ? null : paymentMethod

    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('id,created_at,payment_method,payment_status,amount_paid,change_given,total,customer_name,cashier_name,business_id,sale_items(id,product_id,product_name,quantity,unit_price,total_price,unit_cost,total_cost)')
      .eq('business_id', profile.business_id || profile.shop_id)
      .gte('created_at', startIso)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (salesError) console.error('Error loading sales for reports:', salesError)
    const sales = ((salesData as SaleWithItems[]) || []).filter(s => {
      if (!pmFilter) return true
      return s.payment_method === pmFilter
    })

    const { data: debtPaymentsData, error: debtPaymentsError } = await supabase
      .from('debt_payments')
      .select('id,amount,payment_method,created_at,debt:debts(id,business_id,sale_id)')
      .gte('created_at', startIso)
      .order('created_at', { ascending: false })

    if (debtPaymentsError) console.error('Error loading debt payments for reports:', debtPaymentsError)

    const businessId = profile.business_id || profile.shop_id
    const debtPayments = ((debtPaymentsData || []) as any[])
      .filter(p => p?.debt?.business_id === businessId)
      .filter(p => !pmFilter || p.payment_method === pmFilter)

    const debtSaleIds = Array.from(new Set(debtPayments.map(p => p?.debt?.sale_id).filter(Boolean)))

    let debtSales: SaleWithItems[] = []
    const debtSalesMap = new Map<string, SaleWithItems>()
    if (debtSaleIds.length > 0) {
      const { data: ds, error: dsError } = await supabase
        .from('sales')
        .select('id,created_at,payment_method,payment_status,amount_paid,change_given,total,customer_name,cashier_name,business_id,sale_items(id,product_id,product_name,quantity,unit_price,total_price,unit_cost,total_cost)')
        .eq('business_id', businessId)
        .in('id', debtSaleIds)
        .limit(2000)
      if (dsError) console.error('Error loading debt sales for reports:', dsError)
      debtSales = ((ds as SaleWithItems[]) || []).filter(s => s.payment_status === 'pending' || s.payment_status === 'partial')
      debtSales.forEach(s => debtSalesMap.set(s.id, s))
    }

    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('business_id', businessId)
      .gte('expense_date', startIso)
      .order('expense_date', { ascending: false })
      .limit(2000)

    if (expensesError) console.error('Error loading expenses for reports:', expensesError)
    const exp = ((expensesData as Expense[]) || []).filter(e => !pmFilter || e.payment_method === pmFilter)
    setExpenses(exp)

    const categories = new Map<string, string>()
    const productIds = Array.from(new Set([
      ...sales.flatMap(s => (s.sale_items || []).map((i: SaleItem) => i.product_id).filter(Boolean)),
      ...debtSaleIds.flatMap(id => (debtSalesMap.get(id)?.sale_items || []).map((i: SaleItem) => i.product_id).filter(Boolean)),
    ]))
    if (productIds.length > 0) {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id,category')
        .eq('business_id', businessId)
        .in('id', productIds)
        .limit(5000)
      if (productsError) console.error('Error loading product categories:', productsError)
      ;((productsData as any[]) || []).forEach(p => categories.set(p.id, p.category || 'General'))
    }

    const out: PaymentRow[] = []

    for (const s of sales) {
      const received = Math.max(0, Number(s.amount_paid || 0) - Number(s.change_given || 0))
      const total = Number(s.total || 0)
      const ratio = total > 0 ? safeDiv(received, total) : 0
      const items = (s.sale_items || []) as SaleItem[]
      for (const i of items) {
        const itemTotal = Number(i.total_price || 0)
        const revenue = itemTotal * ratio
        const cogs = Number(i.total_cost || 0) * ratio
        out.push({
          payment_date: s.created_at,
          payment_method: s.payment_method,
          source: 'sale',
          source_id: s.id,
          sale_id: s.id,
          customer_name: s.customer_name || '',
          cashier_name: s.cashier_name || '',
          product_id: i.product_id,
          product_name: i.product_name,
          category: categories.get(i.product_id) || 'General',
          qty: Number(i.quantity || 0) * ratio,
          revenue,
          cogs,
          gross_profit: revenue - cogs,
        })
      }
    }

    for (const p of debtPayments) {
      const saleId = p?.debt?.sale_id as string | undefined
      if (!saleId) continue
      const s = debtSalesMap.get(saleId)
      if (!s) continue
      const received = Math.max(0, Number(p.amount || 0))
      const ratio = safeDiv(received, Number(s.total || 0))
      const items = (s.sale_items || []) as SaleItem[]
      for (const i of items) {
        const itemTotal = Number(i.total_price || 0)
        const revenue = itemTotal * ratio
        const cogs = Number(i.total_cost || 0) * ratio
        out.push({
          payment_date: p.created_at,
          payment_method: p.payment_method,
          source: 'debt_payment',
          source_id: p.id,
          sale_id: saleId,
          customer_name: s.customer_name || '',
          cashier_name: s.cashier_name || '',
          product_id: i.product_id,
          product_name: i.product_name,
          category: categories.get(i.product_id) || 'General',
          qty: Number(i.quantity || 0) * ratio,
          revenue,
          cogs,
          gross_profit: revenue - cogs,
        })
      }
    }

    setRows(out)
    setLoading(false)
  }

  const totals = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + r.revenue, 0)
    const cogs = rows.reduce((s, r) => s + r.cogs, 0)
    const gross = revenue - cogs
    const exp = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const net = gross - exp
    return { revenue, cogs, gross, exp, net }
  }, [rows, expenses])

  const byProduct = useMemo(() => {
    const m = new Map<string, { product_id: string; product_name: string; category: string; qty: number; revenue: number; cogs: number; gross: number }>()
    for (const r of rows) {
      const key = r.product_id || r.product_name
      const cur = m.get(key) || { product_id: r.product_id, product_name: r.product_name, category: r.category, qty: 0, revenue: 0, cogs: 0, gross: 0 }
      cur.qty += r.qty
      cur.revenue += r.revenue
      cur.cogs += r.cogs
      cur.gross += r.gross_profit
      m.set(key, cur)
    }
    return Array.from(m.values()).sort((a, b) => b.gross - a.gross)
  }, [rows])

  const byCategory = useMemo(() => {
    const m = new Map<string, { category: string; qty: number; revenue: number; cogs: number; gross: number }>()
    for (const r of rows) {
      const key = r.category || 'General'
      const cur = m.get(key) || { category: key, qty: 0, revenue: 0, cogs: 0, gross: 0 }
      cur.qty += r.qty
      cur.revenue += r.revenue
      cur.cogs += r.cogs
      cur.gross += r.gross_profit
      m.set(key, cur)
    }
    return Array.from(m.values()).sort((a, b) => b.gross - a.gross)
  }, [rows])

  const byOrder = useMemo(() => {
    const m = new Map<string, { payment_date: string; payment_method: string; source: string; source_id: string; sale_id: string; customer: string; revenue: number; cogs: number; gross: number }>()
    for (const r of rows) {
      const key = `${r.source}:${r.source_id}`
      const cur = m.get(key) || { payment_date: r.payment_date, payment_method: r.payment_method, source: r.source, source_id: r.source_id, sale_id: r.sale_id, customer: r.customer_name, revenue: 0, cogs: 0, gross: 0 }
      cur.revenue += r.revenue
      cur.cogs += r.cogs
      cur.gross += r.gross_profit
      m.set(key, cur)
    }
    return Array.from(m.values()).sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''))
  }, [rows])

  function exportExcel() {
    const wb = XLSX.utils.book_new()

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Profit & Loss (Payment date)'],
      ['Period', period],
      ['From', start.toISOString().slice(0, 10)],
      ['To', new Date(end.getTime() - 1).toISOString().slice(0, 10)],
      ['Payment method', paymentMethod],
      [],
      ['Revenue received', totals.revenue],
      ['COGS', totals.cogs],
      ['Gross profit', totals.gross],
      ['Expenses', totals.exp],
      ['Net profit', totals.net],
    ])
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    const productSheet = XLSX.utils.json_to_sheet(byProduct.map(p => ({
      Product: p.product_name,
      Category: p.category,
      Qty: p.qty,
      Revenue: p.revenue,
      COGS: p.cogs,
      'Gross profit': p.gross,
    })))
    XLSX.utils.book_append_sheet(wb, productSheet, 'By product')

    const categorySheet = XLSX.utils.json_to_sheet(byCategory.map(c => ({
      Category: c.category,
      Qty: c.qty,
      Revenue: c.revenue,
      COGS: c.cogs,
      'Gross profit': c.gross,
    })))
    XLSX.utils.book_append_sheet(wb, categorySheet, 'By category')

    const orderSheet = XLSX.utils.json_to_sheet(byOrder.map(o => ({
      'Payment date': o.payment_date,
      'Payment method': o.payment_method,
      Source: o.source,
      'Sale id': o.sale_id,
      Customer: o.customer,
      Revenue: o.revenue,
      COGS: o.cogs,
      'Gross profit': o.gross,
    })))
    XLSX.utils.book_append_sheet(wb, orderSheet, 'By order')

    const expensesSheet = XLSX.utils.json_to_sheet(expenses.map(e => ({
      Date: e.expense_date,
      Category: e.category,
      Description: e.description || '',
      'Payment method': e.payment_method,
      Amount: e.amount,
    })))
    XLSX.utils.book_append_sheet(wb, expensesSheet, 'Expenses')

    const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const filename = `pnl_${period}_${start.toISOString().slice(0, 10)}_${paymentMethod}.xlsx`
    downloadBlob(filename, new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  }

  const paymentMethods: { v: PaymentMethodFilter; l: string }[] = [
    { v: 'all', l: t('all') },
    { v: 'cash', l: t('cash') },
    { v: 'mobile_money', l: t('mobile_money') },
    { v: 'card', l: t('card') },
    { v: 'bank', l: t('bank') },
    { v: 'other', l: t('other') },
  ]

  const views: { v: View; l: string }[] = [
    { v: 'product', l: t('by_product') },
    { v: 'category', l: t('by_category') },
    { v: 'order', l: t('by_order') },
  ]

  return (
    <div>
      <div className="page-header no-print">
        <h2><BarChart3 size={18} />{t('profit_loss')}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={goToSalesHistory}><FileText size={16} />{t('sales_history')}</button>
          <button className="btn btn-ghost" onClick={load} disabled={loading}><RefreshCw size={16} />{t('refresh')}</button>
          <button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16} />{t('export_pdf')}</button>
          <button className="btn btn-primary" onClick={exportExcel}><Download size={16} />{t('export_excel')}</button>
        </div>
      </div>

      <div className="filters no-print" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={period} onChange={e => setPeriod(e.target.value as Period)}>
            <option value="week">{t('week')}</option>
            <option value="month">{t('month')}</option>
            <option value="year">{t('year')}</option>
          </select>

          {period === 'week' && (
            <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
          )}
          {period === 'month' && (
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
          )}
          {period === 'year' && (
            <input type="number" min="2000" value={year} onChange={e => setYear(e.target.value)} style={{ width: 110 }} />
          )}

          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethodFilter)}>
            {paymentMethods.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>

          <select value={view} onChange={e => setView(e.target.value as View)}>
            {views.map(v => <option key={v.v} value={v.v}>{v.l}</option>)}
          </select>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{t('revenue')}</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{fmt(totals.revenue)} TZS</div>
          <div className="stat-sub">{t('payment_date')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('cogs')}</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>{fmt(totals.cogs)} TZS</div>
          <div className="stat-sub">{t('cost_of_sales')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('gross_profit')}</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{fmt(totals.gross)} TZS</div>
          <div className="stat-sub">{t('revenue')} - {t('cogs')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('expenses')}</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>{fmt(totals.exp)} TZS</div>
          <div className="stat-sub">{t('period')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('net_profit')}</div>
          <div className="stat-value" style={{ color: totals.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(totals.net)} TZS</div>
          <div className="stat-sub">{t('gross_profit')} - {t('expenses')}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              {view === 'product' && (
                <tr>
                  <th>{t('product_name')}</th>
                  <th>{t('category')}</th>
                  <th>{t('qty')}</th>
                  <th>{t('revenue')}</th>
                  <th>{t('cogs')}</th>
                  <th>{t('gross_profit')}</th>
                </tr>
              )}
              {view === 'category' && (
                <tr>
                  <th>{t('category')}</th>
                  <th>{t('qty')}</th>
                  <th>{t('revenue')}</th>
                  <th>{t('cogs')}</th>
                  <th>{t('gross_profit')}</th>
                </tr>
              )}
              {view === 'order' && (
                <tr>
                  <th>{t('payment_date')}</th>
                  <th>{t('payment_method')}</th>
                  <th>{t('customer')}</th>
                  <th>{t('total')}</th>
                  <th>{t('cogs')}</th>
                  <th>{t('gross_profit')}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div style={{ padding: 18 }}>{t('loading')}</div></td></tr>
              ) : view === 'product' ? (
                byProduct.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><BarChart3 /><p>{t('no_data')}</p></div></td></tr>
                ) : byProduct.map(p => (
                  <tr key={p.product_id || p.product_name}>
                    <td><strong>{p.product_name}</strong></td>
                    <td>{p.category}</td>
                    <td>{fmt(p.qty)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(p.revenue)} TZS</td>
                    <td style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(p.cogs)} TZS</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(p.gross)} TZS</td>
                  </tr>
                ))
              ) : view === 'category' ? (
                byCategory.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state"><BarChart3 /><p>{t('no_data')}</p></div></td></tr>
                ) : byCategory.map(c => (
                  <tr key={c.category}>
                    <td><strong>{c.category}</strong></td>
                    <td>{fmt(c.qty)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(c.revenue)} TZS</td>
                    <td style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(c.cogs)} TZS</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(c.gross)} TZS</td>
                  </tr>
                ))
              ) : (
                byOrder.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><BarChart3 /><p>{t('no_data')}</p></div></td></tr>
                ) : byOrder.map(o => (
                  <tr key={`${o.source}:${o.source_id}`}>
                    <td>
                      <strong>{new Date(o.payment_date).toLocaleDateString('sw-TZ')}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{new Date(o.payment_date).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td>{t(o.payment_method)}</td>
                    <td>{o.customer || '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(o.revenue)} TZS</td>
                    <td style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(o.cogs)} TZS</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(o.gross)} TZS</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

