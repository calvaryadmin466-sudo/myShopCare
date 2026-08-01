import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useBusiness } from '../contexts/BusinessContext'
import { systemNotifications } from '../lib/systemNotifications'
import { offlineSync } from '../lib/offlineSync'
import type { Product, CartItem, Sale, Worker, Deal } from '../types'
import { Search, Trash2, X, Printer, ShoppingCart as CartIcon, Package, WifiOff } from 'lucide-react'

function fmt(n: number) { return new Intl.NumberFormat().format(Math.round(n)) }

function todayStr() { return new Date().toISOString().slice(0, 10) }

function isDealActive(d: Deal) {
  const today = todayStr()
  return d.is_active && d.start_date <= today && d.end_date >= today
}

function GridSkeleton() {
  return (
    <div className="pos-product-list" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="pos-product-row" style={{ pointerEvents: 'none' }}>
          <div className="pos-product-main">
            <div style={{ height: 12, background: 'var(--border)', borderRadius: 4, width: '45%', marginBottom: 8 }} />
            <div style={{ height: 10, background: 'var(--border)', borderRadius: 3, width: '72%' }} />
          </div>
          <div style={{ height: 16, background: 'var(--border)', borderRadius: 4, width: 84 }} />
        </div>
      ))}
    </div>
  )
}

export default function POS() {
  const { profile, user } = useAuth()
  const { t } = useLang()
  const { currentBusiness } = useBusiness()
  const [products, setProducts] = useState<Product[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [receiptOffline, setReceiptOffline] = useState(false)
  const [sellerId, setSellerId] = useState('profile')

  const [customer, setCustomer] = useState({ name: '', phone: '' })
  const [payment, setPayment] = useState({ method: 'cash', amount_paid: 0, discount: 0 })

  useEffect(() => { if (profile && currentBusiness) load() }, [profile, currentBusiness])

  async function load() {
    if (!currentBusiness) return
    const businessId = currentBusiness.id
    const today = todayStr()

    // Offline: fall back to the last cache of products synced while online,
    // so the cashier can still see stock and keep selling. Workers/deals
    // aren't essential to checkout and are simply left as last-known.
    if (!offlineSync.getOnlineStatus()) {
      const cached = await offlineSync.getData('products', businessId)
      setProducts((cached as Product[]).filter(p => p.stock_quantity > 0).sort((a, b) => a.name.localeCompare(b.name)))
      setLoading(false)
      return
    }

    const [productsRes, workersRes, dealsRes] = await Promise.all([
      supabase.from('products').select('*').eq('business_id', businessId).gt('stock_quantity', 0).order('name'),
      supabase.from('workers').select('*').eq('business_id', businessId).eq('is_active', true).order('name'),
      supabase.from('deals').select('*').eq('business_id', businessId).eq('is_active', true).lte('start_date', today).gte('end_date', today),
    ])
    const activeWorkers = workersRes.data as Worker[] || []
    setProducts(productsRes.data as Product[] || [])
    setWorkers(activeWorkers)
    setDeals(dealsRes.data as Deal[] || [])
    setSellerId(prev => prev !== 'profile' || activeWorkers.length === 0 ? prev : activeWorkers[0].id)
    setLoading(false)

    // Refresh the offline cache in the background so it's ready if the
    // connection drops (cache ALL products here, not just in-stock ones,
    // since stock can free up while offline via cart quantity changes).
    supabase.from('products').select('*').eq('business_id', businessId)
      .then(({ data }) => { if (data) offlineSync.cacheRecords('products', businessId, data) })
  }

  function addToCart(p: Product) {
    setCart(prev => {
      const ex = prev.find(c => c.id === p.id)
      if (ex) {
        if (ex.qty >= p.stock_quantity) return prev
        return prev.map(c => c.id === p.id ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, { ...p, qty: 1 }]
    })
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(1, Math.min(c.qty + delta, c.stock_quantity)) } : c).filter(c => c.qty > 0))
  }

  function removeItem(id: string) { setCart(prev => prev.filter(c => c.id !== id)) }

  const subtotal = cart.reduce((s, c) => s + c.selling_price * c.qty, 0)
  const manualDiscount = Math.min(Math.max(+payment.discount || 0, 0), subtotal)

  // Auto-apply the single best-value active percentage/fixed deal. BOGO and
  // bundle deals aren't priced automatically — the schema has no defined
  // pairing/bundling rules to compute them from.
  const eligibleDeal = useMemo(() => {
    if (cart.length === 0) return null
    let best: { deal: Deal; amount: number } | null = null
    for (const d of deals) {
      if (!isDealActive(d)) continue
      if (d.deal_type !== 'percentage' && d.deal_type !== 'fixed') continue
      const applicable = !d.applicable_products || d.applicable_products.length === 0
        ? cart
        : cart.filter(c => d.applicable_products!.includes(c.id))
      if (applicable.length === 0) continue
      const eligibleSubtotal = applicable.reduce((s, c) => s + c.selling_price * c.qty, 0)
      if (eligibleSubtotal < (d.min_purchase || 0)) continue
      const amount = d.deal_type === 'percentage'
        ? eligibleSubtotal * (d.discount_value / 100)
        : Math.min(d.discount_value, eligibleSubtotal)
      if (amount > 0 && (!best || amount > best.amount)) best = { deal: d, amount }
    }
    return best
  }, [cart, deals])

  const dealDiscount = eligibleDeal ? Math.min(eligibleDeal.amount, Math.max(0, subtotal - manualDiscount)) : 0
  const discount = manualDiscount + dealDiscount
  const total = Math.max(0, subtotal - discount)
  const change = Math.max(0, (+payment.amount_paid || 0) - total)
  const selectedWorker = workers.find(w => w.id === sellerId)
  const sellerName = selectedWorker?.name || profile?.full_name || ''

  async function processSale() {
    if (cart.length === 0 || !currentBusiness) return

    const amountPaidValue = payment.method === 'credit' ? 0 : (+payment.amount_paid > 0 ? +payment.amount_paid : total)
    const paymentStatus: Sale['payment_status'] = payment.method === 'credit' ? 'pending' : (amountPaidValue >= total ? 'paid' : 'partial')

    if (paymentStatus !== 'paid' && !customer.name.trim()) {
      alert(t('debt_requires_customer_name') || 'Please enter a customer name — this sale is not fully paid and needs to be tracked as a debt.')
      return
    }

    setProcessing(true)

    const items = cart.map(c => ({
      product_id: c.id,
      product_name: c.name,
      quantity: c.qty,
      unit_price: c.selling_price,
      total_price: c.selling_price * c.qty,
      unit_cost: c.buying_price,
      total_cost: c.buying_price * c.qty,
    }))

    const rpcArgs = {
      p_business_id: currentBusiness.id,
      p_cashier_id: user!.id,
      p_cashier_worker_id: selectedWorker?.id || null,
      p_cashier_name: sellerName,
      p_customer_name: customer.name || null,
      p_customer_phone: customer.phone || null,
      p_subtotal: subtotal,
      p_discount: discount,
      p_total: total,
      p_payment_method: payment.method,
      p_payment_status: paymentStatus,
      p_amount_paid: amountPaidValue,
      p_change_given: payment.method === 'credit' ? 0 : change,
      p_items: items,
    }

    // Offline: queue the checkout to replay once back online (see
    // offlineSync.ts / process_sale RPC) instead of failing outright, and
    // hand the cashier a receipt immediately with stock optimistically
    // reduced in this session's view. Cross-device stock accuracy during the
    // offline window isn't guaranteed until sync — the atomic RPC still
    // guards against oversell at that point, it just can't do so live.
    if (!offlineSync.getOnlineStatus()) {
      await offlineSync.queueOperation(currentBusiness.id, user!.id, 'process_sale', 'rpc', rpcArgs)

      const offlineSale: Sale = {
        id: crypto.randomUUID(),
        business_id: currentBusiness.id,
        cashier_id: user!.id,
        cashier_worker_id: selectedWorker?.id,
        cashier_name: sellerName,
        customer_name: customer.name || undefined,
        customer_phone: customer.phone || undefined,
        subtotal, discount, total,
        payment_method: payment.method as Sale['payment_method'],
        payment_status: paymentStatus,
        amount_paid: amountPaidValue,
        change_given: payment.method === 'credit' ? 0 : change,
        created_at: new Date().toISOString(),
      }

      setProducts(prev => prev.map(p => {
        const c = cart.find(ci => ci.id === p.id)
        return c ? { ...p, stock_quantity: p.stock_quantity - c.qty } : p
      }))

      setReceiptOffline(true)
      setReceipt({ ...offlineSale, items: items.map((it, i) => ({ ...it, id: `${offlineSale.id}-${i}`, sale_id: offlineSale.id })) })
      setCart([])
      setCustomer({ name: '', phone: '' })
      setPayment({ method: 'cash', amount_paid: 0, discount: 0 })
      setProcessing(false)
      return
    }

    // Single atomic RPC: inserts the sale + items, decrements stock with a
    // guarded UPDATE (prevents overselling from concurrent checkouts), and
    // records a debt for any non-fully-paid sale — all in one DB transaction
    // so a failure (e.g. insufficient stock) rolls back everything instead of
    // leaving a half-recorded sale.
    const { data, error } = await supabase.rpc('process_sale', rpcArgs)

    const sale = Array.isArray(data) ? data[0] : data
    if (error || !sale) {
      setProcessing(false)
      const msg = error?.message?.includes('insufficient_stock')
        ? (t('insufficient_stock_error') || 'Not enough stock for one or more items. Please refresh and try again.')
        : (error?.message || 'Unknown error')
      alert('Error processing sale: ' + msg)
      return
    }

    if (eligibleDeal) {
      const { error: dealErr } = await supabase.from('deals').update({ usage_count: (eligibleDeal.deal.usage_count || 0) + 1 }).eq('id', eligibleDeal.deal.id)
      if (dealErr) console.error('Error updating deal usage:', dealErr)
    }

    setReceiptOffline(false)
    setReceipt({ ...sale, items: items.map((it, i) => ({ ...it, id: `${sale.id}-${i}`, sale_id: sale.id })) })
    setCart([])
    setCustomer({ name: '', phone: '' })
    setPayment({ method: 'cash', amount_paid: 0, discount: 0 })

    systemNotifications.showSaleNotification(total, currentBusiness.currency || 'TZS')

    load()
    setProcessing(false)
  }

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))]
  const filtered = products.filter(p => {
    const term = search.toLowerCase()
    const matchSearch = p.name.toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term)
    const matchCat = catFilter === 'all' || p.category === catFilter
    return matchSearch && matchCat
  })

  // Barcode scanner support: scanners type the code and send Enter.
  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const term = search.trim().toLowerCase()
    if (!term) return
    const exact = products.find(p => (p.sku || '').toLowerCase() === term && p.stock_quantity > 0)
    const target = exact || (filtered.length === 1 && filtered[0].stock_quantity > 0 ? filtered[0] : null)
    if (target) { addToCart(target); setSearch('') }
  }

  const paymentMethods = [
    { v: 'cash', l: t('cash') },
    { v: 'mobile_money', l: t('mobile_money') },
    { v: 'card', l: t('card') },
    { v: 'credit', l: t('credit') },
  ]

  return (
    <div>
      <div className="page-header">
        <h2><CartIcon size={20} />{t('sales')}</h2>
      </div>

      <div className="pos-layout">
        {/* Left: Products */}
        <div className="pos-products">
          <div className="filters" style={{ marginBottom: 12 }}>
            <div className="search-bar" style={{ flex: 1 }}>
              <Search /><input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearchKey} placeholder={t('scan_or_search')} autoFocus />
            </div>
            {categories.map(c => (
              <button key={c} className={`filter-chip ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>

          {loading ? <GridSkeleton /> : (
            <div className="pos-product-list">
              {filtered.map(p => (
                <div key={p.id} className={`pos-product-row ${p.stock_quantity === 0 ? 'out-of-stock' : ''}`} onClick={() => p.stock_quantity > 0 && addToCart(p)}>
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="pos-product-thumb" />
                    : <div className="pos-product-thumb placeholder"><Package size={18} /></div>}
                  <div className="pos-product-main">
                    <div className="pos-product-name">{p.name}</div>
                    <div className="pos-product-meta">
                      {p.sku && <span>{p.sku}</span>}
                      <span>{p.category}</span>
                      <span>{fmt(p.stock_quantity)} {p.unit}</span>
                    </div>
                    {p.description && <div className="pos-product-desc">{p.description}</div>}
                  </div>
                  <div className="pos-product-price">{fmt(p.selling_price)} TZS</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Cart */}
        <div className="pos-cart">
          <div className="pos-cart-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CartIcon size={16} color="var(--accent)" />
              <strong>{t('cart')}</strong>
              {cart.length > 0 && <span className="badge badge-accent">{cart.reduce((s, c) => s + c.qty, 0)}</span>}
              {cart.length > 0 && (
                <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setCart([])}>
                  <Trash2 size={12} />{t('clear_cart')}
                </button>
              )}
            </div>
            <div className="form-grid pos-customer-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>{t('sold_by')}</label>
                <select value={sellerId} onChange={e => setSellerId(e.target.value)}>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                  <option value="profile">{profile?.full_name || t('seller')}</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>{t('customer_name')}</label>
                <input value={customer.name} onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))} placeholder="..." />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>{t('customer_phone')}</label>
                <input value={customer.phone} onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))} placeholder="+255..." />
              </div>
            </div>
          </div>

          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}><CartIcon /><p>Add products to cart</p></div>
            ) : cart.map(item => (
              <div key={item.id} className="cart-item">
                <div className="ci-name">{item.name}</div>
                <div className="ci-controls">
                  <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>−</button>
                  <span className="ci-qty">{item.qty}</span>
                  <button className="qty-btn" onClick={() => updateQty(item.id, 1)}>+</button>
                </div>
                <div className="ci-price">{fmt(item.selling_price * item.qty)}</div>
                <button className="qty-btn" onClick={() => removeItem(item.id)} style={{ background: 'var(--red-light)', color: 'var(--red)' }}><X size={10} /></button>
              </div>
            ))}
          </div>

          <div className="pos-cart-footer">
            <div className="summary-row"><span>{t('subtotal')}</span><span>{fmt(subtotal)} TZS</span></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text2)', minWidth: 60 }}>{t('discount')}</span>
              <input type="number" min="0" value={payment.discount || ''} onChange={e => setPayment(p => ({ ...p, discount: Math.max(0, +e.target.value || 0) }))}
                style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px', fontSize: '0.82rem' }} placeholder="0" />
            </div>
            {eligibleDeal && (
              <div className="summary-row" style={{ color: 'var(--green)' }}>
                <span>🏷️ {eligibleDeal.deal.name}</span><span>-{fmt(dealDiscount)} TZS</span>
              </div>
            )}
            <div className="summary-row total"><span>{t('total')}</span><span style={{ color: 'var(--accent)' }}>{fmt(total)} TZS</span></div>

            <div style={{ margin: '10px 0' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: 6 }}>{t('payment_method')}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {paymentMethods.map(m => (
                  <button key={m.v} className={`filter-chip ${payment.method === m.v ? 'active' : ''}`} style={{ fontSize: '0.72rem', padding: '4px 8px' }} onClick={() => setPayment(p => ({ ...p, method: m.v }))}>
                    {m.l}
                  </button>
                ))}
              </div>
            </div>

            {payment.method !== 'credit' && (
              <>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: '0.78rem' }}>{t('amount_paid')} (TZS)</label>
                  <input type="number" min="0" value={payment.amount_paid || ''} onChange={e => setPayment(p => ({ ...p, amount_paid: Math.max(0, +e.target.value || 0) }))}
                    placeholder={fmt(total)} />
                </div>
                {payment.amount_paid > 0 && (
                  <div className="summary-row" style={{ color: 'var(--green)', fontWeight: 600 }}>
                    <span>{t('change')}</span><span>{fmt(change)} TZS</span>
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--border)', position: 'relative', zIndex: 1000 }}>
              <button
                type="button"
                className="btn btn-primary btn-full btn-lg"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '56px',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  padding: '14px 24px',
                  visibility: 'visible',
                  opacity: 1,
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  backgroundColor: cart.length === 0 ? '#ccc' : 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  position: 'relative',
                  zIndex: 1000,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
                onClick={processSale}
                disabled={cart.length === 0 || processing}
              >
                {processing ? t('loading') : `✓ ${t('process_sale')}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {receipt && (
        <div className="modal-overlay receipt-modal">
          <div className="modal receipt-print" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>{t('receipt')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setReceipt(null)}><X size={16} /></button>
            </div>
            <div className="modal-body receipt-body">
              {receiptOffline && (
                <div className="alert alert-error no-print" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <WifiOff size={14} />
                  {t('offline_sale_pending') || 'Recorded offline — will sync automatically once back online.'}
                </div>
              )}
              <div className="receipt-header">
                <h2>{currentBusiness?.name || profile?.shop_name}</h2>
                <p>{t('receipt_no')} {receipt.id.slice(0, 8).toUpperCase()}</p>
                <p>{new Date(receipt.created_at || Date.now()).toLocaleString('sw-TZ')}</p>
                <p>{t('sold_by')}: {receipt.cashier_name}</p>
                {receipt.customer_name && <p>{t('customer')}: {receipt.customer_name}</p>}
              </div>
              <div className="receipt-items">
                {receipt.items?.map(item => (
                  <div key={item.id} className="receipt-row">
                    <span>{item.product_name} ×{item.quantity} @ {fmt(item.unit_price)}</span>
                    <span>{fmt(item.total_price)} TZS</span>
                  </div>
                ))}
              </div>
              <div className="receipt-row"><span>{t('subtotal')}</span><span>{fmt(receipt.subtotal)} TZS</span></div>
              {receipt.discount > 0 && <div className="receipt-row" style={{ color: 'var(--red)' }}><span>{t('discount')}</span><span>-{fmt(receipt.discount)} TZS</span></div>}
              <div className="receipt-row receipt-total"><span>{t('total')}</span><span>{fmt(receipt.total)} TZS</span></div>
              <div className="receipt-row"><span>{t('payment_method')}</span><span>{paymentMethods.find(m => m.v === receipt.payment_method)?.l || receipt.payment_method}</span></div>
              <div className="receipt-row"><span>{t('amount_paid')}</span><span>{fmt(receipt.amount_paid)} TZS</span></div>
              <div className="receipt-row"><span>{t('change')}</span><span>{fmt(receipt.change_given)} TZS</span></div>
              <div className="receipt-footer"><p>Asante kwa kununua! 🙏</p><p>Thank you for shopping with us!</p></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setReceipt(null)}>{t('new_transaction')}</button>
              <button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} />{t('print')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
