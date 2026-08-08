import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { uploadProductImage } from '../lib/uploadImage'
import { useAuth } from '../contexts/AuthContext'
import { useBusiness } from '../contexts/BusinessContext'
import { useLang } from '../contexts/LangContext'
import type { Product } from '../types'
import { Plus, Search, Edit2, Trash2, X, Package, Camera, Image as ImageIcon, CalendarX, AlertTriangle } from 'lucide-react'

const UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'box', 'pack', 'dozen', 'metre']

const EMPTY: Omit<Product, 'id' | 'shop_id' | 'created_at' | 'updated_at'> & Pick<Product, 'business_id'> = {
  name: '', sku: '', description: '', category: 'General', buying_price: 0, selling_price: 0,
  stock_quantity: 0, unit: 'pcs', low_stock_threshold: 5, image_url: '',
  expiry_date: '', expiry_days_alert: 30, business_id: '',
}

function fmt(n: number) { return new Intl.NumberFormat().format(n) }

export default function Products() {
  const { profile } = useAuth()
  const { currentBusiness, loading: businessLoading } = useBusiness()
  const { t } = useLang()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Wait for the business context to finish resolving before deciding what to do
    if (businessLoading) return

    if (profile && currentBusiness?.id) {
      load()

      // Set up real-time subscription for product inventory changes, scoped to the selected business
      const businessId = currentBusiness.id
      const subscription = supabase
        .channel('products-inventory-updates')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `business_id=eq.${businessId}`
        }, () => {
          load() // Reload products when inventory changes
        })
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    } else {
      // No business selected/available for this user
      setProducts([])
      setLoading(false)
    }
  }, [profile, currentBusiness?.id, businessLoading])

  async function load() {
    const businessId = currentBusiness?.id
    if (!businessId) { setProducts([]); setLoading(false); return }
    const { data } = await supabase.from('products').select('*').eq('business_id', businessId).order('name')
    setProducts(data as Product[] || [])
    setLoading(false)
  }

  function openAdd() { setForm({ ...EMPTY, business_id: currentBusiness?.id || '' }); setEditing(null); setModal('add'); setError('') }
  function openEdit(p: Product) { setForm({ name: p.name, sku: p.sku || '', description: p.description || '', category: p.category, buying_price: p.buying_price, selling_price: p.selling_price, stock_quantity: p.stock_quantity, unit: p.unit, low_stock_threshold: p.low_stock_threshold, image_url: p.image_url || '', expiry_date: p.expiry_date || '', expiry_days_alert: p.expiry_days_alert ?? 30, business_id: p.business_id || p.shop_id || '' }); setEditing(p); setModal('edit'); setError('') }

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!currentBusiness?.id) { setError('No business selected'); return }
    setUploading(true); setError('')
    try {
      const url = await uploadProductImage(file, currentBusiness.id)
      setForm(f => ({ ...f, image_url: url }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed')
    }
    setUploading(false)
  }

  async function save() {
    if (!form.name) { setError('Product name is required'); return }
    if (!currentBusiness?.id) { setError('No business selected'); return }
    const buyingPrice = +form.buying_price
    const sellingPrice = +form.selling_price
    const stockQuantity = +form.stock_quantity
    if (buyingPrice < 0 || sellingPrice < 0 || stockQuantity < 0) {
      setError('Buying price, selling price and stock quantity cannot be negative')
      return
    }
    if (sellingPrice < buyingPrice) {
      setError('Selling price cannot be less than buying price')
      return
    }
    setSaving(true)
    const payload = { ...form, business_id: currentBusiness.id, category: form.category.trim() || 'General', description: form.description?.trim() || null, image_url: form.image_url || null, buying_price: buyingPrice, selling_price: sellingPrice, stock_quantity: stockQuantity, low_stock_threshold: +form.low_stock_threshold, expiry_date: form.expiry_date || null, expiry_days_alert: +form.expiry_days_alert || 30, shop_id: profile!.shop_id }
    if (editing) {
      const { error: err } = await supabase.from('products').update(payload).eq('id', editing.id)
      if (err) { setError(err.message || 'Error updating product'); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('products').insert(payload)
      if (err) { setError(err.message || 'Error adding product'); setSaving(false); return }
    }
    setSaving(false)
    setModal(null)
    load()
  }

  async function deleteProduct(id: string) {
    if (!confirm(t('confirm_delete'))) return
    const { error: err } = await supabase.from('products').delete().eq('id', id)
    if (err) {
      if (err.code === '23503') {
        alert('Cannot delete: this product has sales history')
      } else {
        alert(err.message || 'Error deleting product')
      }
      return
    }
    load()
  }

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))]
  const filtered = products.filter(p => {
    const term = search.toLowerCase()
    const matchSearch = p.name.toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term)
    const matchCat = catFilter === 'all' || p.category === catFilter
    return matchSearch && matchCat
  })

  if (!businessLoading && !currentBusiness) return (
    <div>
      <div className="page-header">
        <h2><Package size={20} />{t('products')}</h2>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <AlertTriangle size={48} style={{ color: 'var(--yellow)', marginBottom: 16 }} />
        <h3 style={{ marginBottom: 8 }}>No Business Selected</h3>
        <p style={{ color: 'var(--text3)' }}>Select or create a business from the header to manage products.</p>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h2><Package size={20} />{t('products')}</h2>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} />{t('add_product')}</button>
      </div>

      <div className="filters" style={{ marginBottom: 16 }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
          <Search />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} />
        </div>
        {categories.map(c => (
          <button key={c} className={`filter-chip ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>
            {c === 'all' ? t('all_categories') : c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="product-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="product-tile skeleton" style={{ height: 210 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="empty-state"><Package /><p>{t('no_data')}</p></div></div>
      ) : (
        <div className="product-grid">
          {filtered.map(p => {
            const isLow = p.stock_quantity <= p.low_stock_threshold
            const isOut = p.stock_quantity === 0

            // expiry logic
            const today = new Date(); today.setHours(0,0,0,0)
            const expDate = p.expiry_date ? (() => { const d = new Date(p.expiry_date + 'T00:00:00'); d.setHours(0,0,0,0); return d })() : null
            const daysLeft = expDate ? Math.round((expDate.getTime() - today.getTime()) / 86400000) : null
            const isExpired = daysLeft !== null && daysLeft < 0
            const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= (p.expiry_days_alert ?? 30)

            return (
              <div key={p.id} className={`product-tile inventory-tile ${isLow ? 'low-stock' : ''}`} onClick={() => openEdit(p)}>
                <div className="inventory-tile-media">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} />
                    : <div className="inventory-tile-placeholder"><Package size={26} /></div>}
                  <div className="inventory-tile-actions" onClick={e => e.stopPropagation()}>
                    <button className="icon-btn" onClick={() => openEdit(p)}><Edit2 size={13} /></button>
                    <button className="icon-btn danger" onClick={() => deleteProduct(p.id)}><Trash2 size={13} /></button>
                  </div>
                  {isOut ? (
                    <span className="badge badge-red inventory-tile-badge">{t('out_of_stock')}</span>
                  ) : isLow ? (
                    <span className="badge badge-yellow inventory-tile-badge">Low Stock</span>
                  ) : null}
                </div>
                <div className="p-name">{p.name}</div>
                <div className="p-cat">{p.category}{p.sku ? ` • ${p.sku}` : ''}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
                  <span className="p-stock" style={isLow ? { color: 'var(--red)', fontWeight: 600 } : undefined}>
                    {isLow ? `${fmt(p.stock_quantity)} / Min ${fmt(p.low_stock_threshold)}` : `${fmt(p.stock_quantity)} ${p.unit}`}
                  </span>
                  <span className="p-price">{fmt(p.selling_price)}</span>
                </div>
                {p.expiry_date && (isExpired || isExpiringSoon) && (
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, marginTop: 6, color: isExpired ? 'var(--red)' : '#f97316' }}>
                    <CalendarX size={11} />
                    {isExpired ? t('expired') : (daysLeft === 0 ? t('expires_today') : `${daysLeft}d`)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="modal">
            <div className="modal-header">
              <h3>{modal === 'add' ? t('add_product') : t('edit_product')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label>{t('product_image')}</label>
                <div className="image-upload">
                  {form.image_url
                    ? <img src={form.image_url} alt="" className="image-preview" />
                    : <div className="image-placeholder"><ImageIcon size={24} /></div>}
                  <div className="image-upload-actions">
                    <label className={`btn btn-ghost btn-sm ${uploading ? 'disabled' : ''}`} style={{ cursor: uploading ? 'wait' : 'pointer' }}>
                      <Camera size={14} />
                      {uploading ? t('uploading') : form.image_url ? t('change_photo') : t('upload_photo')}
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={pickImage} />
                    </label>
                    {form.image_url && !uploading && (
                      <button className="btn btn-danger btn-sm" onClick={() => setForm(f => ({ ...f, image_url: '' }))}>
                        <Trash2 size={13} />{t('remove')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>{t('product_name')} *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('sku')}</label>
                  <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{t('category')}</label>
                  <input list="product-categories" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                  <datalist id="product-categories">
                    {categories.filter(c => c !== 'all').map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>
              <div className="form-group">
                <label>{t('description')}</label>
                <textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('buying_price')} (TZS)</label>
                  <input type="number" min="0" value={form.buying_price} onChange={e => setForm(f => ({ ...f, buying_price: +e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{t('selling_price')} (TZS)</label>
                  <input type="number" min="0" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: +e.target.value }))} />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('stock')}</label>
                  <input type="number" min="0" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: +e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{t('unit')}</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>{t('low_stock_alert')}</label>
                <input type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: +e.target.value }))} />
              </div>
              <div className="divider" />
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                {t('expiry_tracking')}
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('expiry_date')}</label>
                  <input type="date" value={form.expiry_date || ''} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{t('expiry_days_alert')}</label>
                  <input type="number" min="1" max="365" value={form.expiry_days_alert ?? 30} onChange={e => setForm(f => ({ ...f, expiry_days_alert: +e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || uploading}>{saving ? t('loading') : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
