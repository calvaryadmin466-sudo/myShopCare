import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import type { Deal } from '../types'
import { Plus, Tag, Trash2, X, Check, Calendar } from 'lucide-react'

const DEAL_TYPES = [
  { v: 'percentage', l: 'percentage' },
  { v: 'fixed', l: 'fixed' },
  { v: 'bogo', l: 'bogo' },
  { v: 'bundle', l: 'bundle' },
]

const EMPTY: Omit<Deal, 'id' | 'shop_id' | 'created_at' | 'usage_count'> = {
  name: '', description: '', deal_type: 'percentage', discount_value: 0,
  min_purchase: 0, applicable_products: [], start_date: '', end_date: '', is_active: true
}

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

export default function Deals() {
  const { profile } = useAuth()
  const { t } = useLang()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    const { data } = await supabase.from('deals').select('*').eq('shop_id', profile!.shop_id).order('created_at', { ascending: false })
    setDeals(data as Deal[] || [])
    setLoading(false)
  }

  async function save() {
    if (!form.name || !form.start_date || !form.end_date) return
    setSaving(true)
    await supabase.from('deals').insert({
      ...form,
      discount_value: +form.discount_value,
      min_purchase: form.min_purchase ? +form.min_purchase : null,
      shop_id: profile!.shop_id
    })
    setSaving(false)
    setModal(false)
    setForm({ ...EMPTY })
    load()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('deals').update({ is_active: !active }).eq('id', id)
    load()
  }

  async function deleteDeal(id: string) {
    if (!confirm(t('confirm_delete'))) return
    await supabase.from('deals').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <h2>🏷️ {t('deals')}</h2>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={16} />{t('add_deal')}</button>
      </div>

      {loading ? <TableSkeleton cols={8} /> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t('deal_name')}</th>
                  <th>{t('deal_type')}</th>
                  <th>{t('discount_value')}</th>
                  <th>{t('start_date')}</th>
                  <th>{t('end_date')}</th>
                  <th>{t('status')}</th>
                  <th>{t('usage')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {deals.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><Tag /><p>{t('no_data')}</p></div></td></tr>
                ) : deals.map(d => {
                  const expired = new Date(d.end_date) < new Date()
                  return (
                    <tr key={d.id} style={{ opacity: expired || !d.is_active ? 0.6 : 1 }}>
                      <td>
                        <strong>{d.name}</strong>
                        {d.description && <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{d.description}</div>}
                      </td>
                      <td><span className="badge badge-blue">{t(d.deal_type)}</span></td>
                      <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                        {d.deal_type === 'percentage' ? `${d.discount_value}%` : `${new Intl.NumberFormat().format(d.discount_value)} TZS`}
                      </td>
                      <td>{new Date(d.start_date).toLocaleDateString()}</td>
                      <td>{new Date(d.end_date).toLocaleDateString()}</td>
                      <td>
                        {expired ? <span className="badge badge-red">{t('expired')}</span>
                          : d.is_active ? <span className="badge badge-green">{t('active_deals')}</span>
                            : <span className="badge badge-yellow">Inactive</span>}
                      </td>
                      <td>{d.usage_count}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className={`btn btn-sm ${d.is_active ? 'btn-ghost' : 'btn-success'}`} onClick={() => toggleActive(d.id, d.is_active)}>
                            {d.is_active ? 'Pause' : 'Activate'}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteDeal(d.id)}><Trash2 size={13} /></button>
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
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('add_deal')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t('deal_name')} *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Krismasi Punguzo" />
              </div>
              <div className="form-group">
                <label>{t('notes')}</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('deal_type')}</label>
                  <select value={form.deal_type} onChange={e => setForm(f => ({ ...f, deal_type: e.target.value as any }))}>
                    {DEAL_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('discount_value')} * ({form.deal_type === 'percentage' ? '%' : 'TZS'})</label>
                  <input type="number" value={form.discount_value || ''} onChange={e => setForm(f => ({ ...f, discount_value: +e.target.value }))} />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('start_date')} *</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{t('end_date')} *</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('loading') : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
