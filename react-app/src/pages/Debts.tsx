import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import type { Debt, DebtPayment } from '../types'
import { Plus, Search, Calendar, Landmark, CheckCircle, Clock, X, Eye } from 'lucide-react'

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

export default function Debts() {
  const { profile } = useAuth()
  const { t } = useLang()
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paid' | 'overdue'>('all')

  const [modal, setModal] = useState<'add' | 'pay' | 'details' | null>(null)
  const [selected, setSelected] = useState<Debt | null>(null)
  const [payments, setPayments] = useState<DebtPayment[]>([])

  const [addForm, setAddForm] = useState({ customer_name: '', customer_phone: '', original_amount: 0, due_date: '', notes: '' })
  const [payForm, setPayForm] = useState({ amount: 0, payment_method: 'cash', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    const { data } = await supabase.from('debts').select('*').eq('shop_id', profile!.shop_id).order('created_at', { ascending: false })
    setDebts(data as Debt[] || [])
    setLoading(false)
  }

  async function loadPayments(debtId: string) {
    const { data } = await supabase.from('debt_payments').select('*').eq('debt_id', debtId).order('created_at', { ascending: false })
    setPayments(data as DebtPayment[] || [])
  }

  async function handleAddDebt() {
    if (!addForm.customer_name || !addForm.original_amount) return
    setSaving(true)
    const { error } = await supabase.from('debts').insert({
      ...addForm,
      original_amount: +addForm.original_amount,
      amount_paid: 0,
      shop_id: profile!.shop_id,
      status: 'active'
    })
    setSaving(false)
    if (!error) { setModal(null); setAddForm({ customer_name: '', customer_phone: '', original_amount: 0, due_date: '', notes: '' }); load() }
  }

  async function handleRecordPayment() {
    if (!selected || !payForm.amount) return
    setSaving(true)

    // Insert payment
    const { error: payErr } = await supabase.from('debt_payments').insert({
      debt_id: selected.id,
      amount: +payForm.amount,
      payment_method: payForm.payment_method,
      notes: payForm.notes
    })

    if (payErr) {
      console.error('Error recording payment:', payErr)
      alert('Error recording payment: ' + payErr.message)
      setSaving(false)
      return
    }

    // Update debt
    const newPaid = selected.amount_paid + +payForm.amount
    const newStatus = newPaid >= selected.original_amount ? 'paid' : selected.status

    const { error: debtErr } = await supabase.from('debts').update({
      amount_paid: newPaid,
      status: newStatus
    }).eq('id', selected.id)

    if (debtErr) {
      console.error('Error updating debt:', debtErr)
      alert('Error updating debt record: ' + debtErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setModal(null)
    setPayForm({ amount: 0, payment_method: 'cash', notes: '' })
    load()
  }

  const filtered = debts.filter(d => {
    const matchSearch = d.customer_name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || d.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div>
      <div className="page-header">
        <h2>💳 {t('debts')}</h2>
        <button className="btn btn-primary" onClick={() => setModal('add')}><Plus size={16} />{t('add_debt')}</button>
      </div>

      <div className="filters" style={{ marginBottom: 16 }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
          <Search />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} />
        </div>
        {(['all', 'active', 'paid', 'overdue'] as const).map(s => (
          <button key={s} className={`filter-chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
            {t(s === 'all' ? 'all_debts' : s)}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton cols={7} /> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t('customer_name_')}</th>
                  <th>{t('original_amount')}</th>
                  <th>{t('amount_paid_')}</th>
                  <th>{t('balance')}</th>
                  <th>{t('due_date')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><Landmark /><p>{t('no_data')}</p></div></td></tr>
                ) : filtered.map(d => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.customer_name}</strong>
                      {d.customer_phone && <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{d.customer_phone}</div>}
                    </td>
                    <td>{fmt(d.original_amount)} TZS</td>
                    <td>{fmt(d.amount_paid)} TZS</td>
                    <td style={{ fontWeight: 600, color: d.balance > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(d.balance)} TZS</td>
                    <td>{d.due_date ? new Date(d.due_date).toLocaleDateString('sw-TZ') : '—'}</td>
                    <td>
                      {d.status === 'paid' ? <span className="badge badge-green">{t('paid')}</span>
                        : d.status === 'overdue' ? <span className="badge badge-red">{t('overdue')}</span>
                          : <span className="badge badge-yellow">{t('active')}</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(d); loadPayments(d.id); setModal('details') }}><Eye size={13} /></button>
                        {d.balance > 0 && (
                          <button className="btn btn-success btn-sm" onClick={() => { setSelected(d); setModal('pay') }}>✓ {t('record_payment')}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Debt Modal */}
      {modal === 'add' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('add_debt')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t('customer_name_')} *</label>
                <input value={addForm.customer_name} onChange={e => setAddForm(f => ({ ...f, customer_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('customer_phone')}</label>
                <input value={addForm.customer_phone} onChange={e => setAddForm(f => ({ ...f, customer_phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('original_amount')} * (TZS)</label>
                <input type="number" value={addForm.original_amount || ''} onChange={e => setAddForm(f => ({ ...f, original_amount: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('due_date')}</label>
                <input type="date" value={addForm.due_date} onChange={e => setAddForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('notes')}</label>
                <textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handleAddDebt} disabled={saving}>{saving ? t('loading') : t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Debt Modal */}
      {modal === 'pay' && selected && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('record_payment')} - {selected.customer_name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="summary-row"><span>{t('balance')}</span><strong>{fmt(selected.balance)} TZS</strong></div>
              <div className="divider" />
              <div className="form-group">
                <label>{t('payment_amount')} * (TZS)</label>
                <input type="number" max={selected.balance} value={payForm.amount || ''} onChange={e => setPayForm(f => ({ ...f, amount: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('payment_method')}</label>
                <select value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}>
                  <option value="cash">{t('cash')}</option>
                  <option value="mobile_money">{t('mobile_money')}</option>
                  <option value="card">{t('card')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('notes')}</label>
                <input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handleRecordPayment} disabled={saving}>{saving ? t('loading') : t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {modal === 'details' && selected && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selected.customer_name} — Info</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="summary-row"><span>{t('original_amount')}</span><span>{fmt(selected.original_amount)} TZS</span></div>
              <div className="summary-row"><span>{t('amount_paid_')}</span><span>{fmt(selected.amount_paid)} TZS</span></div>
              <div className="summary-row"><span>{t('balance')}</span><strong style={{ color: 'var(--red)' }}>{fmt(selected.balance)} TZS</strong></div>
              {selected.due_date && <div className="summary-row"><span>{t('due_date')}</span><span>{new Date(selected.due_date).toLocaleDateString()}</span></div>}
              {selected.notes && <div style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--text2)' }}><strong>Note:</strong> {selected.notes}</div>}

              <div className="divider" />
              <h4>{t('payment_history')}</h4>
              {payments.length === 0 ? <p style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>No payments yet</p> : (
                <div style={{ marginTop: 10 }}>
                  {payments.map(p => (
                    <div key={p.id} className="summary-row" style={{ borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{fmt(p.amount)} TZS</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{p.payment_method} {p.notes ? `(${p.notes})` : ''}</div>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
