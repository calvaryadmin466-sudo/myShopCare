import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import type { Product } from '../types'
import { Plus, Search, Edit2, Trash2, X, Package } from 'lucide-react'

const UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'box', 'pack', 'dozen', 'metre']

const EMPTY: Omit<Product, 'id' | 'shop_id' | 'created_at' | 'updated_at'> = {
  name: '', sku: '', description: '', category: 'General', buying_price: 0, selling_price: 0,
  stock_quantity: 0, unit: 'pcs', low_stock_threshold: 5, image_url: ''
}

function fmt(n: number) { return new Intl.NumberFormat().format(n) }

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="card" style={{ padding: 0, animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i}>
                  <div style={{ height: 12, background: 'var(--border)', borderRadius: 4, width: '60%' }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: cols }).map((_, j) => (
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

export default function Products() {
  const { profile } = useAuth()
  const { t } = useLang()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    const { data } = await supabase.from('products').select('*').eq('shop_id', profile!.shop_id).order('name')
    setProducts(data as Product[] || [])
    setLoading(false)
  }

  function openAdd() { setForm({ ...EMPTY }); setEditing(null); setModal('add'); setError('') }
  function openEdit(p: Product) { setForm({ name: p.name, sku: p.sku || '', description: p.description || '', category: p.category, buying_price: p.buying_price, selling_price: p.selling_price, stock_quantity: p.stock_quantity, unit: p.unit, low_stock_threshold: p.low_stock_threshold, image_url: p.image_url || '' }); setEditing(p); setModal('edit'); setError('') }

  async function save() {
    if (!form.name) { setError('Product name is required'); return }
    setSaving(true)
    const payload = { ...form, category: form.category.trim() || 'General', description: form.description?.trim() || null, buying_price: +form.buying_price, selling_price: +form.selling_price, stock_quantity: +form.stock_quantity, low_stock_threshold: +form.low_stock_threshold, shop_id: profile!.shop_id }
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
    await supabase.from('products').delete().eq('id', id)
    load()
  }

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))]
  const filtered = products.filter(p => {
    const term = search.toLowerCase()
    const matchSearch = p.name.toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term)
    const matchCat = catFilter === 'all' || p.category === catFilter
    return matchSearch && matchCat
  })

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

      {loading ? <TableSkeleton cols={8} /> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t('product_name')}</th>
                  <th>{t('sku')}</th>
                  <th>{t('category')}</th>
                  <th>{t('buying_price')}</th>
                  <th>{t('selling_price')}</th>
                  <th>{t('stock')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><Package /><p>{t('no_data')}</p></div></td></tr>
                ) : filtered.map(p => {
                  const isLow = p.stock_quantity <= p.low_stock_threshold
                  const isOut = p.stock_quantity === 0
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        {p.description && <div style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>{p.description}</div>}
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>{p.sku || '—'}</td>
                      <td><span className="badge badge-blue">{p.category}</span></td>
                      <td>{fmt(p.buying_price)} TZS</td>
                      <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(p.selling_price)} TZS</td>
                      <td>{fmt(p.stock_quantity)} {p.unit}</td>
                      <td>
                        {isOut ? <span className="badge badge-red">{t('out_of_stock')}</span>
                          : isLow ? <span className="badge badge-yellow">Low: {p.stock_quantity}</span>
                            : <span className="badge badge-green">{t('in_stock')}</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}><Edit2 size={13} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(p.id)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('loading') : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
