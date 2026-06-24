import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import type { Sale, SaleItem } from '../types'
import { Calendar, Eye, FileText, Search, X } from 'lucide-react'

type SaleWithItems = Sale & { sale_items?: SaleItem[] }
type DateFilter = 'today' | 'week' | 'month' | 'all'

function fmt(n: number) {
  return new Intl.NumberFormat().format(Math.round(n))
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function TableSkeleton() {
  return (
    <div className="card" style={{ padding: 0, animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {Array.from({ length: 7 }).map((_, i) => (
                <th key={i}>
                  <div style={{ height: 12, background: 'var(--border)', borderRadius: 4, width: '60%' }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j}>
                    <div style={{ height: 16, background: 'var(--border)', borderRadius: 4, width: j === 0 ? '70%' : '50%' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SalesHistory() {
  const { profile } = useAuth()
  const { t } = useLang()
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [selected, setSelected] = useState<SaleWithItems | null>(null)

  useEffect(() => { if (profile) load() }, [profile, dateFilter])

  function filterStartDate() {
    if (dateFilter === 'all') return null
    const d = startOfToday()
    if (dateFilter === 'week') d.setDate(d.getDate() - 6)
    if (dateFilter === 'month') d.setDate(d.getDate() - 29)
    return d.toISOString()
  }

  async function load() {
    if (!profile) return
    setLoading(true)

    let query = supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('shop_id', profile.shop_id)
      .order('created_at', { ascending: false })
      .limit(200)

    const fromDate = filterStartDate()
    if (fromDate) query = query.gte('created_at', fromDate)

    const { data, error } = await query
    if (error) {
      console.error('Error loading sales history:', error)
      setSales([])
    } else {
      setSales((data as SaleWithItems[] || []).map(s => ({ ...s, items: s.sale_items || [] })))
    }
    setLoading(false)
  }

  const filtered = sales.filter(s => {
    const term = search.toLowerCase()
    const customer = s.customer_name?.toLowerCase() || ''
    const phone = s.customer_phone?.toLowerCase() || ''
    const items = (s.items || []).map(i => i.product_name.toLowerCase()).join(' ')
    return customer.includes(term) || phone.includes(term) || items.includes(term)
  })

  const totalRevenue = filtered.reduce((sum, s) => sum + Number(s.total), 0)
  const totalPaid = filtered.reduce((sum, s) => sum + Number(s.amount_paid), 0)
  const totalItems = filtered.reduce((sum, s) => sum + (s.items || []).reduce((n, i) => n + Number(i.quantity), 0), 0)

  const dateFilters: DateFilter[] = ['today', 'week', 'month', 'all']

  return (
    <div>
      <div className="page-header">
        <h2>{t('sales_history')}</h2>
        <button className="btn btn-ghost" onClick={load}><Calendar size={16} />{t('refresh')}</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{t('transactions')}</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{fmt(filtered.length)}</div>
          <div className="stat-sub">{t('sales_history')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('total_sales')}</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{fmt(totalRevenue)} TZS</div>
          <div className="stat-sub">{t('amount')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('amount_paid')}</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{fmt(totalPaid)} TZS</div>
          <div className="stat-sub">{t('payment_history')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('items_sold')}</div>
          <div className="stat-value" style={{ color: 'var(--yellow)' }}>{fmt(totalItems)}</div>
          <div className="stat-sub">{t('qty')}</div>
        </div>
      </div>

      <div className="filters" style={{ marginBottom: 16 }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
          <Search />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search_sales')} />
        </div>
        {dateFilters.map(f => (
          <button key={f} className={`filter-chip ${dateFilter === f ? 'active' : ''}`} onClick={() => setDateFilter(f)}>
            {t(`filter_${f}`)}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton /> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('sold_by')}</th>
                  <th>{t('customer')}</th>
                  <th>{t('items')}</th>
                  <th>{t('payment_method')}</th>
                  <th>{t('status')}</th>
                  <th>{t('total')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><FileText /><p>{t('no_sales_history')}</p></div></td></tr>
                ) : filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <strong>{new Date(s.created_at).toLocaleDateString('sw-TZ')}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{new Date(s.created_at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td>
                      <strong>{s.cashier_name || t('unknown_seller')}</strong>
                      {!s.cashier_name && <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{s.cashier_id.slice(0, 8)}</div>}
                    </td>
                    <td>
                      <strong>{s.customer_name || t('walk_in_customer')}</strong>
                      {s.customer_phone && <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{s.customer_phone}</div>}
                    </td>
                    <td>
                      <span className="badge badge-accent">{(s.items || []).length} {t('items')}</span>
                    </td>
                    <td>{t(s.payment_method)}</td>
                    <td>
                      {s.payment_status === 'paid' ? <span className="badge badge-green">{t('paid')}</span>
                        : s.payment_status === 'partial' ? <span className="badge badge-yellow">{t('partial')}</span>
                          : <span className="badge badge-red">{t('pending')}</span>}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(Number(s.total))} TZS</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelected(s)}><Eye size={13} />{t('view')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('sale_details')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="summary-row"><span>{t('date')}</span><span>{new Date(selected.created_at).toLocaleString('sw-TZ')}</span></div>
              <div className="summary-row"><span>{t('sold_by')}</span><span>{selected.cashier_name || t('unknown_seller')}</span></div>
              <div className="summary-row"><span>{t('customer')}</span><span>{selected.customer_name || t('walk_in_customer')}</span></div>
              {selected.customer_phone && <div className="summary-row"><span>{t('customer_phone')}</span><span>{selected.customer_phone}</span></div>}
              <div className="summary-row"><span>{t('payment_method')}</span><span>{t(selected.payment_method)}</span></div>
              <div className="divider" />
              <div className="receipt-items">
                {(selected.items || []).map(item => (
                  <div key={item.id} className="receipt-row">
                    <span>{item.product_name} x{fmt(Number(item.quantity))}</span>
                    <span>{fmt(Number(item.total_price))} TZS</span>
                  </div>
                ))}
              </div>
              <div className="receipt-row"><span>{t('subtotal')}</span><span>{fmt(Number(selected.subtotal))} TZS</span></div>
              {Number(selected.discount) > 0 && <div className="receipt-row" style={{ color: 'var(--red)' }}><span>{t('discount')}</span><span>-{fmt(Number(selected.discount))} TZS</span></div>}
              <div className="receipt-row receipt-total"><span>{t('total')}</span><span>{fmt(Number(selected.total))} TZS</span></div>
              <div className="receipt-row"><span>{t('amount_paid')}</span><span>{fmt(Number(selected.amount_paid))} TZS</span></div>
              <div className="receipt-row"><span>{t('change')}</span><span>{fmt(Number(selected.change_given))} TZS</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
