import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useBusiness } from '../contexts/BusinessContext'
import { useLang } from '../contexts/LangContext'
import type { Expense } from '../types'
import { Plus, Receipt, Trash2, X, AlertTriangle } from 'lucide-react'

const PAYMENT_METHODS: Expense['payment_method'][] = ['cash', 'mobile_money', 'card', 'bank', 'other']

function fmt(n: number) {
  return new Intl.NumberFormat().format(Math.round(n))
}

function todayDateInput() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function dateInputToIso(d: string) {
  return new Date(`${d}T00:00:00`).toISOString()
}

type FormState = {
  id?: string
  category: string
  description: string
  amount: number
  payment_method: Expense['payment_method']
  expense_date: string
}

const EMPTY: FormState = {
  category: 'General',
  description: '',
  amount: 0,
  payment_method: 'cash',
  expense_date: todayDateInput(),
}

export default function Expenses() {
  const { profile } = useAuth()
  const { currentBusiness, loading: businessLoading } = useBusiness()
  const { t } = useLang()
  const [items, setItems] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>({ ...EMPTY })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const pageSize = 25

  useEffect(() => {
    if (businessLoading) return
    if (profile && currentBusiness?.id) {
      load()
    } else {
      setItems([])
      setTotalCount(0)
      setLoading(false)
    }
  }, [profile, currentBusiness?.id, businessLoading, currentPage])
  useEffect(() => {
    if (profile && currentBusiness?.id) loadTotal()
  }, [profile, currentBusiness?.id])

  async function load() {
    const businessId = currentBusiness?.id
    if (!profile || !businessId) { setLoading(false); return }
    setLoading(true)
    const from = (currentPage - 1) * pageSize
    const to = from + pageSize - 1
    const { data, error, count } = await supabase
      .from('expenses')
      .select('*', { count: 'exact' })
      .eq('business_id', businessId)
      .order('expense_date', { ascending: false })
      .range(from, to)
    if (error) {
      console.error('Error loading expenses:', error)
      setItems([])
      setTotalCount(0)
    } else {
      setItems((data as Expense[]) || [])
      setTotalCount(count || 0)
    }
    setLoading(false)
  }

  // Total amount must reflect ALL matching expenses, not just the current page,
  // so we fetch just the amount column across every record (no row cap).
  async function loadTotal() {
    const businessId = currentBusiness?.id
    if (!profile || !businessId) return
    const { data, error } = await supabase
      .from('expenses')
      .select('amount')
      .eq('business_id', businessId)
    if (error) {
      console.error('Error loading expense totals:', error)
      return
    }
    const sum = (data || []).reduce((s, e: any) => s + Number(e.amount || 0), 0)
    setTotalAmount(sum)
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  function openAdd() {
    setForm({ ...EMPTY })
    setModal(true)
  }

  function openEdit(e: Expense) {
    setForm({
      id: e.id,
      category: e.category || 'General',
      description: e.description || '',
      amount: Number(e.amount || 0),
      payment_method: e.payment_method,
      expense_date: (e.expense_date || e.created_at || new Date().toISOString()).slice(0, 10),
    })
    setModal(true)
  }

  async function save() {
    if (!profile || !currentBusiness?.id) return
    if (!form.category || !form.expense_date) return
    setSaving(true)
    const payload = {
      business_id: currentBusiness.id,
      category: form.category,
      description: form.description || null,
      amount: +form.amount || 0,
      payment_method: form.payment_method,
      expense_date: dateInputToIso(form.expense_date),
    }
    if (form.id) {
      await supabase.from('expenses').update(payload).eq('id', form.id)
    } else {
      await supabase.from('expenses').insert(payload)
    }
    setSaving(false)
    setModal(false)
    setForm({ ...EMPTY })
    load()
    loadTotal()
  }

  async function deleteExpense(id: string) {
    if (!confirm(t('confirm_delete'))) return
    await supabase.from('expenses').delete().eq('id', id)
    load()
    loadTotal()
  }

  if (!businessLoading && !currentBusiness) return (
    <div>
      <div className="page-header">
        <h2><Receipt size={18} />{t('expenses')}</h2>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <AlertTriangle size={48} style={{ color: 'var(--yellow)', marginBottom: 16 }} />
        <h3 style={{ marginBottom: 8 }}>No Business Selected</h3>
        <p style={{ color: 'var(--text3)' }}>Select or create a business from the header to manage expenses.</p>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h2><Receipt size={18} />{t('expenses')}</h2>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} />{t('add_expense')}</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{t('expenses')}</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>{fmt(totalAmount)} TZS</div>
          <div className="stat-sub">{t('amount')}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('category')}</th>
                <th>{t('notes')}</th>
                <th>{t('payment_method')}</th>
                <th>{t('amount')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div style={{ padding: 18 }}>{t('loading')}</div></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><Receipt /><p>{t('no_data')}</p></div></td></tr>
              ) : items.map(e => (
                <tr key={e.id} onClick={() => openEdit(e)} style={{ cursor: 'pointer' }}>
                  <td>
                    <strong>{new Date(e.expense_date || e.created_at).toLocaleDateString('sw-TZ')}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{new Date(e.expense_date || e.created_at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td><span className="badge badge-accent">{e.category}</span></td>
                  <td style={{ maxWidth: 360, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description || '—'}</td>
                  <td>{t(e.payment_method)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(Number(e.amount))} TZS</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={(ev) => { ev.stopPropagation(); deleteExpense(e.id) }}>
                      <Trash2 size={13} />{t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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

      {modal && (
        <div className="modal-overlay" onClick={() => !saving && setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{form.id ? t('edit_expense') : t('add_expense')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => !saving && setModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t('date')}</label>
                <input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('category')}</label>
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="General" />
              </div>
              <div className="form-group">
                <label>{t('notes')}</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('notes')} />
              </div>
              <div className="form-group">
                <label>{t('payment_method')}</label>
                <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as Expense['payment_method'] }))}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{t(m)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>{t('amount')} (TZS)</label>
                <input type="number" min="0" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => !saving && setModal(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('loading') : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

