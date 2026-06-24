import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import type { Worker } from '../types'
import { Plus, Trash2, UserCheck } from 'lucide-react'

export default function Settings() {
  const { profile, refreshProfile } = useAuth()
  const { t } = useLang()
  const [shopName, setShopName] = useState('')
  const [fullName, setFullName] = useState('')
  const [workers, setWorkers] = useState<Worker[]>([])
  const [workerForm, setWorkerForm] = useState({ name: '', phone: '', role: 'seller' })
  const [saving, setSaving] = useState(false)
  const [workerSaving, setWorkerSaving] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (profile) {
      setShopName(profile.shop_name)
      setFullName(profile.full_name)
      loadWorkers()
    }
  }, [profile])

  async function loadWorkers() {
    if (!profile) return
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('shop_id', profile.shop_id)
      .order('is_active', { ascending: false })
      .order('name')

    if (error) {
      console.error('Error loading workers:', error)
      setWorkers([])
      return
    }
    setWorkers(data as Worker[] || [])
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setSuccess('')

    const { error } = await supabase.from('profiles').update({
      shop_name: shopName,
      full_name: fullName
    }).eq('id', profile.id)

    if (!error) {
      await refreshProfile()
      setSuccess(t('success'))
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  async function handleAddWorker(e: FormEvent) {
    e.preventDefault()
    if (!profile || !workerForm.name.trim()) return
    setWorkerSaving(true)

    const { error } = await supabase.from('workers').insert({
      shop_id: profile.shop_id,
      name: workerForm.name.trim(),
      phone: workerForm.phone.trim() || null,
      role: workerForm.role.trim() || 'seller',
      is_active: true,
    })

    setWorkerSaving(false)
    if (!error) {
      setWorkerForm({ name: '', phone: '', role: 'seller' })
      loadWorkers()
    } else {
      alert('Error saving worker: ' + error.message)
    }
  }

  async function toggleWorker(worker: Worker) {
    const { error } = await supabase
      .from('workers')
      .update({ is_active: !worker.is_active })
      .eq('id', worker.id)

    if (!error) loadWorkers()
  }

  async function deleteWorker(worker: Worker) {
    if (!confirm(t('confirm_delete'))) return
    const { error } = await supabase.from('workers').delete().eq('id', worker.id)
    if (!error) loadWorkers()
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>{t('settings')}</h2>
      </div>

      <div className="settings-grid">
        <div className="card">
          <div className="card-title">{t('settings')}</div>
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>{t('shop_name')}</label>
              <input value={shopName} onChange={e => setShopName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>{t('full_name')}</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>{t('email')}</label>
              <input value={profile?.email || ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>

            <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 10 }}>
              {saving ? t('loading') : t('save')}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={16} />{t('workers_register')}
          </div>

          <form onSubmit={handleAddWorker}>
            <div className="form-group">
              <label>{t('worker_name')}</label>
              <input value={workerForm.name} onChange={e => setWorkerForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>{t('customer_phone')}</label>
                <input value={workerForm.phone} onChange={e => setWorkerForm(f => ({ ...f, phone: e.target.value }))} placeholder="+255..." />
              </div>
              <div className="form-group">
                <label>{t('role')}</label>
                <input value={workerForm.role} onChange={e => setWorkerForm(f => ({ ...f, role: e.target.value }))} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={workerSaving}>
              <Plus size={16} />{workerSaving ? t('loading') : t('add_worker')}
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t('worker_name')}</th>
                <th>{t('customer_phone')}</th>
                <th>{t('role')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {workers.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state"><UserCheck /><p>{t('no_workers')}</p></div></td></tr>
              ) : workers.map(worker => (
                <tr key={worker.id}>
                  <td><strong>{worker.name}</strong></td>
                  <td>{worker.phone || '-'}</td>
                  <td>{worker.role}</td>
                  <td>
                    {worker.is_active
                      ? <span className="badge badge-green">{t('active')}</span>
                      : <span className="badge badge-red">{t('inactive')}</span>}
                  </td>
                  <td>
                    <div className="worker-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleWorker(worker)}>
                        {worker.is_active ? t('deactivate') : t('activate')}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteWorker(worker)}>
                        <Trash2 size={13} />{t('delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
