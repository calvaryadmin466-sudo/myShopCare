import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useBusiness } from '../contexts/BusinessContext'
import { useLang } from '../contexts/LangContext'
import { useTheme } from '../contexts/ThemeContext'
import type { Worker } from '../types'
import { Plus, Trash2, UserCheck, Moon, Sun } from 'lucide-react'
import { AuditLogViewer } from '../components/AuditLogViewer'

function roleBadgeClass(role: string) {
  const r = role.toLowerCase()
  if (r === 'owner') return 'badge-accent'
  if (r === 'manager') return 'badge-blue'
  return 'badge-green'
}

export default function Settings() {
  const { profile, refreshProfile } = useAuth()
  const { currentBusiness } = useBusiness()
  const { t, lang, setLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const [shopName, setShopName] = useState('')
  const [fullName, setFullName] = useState('')
  const [workers, setWorkers] = useState<Worker[]>([])
  const [workerForm, setWorkerForm] = useState({ name: '', phone: '', role: 'seller' })
  const [saving, setSaving] = useState(false)
  const [workerSaving, setWorkerSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [workerError, setWorkerError] = useState('')
  const [activeTab, setActiveTab] = useState<'account' | 'staff' | 'preferences' | 'audit'>('account')

  useEffect(() => {
    if (profile) {
      setShopName(profile.shop_name)
      setFullName(profile.full_name)
    }
  }, [profile])

  useEffect(() => {
    if (currentBusiness?.id) {
      loadWorkers()
    } else {
      setWorkers([])
    }
  }, [currentBusiness?.id])

  async function loadWorkers() {
    if (!currentBusiness?.id) return
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('business_id', currentBusiness.id)
      .order('is_active', { ascending: false })
      .order('name')

    if (error) {
      console.error('Error loading workers:', error)
      setWorkerError('Failed to load workers: ' + error.message)
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
    setErrorMsg('')

    const { error } = await supabase.from('profiles').update({
      shop_name: shopName,
      full_name: fullName
    }).eq('id', profile.id)

    if (!error) {
      await refreshProfile()
      setSuccess(t('success'))
      setTimeout(() => setSuccess(''), 3000)
    } else {
      console.error('Error saving profile:', error)
      setErrorMsg('Failed to save settings: ' + error.message)
    }
    setSaving(false)
  }

  async function handleAddWorker(e: FormEvent) {
    e.preventDefault()
    if (!currentBusiness?.id || !workerForm.name.trim()) return
    setWorkerSaving(true)
    setWorkerError('')

    const { error } = await supabase.from('workers').insert({
      business_id: currentBusiness.id,
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
      setWorkerError('Error saving worker: ' + error.message)
    }
  }

  async function toggleWorker(worker: Worker) {
    setWorkerError('')
    const { error } = await supabase
      .from('workers')
      .update({ is_active: !worker.is_active })
      .eq('id', worker.id)

    if (!error) {
      loadWorkers()
    } else {
      console.error('Error toggling worker:', error)
      setWorkerError('Failed to update worker: ' + error.message)
    }
  }

  async function deleteWorker(worker: Worker) {
    if (!confirm(t('confirm_delete'))) return
    setWorkerError('')
    const { error } = await supabase.from('workers').delete().eq('id', worker.id)
    if (!error) {
      loadWorkers()
    } else {
      console.error('Error deleting worker:', error)
      setWorkerError('Failed to delete worker: ' + error.message)
    }
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>{t('settings')}</h2>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'account' ? 'active' : ''}`} onClick={() => setActiveTab('account')}>Account</button>
        <button className={`tab-btn ${activeTab === 'staff' ? 'active' : ''}`} onClick={() => setActiveTab('staff')}>Staff</button>
        <button className={`tab-btn ${activeTab === 'preferences' ? 'active' : ''}`} onClick={() => setActiveTab('preferences')}>Preferences</button>
        <button className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>{t('audit_log')}</button>
      </div>

      {activeTab === 'audit' ? (
        <AuditLogViewer />
      ) : activeTab === 'preferences' ? (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-title">Preferences</div>
          <div className="form-group">
            <label>Theme</label>
            <button type="button" className="btn btn-ghost" onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
              {theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}
            </button>
          </div>
          <div className="form-group">
            <label>Language</label>
            <div className="lang-toggle">
              <button className={`lang-btn ${lang === 'sw' ? 'active' : ''}`} onClick={() => setLang('sw')}>Kiswahili</button>
              <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>English</button>
            </div>
          </div>
        </div>
      ) : activeTab === 'staff' ? (
      <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCheck size={16} />{t('workers_register')}
        </div>
        {workerError && <div className="alert alert-error">{workerError}</div>}

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
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar-initials sm">{worker.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')}</div>
                      <strong>{worker.name}</strong>
                    </div>
                  </td>
                  <td>{worker.phone || '-'}</td>
                  <td><span className={`badge ${roleBadgeClass(worker.role)}`}>{worker.role}</span></td>
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
      </>
      ) : (
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="card-title">Account</div>
        {success && <div className="alert alert-success">{success}</div>}
        {errorMsg && <div className="alert alert-error">{errorMsg}</div>}

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
      )}
    </div>
  )
}
