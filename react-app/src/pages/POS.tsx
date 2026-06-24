import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import type { Product, CartItem, Sale, Worker } from '../types'
import { Search, Trash2, X, Printer, ShoppingCart as CartIcon } from 'lucide-react'

function fmt(n: number) { return new Intl.NumberFormat().format(Math.round(n)) }

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
  const [products, setProducts] = useState<Product[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [sellerId, setSellerId] = useState('profile')

  const [customer, setCustomer] = useState({ name: '', phone: '' })
  const [payment, setPayment] = useState({ method: 'cash', amount_paid: 0, discount: 0 })

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    const [productsRes, workersRes] = await Promise.all([
      supabase.from('products').select('*').eq('shop_id', profile!.shop_id).gt('stock_quantity', 0).order('name'),
      supabase.from('workers').select('*').eq('shop_id', profile!.shop_id).eq('is_active', true).order('name'),
    ])
    const activeWorkers = workersRes.data as Worker[] || []
    setProducts(productsRes.data as Product[] || [])
    setWorkers(activeWorkers)
    setSellerId(prev => prev !== 'profile' || activeWorkers.length === 0 ? prev : activeWorkers[0].id)
    setLoading(false)
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
  const discount = Math.min(+payment.discount || 0, subtotal)
  const total = subtotal - discount
  const change = Math.max(0, (+payment.amount_paid || 0) - total)
  const selectedWorker = workers.find(w => w.id === sellerId)
  const sellerName = selectedWorker?.name || profile?.full_name || ''

  async function processSale() {
    if (cart.length === 0) return
    setProcessing(true)

    const saleData = {
      shop_id: profile!.shop_id,
      cashier_id: user!.id,
      cashier_worker_id: selectedWorker?.id || null,
      cashier_name: sellerName,
      customer_name: customer.name || null,
      customer_phone: customer.phone || null,
      subtotal,
      discount,
      total,
      payment_method: payment.method,
      payment_status: payment.method === 'credit' ? 'pending' : (+payment.amount_paid >= total ? 'paid' : 'partial'),
      amount_paid: +payment.amount_paid || total,
      change_given: change,
    }

    const { data: sale, error } = await supabase.from('sales').insert(saleData).select().single()
    if (error || !sale) { setProcessing(false); alert('Error processing sale: ' + (error?.message || 'Unknown error')); return }

    // Insert sale items
    const items = cart.map(c => ({
      sale_id: sale.id,
      product_id: c.id,
      product_name: c.name,
      quantity: c.qty,
      unit_price: c.selling_price,
      total_price: c.selling_price * c.qty,
    }))
    const { error: itemsError } = await supabase.from('sale_items').insert(items)
    if (itemsError) {
      console.error('Error inserting sale items:', itemsError)
      alert('Sale recorded, but failed to save items. Please check database.')
    }

    // Update stock
    for (const c of cart) {
      const { error: stockError } = await supabase.from('products').update({ stock_quantity: c.stock_quantity - c.qty }).eq('id', c.id)
      if (stockError) console.error('Error updating stock:', stockError)
    }

    // If credit, create debt
    if (payment.method === 'credit' && customer.name) {
      const { error: debtError } = await supabase.from('debts').insert({
        shop_id: profile!.shop_id,
        customer_name: customer.name,
        customer_phone: customer.phone || null,
        original_amount: total,
        amount_paid: 0,
        sale_id: sale.id,
      })
      if (debtError) {
        console.error('Error creating debt:', debtError)
        alert('Failed to record customer debt.')
      }
    }

    setReceipt({ ...sale, items })
    setCart([])
    setCustomer({ name: '', phone: '' })
    setPayment({ method: 'cash', amount_paid: 0, discount: 0 })
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
              <Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search_products')} />
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
              <input type="number" min="0" value={payment.discount || ''} onChange={e => setPayment(p => ({ ...p, discount: +e.target.value }))}
                style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px', fontSize: '0.82rem' }} placeholder="0" />
            </div>
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
                  <input type="number" min="0" value={payment.amount_paid || ''} onChange={e => setPayment(p => ({ ...p, amount_paid: +e.target.value }))}
                    placeholder={fmt(total)} />
                </div>
                {payment.amount_paid > 0 && (
                  <div className="summary-row" style={{ color: 'var(--green)', fontWeight: 600 }}>
                    <span>{t('change')}</span><span>{fmt(change)} TZS</span>
                  </div>
                )}
              </>
            )}

            <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 12 }} onClick={processSale} disabled={cart.length === 0 || processing}>
              {processing ? t('loading') : `✓ ${t('process_sale')}`}
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {receipt && (
        <div className="modal-overlay receipt-modal">
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>{t('receipt')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setReceipt(null)}><X size={16} /></button>
            </div>
            <div className="modal-body receipt-body">
              <div className="receipt-header">
                <h2>{profile?.shop_name}</h2>
                <p>{new Date().toLocaleString('sw-TZ')}</p>
                {receipt.customer_name && <p>Mteja: {receipt.customer_name}</p>}
              </div>
              <div className="receipt-items">
                {receipt.items?.map(item => (
                  <div key={item.id} className="receipt-row">
                    <span>{item.product_name} ×{item.quantity}</span>
                    <span>{fmt(item.total_price)} TZS</span>
                  </div>
                ))}
              </div>
              <div className="receipt-row"><span>{t('subtotal')}</span><span>{fmt(receipt.subtotal)} TZS</span></div>
              {receipt.discount > 0 && <div className="receipt-row" style={{ color: 'var(--red)' }}><span>{t('discount')}</span><span>-{fmt(receipt.discount)} TZS</span></div>}
              <div className="receipt-row receipt-total"><span>{t('total')}</span><span>{fmt(receipt.total)} TZS</span></div>
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
