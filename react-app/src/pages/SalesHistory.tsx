import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useBusiness } from '../contexts/BusinessContext'
import type { Sale, SaleItem } from '../types'
import { BarChart3, Calendar, ChevronDown, Download, FileText, Printer, Search } from 'lucide-react'
import * as XLSX from 'xlsx'

type SaleWithItems = Sale & { sale_items?: SaleItem[] }
type DateFilter = 'today' | 'week' | 'month' | 'all' | 'custom'
type PaymentMethodFilter = 'all' | 'cash' | 'mobile_money' | 'card' | 'credit'
type PaymentStatusFilter = 'all' | 'paid' | 'partial' | 'pending'

function toDateInput(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function fmt(n: number) {
  return new Intl.NumberFormat().format(Math.round(n))
}

function escapeHtml(value: string | number | undefined | null) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char] || char))
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
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
  const { currentBusiness } = useBusiness()
  const { t } = useLang()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [invoiceSearch, setInvoiceSearch] = useState('')
  // A custom range (exact from/to dates) arrives via query params when
  // navigating here from Reports, so the two pages agree on exactly which
  // sales are being shown instead of a same-named-but-different-meaning
  // preset (Reports' "month" is a calendar month; this page's own "month"
  // preset is a rolling last-30-days window).
  const initialFrom = searchParams.get('from')
  const initialTo = searchParams.get('to')
  const initialFilter: DateFilter = searchParams.get('range') === 'all'
    ? 'all'
    : initialFrom
      ? 'custom'
      : (searchParams.get('filter') as DateFilter) || 'week'
  const [dateFilter, setDateFilter] = useState<DateFilter>(initialFilter)
  const [customFrom, setCustomFrom] = useState(initialFrom || toDateInput(startOfToday()))
  const [customTo, setCustomTo] = useState(initialTo || initialFrom || toDateInput(startOfToday()))
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('all')
  const [selected, setSelected] = useState<SaleWithItems | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  // Aggregate stats computed across ALL rows matching the current filters,
  // not just the current page — previously the stat cards summed only the
  // 25 rows on screen, which understated (or misrepresented) totals for any
  // filter matching more than one page of results.
  const [stats, setStats] = useState({ totalRevenue: 0, totalPaid: 0, totalItems: 0, totalGrossProfit: 0, matchCount: 0 })
  const pageSize = 25

  // Debounce the free-text search box so it doesn't fire a query per keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(id)
  }, [search])

  useEffect(() => { setCurrentPage(1) }, [debouncedSearch, dateFilter, paymentMethodFilter, paymentStatusFilter])

  useEffect(() => {
    if (!profile || !currentBusiness) return
    if (invoiceSearch) {
      searchByInvoice(invoiceSearch)
    } else {
      load()
      loadStats()
    }
  }, [profile, currentBusiness, invoiceSearch, dateFilter, paymentMethodFilter, paymentStatusFilter, currentPage, debouncedSearch, customFrom, customTo])

  function filterStartDate() {
    if (dateFilter === 'all') return null
    if (dateFilter === 'custom') return new Date(`${customFrom}T00:00:00`).toISOString()
    const d = startOfToday()
    if (dateFilter === 'week') d.setDate(d.getDate() - 6)
    if (dateFilter === 'month') d.setDate(d.getDate() - 29)
    return d.toISOString()
  }

  // Only the custom range (arriving from Reports) has an upper bound — the
  // rolling today/week/month presets are always "since X ago through now",
  // where "now" already IS the true upper bound, so no .lt() is needed there.
  function filterEndDate() {
    if (dateFilter !== 'custom') return null
    const d = new Date(`${customTo}T00:00:00`)
    d.setDate(d.getDate() + 1)
    return d.toISOString()
  }

  // Sends the exact date range currently shown here to Reports, instead of a
  // same-named preset that means something different over there (Reports'
  // "month" is a calendar month; this page's "month" is a rolling last-30-days
  // window) — so the two pages show the same underlying data after navigating.
  function goToReports() {
    if (dateFilter === 'all') { navigate('/reports?range=all'); return }
    if (dateFilter === 'custom') { navigate(`/reports?from=${customFrom}&to=${customTo}`); return }
    const today = toDateInput(startOfToday())
    const daysBack = dateFilter === 'week' ? 6 : dateFilter === 'month' ? 29 : 0
    const fromDate = startOfToday()
    fromDate.setDate(fromDate.getDate() - daysBack)
    navigate(`/reports?from=${toDateInput(fromDate)}&to=${today}`)
  }

  // Resolves the free-text search term to a set of sale ids that match by
  // product name (product name lives on the joined sale_items table, which
  // PostgREST can't OR against a parent-table filter directly).
  async function matchingSaleIdsByItemName(term: string, businessId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('sale_items')
      .select('sale_id, sales!inner(business_id)')
      .eq('sales.business_id', businessId)
      .ilike('product_name', `%${term}%`)
      .limit(1000)
    if (error) { console.error('Error searching sale items:', error); return [] }
    return Array.from(new Set((data || []).map((r: any) => r.sale_id as string)))
  }

  // Resolves the filter state into plain data (not a query builder — mixing
  // Supabase's thenable query builders through a generic async helper trips
  // up TS's Awaited<> unwrapping) that both load() and loadStats() apply
  // identically, so the two queries always agree on what "matches".
  async function resolveFilters(businessId: string, term: string) {
    const fromDate = filterStartDate()
    const endDate = filterEndDate()
    const itemIds = term ? await matchingSaleIdsByItemName(term, businessId) : []
    return { fromDate, endDate, itemIds }
  }

  async function load() {
    if (!currentBusiness) return
    setLoading(true)

    const from = (currentPage - 1) * pageSize
    const to = from + pageSize - 1
    const businessId = currentBusiness.id
    const term = debouncedSearch.trim()
    const { fromDate, endDate, itemIds } = await resolveFilters(businessId, term)

    let query = supabase
      .from('sales')
      .select('*, sale_items(*)', { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (fromDate) query = query.gte('created_at', fromDate)
    if (endDate) query = query.lt('created_at', endDate)
    if (paymentMethodFilter !== 'all') query = query.eq('payment_method', paymentMethodFilter)
    if (paymentStatusFilter !== 'all') query = query.eq('payment_status', paymentStatusFilter)
    if (term) {
      const idClause = itemIds.length > 0 ? `,id.in.(${itemIds.join(',')})` : ''
      query = query.or(`customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,id.ilike.%${term}%${idClause}`)
    }
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) {
      console.error('Error loading sales history:', error)
      setSales([])
      setTotalCount(0)
    } else {
      setSales((data as SaleWithItems[] || []).map(s => ({ ...s, items: s.sale_items || [] })))
      setTotalCount(count || 0)
    }
    setLoading(false)
  }

  // Fetches every row matching the current filters (unpaginated, minimal
  // columns) purely to compute accurate stat-card totals. Capped at 5000
  // rows — consistent with the cap used elsewhere in this app's reporting
  // (e.g. Reports.tsx) — to avoid an unbounded query on very large datasets.
  async function loadStats() {
    if (!currentBusiness) return
    const businessId = currentBusiness.id
    const term = debouncedSearch.trim()
    const { fromDate, endDate, itemIds } = await resolveFilters(businessId, term)

    let query = supabase
      .from('sales')
      .select('total, amount_paid, sale_items(quantity, total_cost)')
      .eq('business_id', businessId)
      .limit(5000)

    if (fromDate) query = query.gte('created_at', fromDate)
    if (endDate) query = query.lt('created_at', endDate)
    if (paymentMethodFilter !== 'all') query = query.eq('payment_method', paymentMethodFilter)
    if (paymentStatusFilter !== 'all') query = query.eq('payment_status', paymentStatusFilter)
    if (term) {
      const idClause = itemIds.length > 0 ? `,id.in.(${itemIds.join(',')})` : ''
      query = query.or(`customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,id.ilike.%${term}%${idClause}`)
    }

    const { data, error } = await query
    if (error) { console.error('Error loading sales stats:', error); return }
    const rows = (data as any[]) || []
    const totalRevenue = rows.reduce((sum, s) => sum + Number(s.total), 0)
    const totalPaid = rows.reduce((sum, s) => sum + Number(s.amount_paid), 0)
    const totalItems = rows.reduce((sum, s) => sum + (s.sale_items || []).reduce((n: number, i: any) => n + Number(i.quantity), 0), 0)
    const totalCOGS = rows.reduce((sum, s) => sum + (s.sale_items || []).reduce((n: number, i: any) => n + Number(i.total_cost || 0), 0), 0)
    setStats({ totalRevenue, totalPaid, totalItems, totalGrossProfit: totalRevenue - totalCOGS, matchCount: rows.length })
  }

  async function searchByInvoice(invoiceId: string) {
    if (!currentBusiness || !invoiceId.trim()) return
    setLoading(true)

    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('business_id', currentBusiness.id)
      .or(`id.eq.${invoiceId},id.ilike.${invoiceId}%`)
      .limit(1)

    if (error) {
      console.error('Error searching invoice:', error)
      setSales([])
    } else if (data && data.length > 0) {
      setSales((data as SaleWithItems[] || []).map(s => ({ ...s, items: s.sale_items || [] })))
      setTotalCount(1)
    } else {
      setSales([])
      setTotalCount(0)
    }
    setLoading(false)
  }

  // The current page's rows, shown as-is — filtering/search now happens
  // server-side (see load()/applyCommonFilters), so this is just the display list.
  const filtered = sales

  const totalRevenue = stats.totalRevenue
  const totalPaid = stats.totalPaid
  const totalItems = stats.totalItems
  const totalGrossProfit = stats.totalGrossProfit

  const dateFilters: DateFilter[] = ['today', 'week', 'month', 'all']
  const paymentMethods: PaymentMethodFilter[] = ['all', 'cash', 'mobile_money', 'card', 'credit']
  const paymentStatuses: PaymentStatusFilter[] = ['all', 'paid', 'partial', 'pending']
  const totalPages = Math.ceil(totalCount / pageSize)

  function exportSaleExcel(sale: SaleWithItems) {
    const workbook = XLSX.utils.book_new()
    const summary = XLSX.utils.aoa_to_sheet([
      [t('sale_details')],
      [t('date'), new Date(sale.created_at).toLocaleString('sw-TZ')],
      [t('sold_by'), sale.cashier_name || t('unknown_seller')],
      [t('customer'), sale.customer_name || t('walk_in_customer')],
      [t('customer_phone'), sale.customer_phone || ''],
      [t('payment_method'), t(sale.payment_method)],
      [t('status'), t(sale.payment_status)],
      [],
      [t('subtotal'), Number(sale.subtotal)],
      [t('discount'), Number(sale.discount)],
      [t('total'), Number(sale.total)],
      [t('amount_paid'), Number(sale.amount_paid)],
      [t('change'), Number(sale.change_given)],
    ])
    XLSX.utils.book_append_sheet(workbook, summary, 'Sale summary')

    const items = XLSX.utils.json_to_sheet((sale.items || []).map(item => ({
      [t('product_name')]: item.product_name,
      [t('qty')]: Number(item.quantity),
      'Unit price (TZS)': Number(item.unit_price),
      [t('total') + ' (TZS)']: Number(item.total_price),
    })))
    XLSX.utils.book_append_sheet(workbook, items, 'Items')

    const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    downloadBlob(
      `sale_${new Date(sale.created_at).toISOString().slice(0, 10)}_${sale.id.slice(0, 8)}.xlsx`,
      new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    )
  }

  function printSale(sale: SaleWithItems) {
    const printWindow = window.open('', '_blank', 'width=720,height=900')
    if (!printWindow) return
    const rows = (sale.items || []).map(item => `
      <tr><td>${escapeHtml(item.product_name)}</td><td>${fmt(Number(item.quantity))}</td><td>${fmt(Number(item.unit_price))}</td><td>${fmt(Number(item.total_price))}</td></tr>
    `).join('')
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(t('sale_details'))}</title><style>
      body { font-family: Arial, sans-serif; color: #1f2937; margin: 32px; } h1 { font-size: 22px; margin: 0 0 8px; } p { margin: 4px 0; color: #4b5563; } table { width: 100%; border-collapse: collapse; margin: 24px 0 16px; } th, td { padding: 9px; border-bottom: 1px solid #e5e7eb; text-align: left; } th { background: #f9fafb; } td:not(:first-child), th:not(:first-child) { text-align: right; } .totals { margin-left: auto; width: 280px; } .total { font-size: 18px; font-weight: 700; border-top: 2px solid #111827; padding-top: 8px; margin-top: 8px; } @media print { body { margin: 16px; } }
    </style></head><body><h1>${escapeHtml(currentBusiness?.name || profile?.shop_name || 'myShopCare')}</h1><h2>${escapeHtml(t('sale_details'))}</h2>
      <p>${escapeHtml(t('date'))}: ${escapeHtml(new Date(sale.created_at).toLocaleString('sw-TZ'))}</p>
      <p>${escapeHtml(t('sold_by'))}: ${escapeHtml(sale.cashier_name || t('unknown_seller'))}</p>
      <p>${escapeHtml(t('customer'))}: ${escapeHtml(sale.customer_name || t('walk_in_customer'))}</p>
      ${sale.customer_phone ? `<p>${escapeHtml(t('customer_phone'))}: ${escapeHtml(sale.customer_phone)}</p>` : ''}
      <p>${escapeHtml(t('payment_method'))}: ${escapeHtml(t(sale.payment_method))}</p>
      <table><thead><tr><th>${escapeHtml(t('product_name'))}</th><th>${escapeHtml(t('qty'))}</th><th>Unit price</th><th>${escapeHtml(t('total'))}</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals"><p>${escapeHtml(t('subtotal'))}: ${fmt(Number(sale.subtotal))} TZS</p>${Number(sale.discount) > 0 ? `<p>${escapeHtml(t('discount'))}: -${fmt(Number(sale.discount))} TZS</p>` : ''}<p class="total">${escapeHtml(t('total'))}: ${fmt(Number(sale.total))} TZS</p><p>${escapeHtml(t('amount_paid'))}: ${fmt(Number(sale.amount_paid))} TZS</p><p>${escapeHtml(t('change'))}: ${fmt(Number(sale.change_given))} TZS</p></div>
      <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script></body></html>`)
    printWindow.document.close()
  }

  return (
    <div>
      <div className="page-header">
        <h2>{t('sales_history')}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={goToReports}><BarChart3 size={16} />{t('reports')}</button>
          <button className="btn btn-ghost" onClick={load}><Calendar size={16} />{t('refresh')}</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{t('transactions')}</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{fmt(stats.matchCount)}</div>
          <div className="stat-sub">{t('sales_history')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('total_sales')}</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{fmt(totalRevenue)} TZS</div>
          <div className="stat-sub">{t('amount')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('gross_profit')}</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{fmt(totalGrossProfit)} TZS</div>
          <div className="stat-sub">{t('profit')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('items_sold')}</div>
          <div className="stat-value" style={{ color: 'var(--yellow)' }}>{fmt(totalItems)}</div>
          <div className="stat-sub">{t('qty')}</div>
        </div>
      </div>

      <div className="filters" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 360, minWidth: 200 }}>
          <Search />
          <input 
            value={search} 
            onChange={e => { setSearch(e.target.value); setInvoiceSearch(''); setCurrentPage(1); }} 
            placeholder={t('search_sales')} 
          />
        </div>
        <div className="search-bar" style={{ flex: 1, maxWidth: 300, minWidth: 150 }}>
          <FileText />
          <input 
            value={invoiceSearch} 
            onChange={e => { setInvoiceSearch(e.target.value); setSearch(''); setCurrentPage(1); }} 
            placeholder="Invoice ID..." 
          />
        </div>
        {dateFilters.map(f => (
          <button key={f} className={`filter-chip ${dateFilter === f ? 'active' : ''}`} onClick={() => { setDateFilter(f); setCurrentPage(1); }}>
            {t(`filter_${f}`)}
          </button>
        ))}
        {dateFilter === 'custom' && (
          <span className="filter-chip active" title="Exact range carried over from Reports">
            <Calendar size={12} style={{ marginRight: 4 }} />
            {new Date(`${customFrom}T00:00:00`).toLocaleDateString()} – {new Date(`${customTo}T00:00:00`).toLocaleDateString()}
          </span>
        )}
        <select 
          value={paymentMethodFilter} 
          onChange={e => { setPaymentMethodFilter(e.target.value as PaymentMethodFilter); setCurrentPage(1); }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}
        >
          {paymentMethods.map(pm => (
            <option key={pm} value={pm}>{pm === 'all' ? 'All Payment Methods' : t(pm)}</option>
          ))}
        </select>
        <select 
          value={paymentStatusFilter} 
          onChange={e => { setPaymentStatusFilter(e.target.value as PaymentStatusFilter); setCurrentPage(1); }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}
        >
          {paymentStatuses.map(ps => (
            <option key={ps} value={ps}>{ps === 'all' ? 'All Statuses' : t(ps)}</option>
          ))}
        </select>
      </div>

      {loading ? <TableSkeleton /> : filtered.length === 0 ? (
        <div className="card"><div className="empty-state"><FileText /><p>{t('no_sales_history')}</p></div></div>
      ) : (
        <div>
          {filtered.map(s => {
            const isOpen = selected?.id === s.id
            const initials = (s.customer_name || s.cashier_name || '??').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
            return (
              <div key={s.id} className={`accordion-row ${isOpen ? 'open' : ''}`}>
                <div className="accordion-row-head" onClick={() => setSelected(isOpen ? null : s)}>
                  <div className="txn-row-main">
                    <div className="avatar-initials">{initials}</div>
                    <div className="txn-row-meta">
                      <div className="txn-row-title">{s.customer_name || t('walk_in_customer')}</div>
                      <div className="txn-row-sub">
                        <span>{new Date(s.created_at).toLocaleDateString('sw-TZ')} · {new Date(s.created_at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="badge badge-accent">{(s.items || []).length} {t('items')}</span>
                        <span className="badge badge-blue">{t(s.payment_method)}</span>
                        {s.payment_status === 'paid' ? <span className="badge badge-green">{t('paid')}</span>
                          : s.payment_status === 'partial' ? <span className="badge badge-yellow">{t('partial')}</span>
                            : <span className="badge badge-red">{t('pending')}</span>}
                      </div>
                    </div>
                    <div className="txn-row-amount"><span className="amt">{fmt(Number(s.total))} TZS</span></div>
                    <ChevronDown size={18} className="txn-row-chevron" />
                  </div>
                </div>
                {isOpen && (
                  <div className="accordion-row-body">
                    <div className="receipt-detail">
                      <div className="summary-row"><span>{t('sold_by')}</span><span>{s.cashier_name || t('unknown_seller')}</span></div>
                      {s.customer_phone && <div className="summary-row"><span>{t('customer_phone')}</span><span>{s.customer_phone}</span></div>}
                      <div className="divider" />
                      <div className="receipt-items">
                        {(s.items || []).map(item => (
                          <div key={item.id} className="receipt-row">
                            <span>{item.product_name} x{fmt(Number(item.quantity))}</span>
                            <span>{fmt(Number(item.total_price))} TZS</span>
                          </div>
                        ))}
                      </div>
                      <div className="receipt-row"><span>{t('subtotal')}</span><span>{fmt(Number(s.subtotal))} TZS</span></div>
                      {Number(s.discount) > 0 && <div className="receipt-row" style={{ color: 'var(--red)' }}><span>{t('discount')}</span><span>-{fmt(Number(s.discount))} TZS</span></div>}
                      <div className="receipt-row receipt-total"><span>{t('total')}</span><span>{fmt(Number(s.total))} TZS</span></div>
                      <div className="receipt-row"><span>{t('amount_paid')}</span><span>{fmt(Number(s.amount_paid))} TZS</span></div>
                      <div className="receipt-row"><span>{t('change')}</span><span>{fmt(Number(s.change_given))} TZS</span></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); printSale(s) }}><Printer size={14} />{t('print')}</button>
                      <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); exportSaleExcel(s) }}><Download size={14} />{t('export_excel')}</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16 }}>
          <button 
            className="btn btn-ghost" 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span style={{ color: 'var(--text2)' }}>
            Page {currentPage} of {totalPages} ({totalCount} total)
          </span>
          <button 
            className="btn btn-ghost" 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
