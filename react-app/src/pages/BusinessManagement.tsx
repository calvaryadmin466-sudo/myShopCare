import { useRef, useState } from 'react'
import { useBusiness } from '../contexts/BusinessContext'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { uploadBusinessLogo, deleteBusinessLogo } from '../lib/logoUpload'
import type { Business } from '../types'
import { Building2, Plus, Edit2, Settings, Image as ImageIcon, Trash2, X, Upload, Copy, Check } from 'lucide-react'

const COLOR_OPTIONS = [
  '#F7B23B', '#3B82F6', '#10B981', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B',
]

export default function BusinessManagement() {
  const { businesses, currentBusiness, setCurrentBusiness, createBusiness, updateBusiness, deleteBusiness, refreshBusinesses } = useBusiness()
  const { user } = useAuth()
  const { t, lang } = useLang()

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)

    if (diffDays <= 0) return t('today')
    if (diffDays === 1) return t('yesterday')
    if (diffDays < 7) return `${diffDays} ${t('days_ago_suffix')}`
    return date.toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const [modal, setModal] = useState<'create' | 'edit' | 'settings' | 'logo' | null>(null)
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: '',
    themeColor: '#F7B23B',
    currency: 'TZS' as 'USD' | 'TZS' | 'KSH',
  })

  async function uploadLogoFile(file: File, business: Business) {
    if (!file.type.startsWith('image/')) { setError(t('file_must_be_image')); return }
    if (file.size > 5 * 1024 * 1024) { setError(t('file_size_limit')); return }

    setIsUploading(true)
    setUploadProgress(0)
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) { clearInterval(progressInterval); return 90 }
        return prev + 10
      })
    }, 100)

    try {
      // Clean up the previous logo (if any) so files don't orphan in storage
      if (business.logo_url) await deleteBusinessLogo(business.id)

      const result = await uploadBusinessLogo(file, business.id)
      clearInterval(progressInterval)
      setUploadProgress(100)

      if (result.error) {
        setError(result.error)
      } else {
        await updateBusiness(business.id, { logo_url: result.url })
        await refreshBusinesses()
      }
    } finally {
      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
        setModal(null)
      }, 400)
    }
  }

  function openCreateModal() {
    setFormData({ name: '', themeColor: '#F7B23B', currency: 'TZS' })
    setError(null)
    setModal('create')
  }

  function openEditModal(business: Business) {
    setEditingBusiness(business)
    setFormData({ name: business.name, themeColor: business.theme_color, currency: business.currency })
    setError(null)
    setModal('edit')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const result = await createBusiness(formData.name, formData.themeColor, formData.currency)
      if (result.error) { setError(result.error); return }
      setModal(null)
      await refreshBusinesses()
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingBusiness) return
    setLoading(true)
    setError(null)
    try {
      const result = await updateBusiness(editingBusiness.id, {
        name: formData.name,
        theme_color: formData.themeColor,
        currency: formData.currency,
      })
      if (result.error) { setError(result.error); return }
      setModal(null)
      setEditingBusiness(null)
      await refreshBusinesses()
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(businessId: string) {
    if (!confirm(t('confirm_delete_business'))) return
    setLoading(true)
    setError(null)
    try {
      const result = await deleteBusiness(businessId)
      if (result.error) setError(result.error)
      else await refreshBusinesses()
    } finally {
      setLoading(false)
    }
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><Building2 size={20} />{t('biz_management_title')}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text3)', marginTop: 4 }}>
            {t('biz_management_subtitle')}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}><Plus size={16} />{t('add_business')}</button>
      </div>

      {error && !modal && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}><Building2 /></div>
          <div className="stat-label">{t('businesses')}</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{businesses.length}</div>
          <div className="stat-sub">{t('total_organizations')}</div>
        </div>
      </div>

      {businesses.length === 0 ? (
        <div className="card empty-state">
          <Building2 />
          <p>{t('no_businesses_yet')}</p>
          <div className="empty-action">
            <button className="btn btn-primary" onClick={openCreateModal}><Plus size={16} />{t('create_business')}</button>
          </div>
        </div>
      ) : (
        <div className="biz-grid">
          {businesses.map(business => {
            const isActive = currentBusiness?.id === business.id
            return (
              <div className="card biz-card" key={business.id}>
                <div className="biz-card-top">
                  <div className="biz-logo" style={{ background: business.logo_url ? 'transparent' : `linear-gradient(135deg, ${business.theme_color}30, ${business.theme_color}15)` }}>
                    {business.logo_url
                      ? <img src={business.logo_url} alt={business.name} />
                      : <Building2 size={28} style={{ color: business.theme_color }} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="biz-card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{business.name}</div>
                    <span className={`badge ${isActive ? 'badge-green' : 'badge-yellow'}`}>● {isActive ? t('active') : t('inactive')}</span>
                  </div>
                </div>

                <div className="biz-details">
                  <div className="summary-row"><span>{t('currency')}</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{business.currency}</span></div>
                  <div className="summary-row">
                    <span>{t('brand_color')}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 14, height: 14, borderRadius: 4, background: business.theme_color, display: 'inline-block' }} />
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{business.theme_color}</span>
                    </span>
                  </div>
                  <div className="summary-row"><span>{t('created')}</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{formatDate(business.created_at)}</span></div>
                  <div className="summary-row"><span>{t('updated')}</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{formatDate(business.updated_at)}</span></div>
                </div>

                <div className="biz-actions">
                  <div className="biz-actions-row">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(business)}><Edit2 size={13} />{t('edit_business')}</button>
                    {!isActive && (
                      <button className="btn btn-primary btn-sm" onClick={() => setCurrentBusiness(business)}>{t('switch_business') || 'Switch'}</button>
                    )}
                  </div>
                  <div className="biz-actions-row">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditingBusiness(business); setError(null); setModal('settings') }}><Settings size={13} />{t('settings')}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditingBusiness(business); setError(null); setModal('logo') }}><ImageIcon size={13} />{t('upload_logo')}</button>
                  </div>
                  <button className="btn btn-danger" onClick={() => handleDelete(business.id)} disabled={loading}><Trash2 size={14} />{t('delete')}</button>
                </div>
              </div>
            )
          })}
          <div className="card card-dashed" onClick={openCreateModal}>
            <Plus size={28} />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('add_business')}</span>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {modal === 'create' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('create_new_business')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label>{t('business_name_label')}</label>
                  <input type="text" required autoFocus value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder={t('my_business_placeholder')} />
                </div>
                <div className="form-group">
                  <label>{t('currency')}</label>
                  <select value={formData.currency} onChange={e => setFormData(f => ({ ...f, currency: e.target.value as any }))}>
                    <option value="USD">USD ($)</option>
                    <option value="TZS">TZS (TSh)</option>
                    <option value="KSH">KSH (KSh)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('brand_color')}</label>
                  <div className="color-swatches">
                    {COLOR_OPTIONS.map(color => (
                      <button key={color} type="button" className={`color-swatch ${formData.themeColor === color ? 'active' : ''}`} style={{ background: color }} onClick={() => setFormData(f => ({ ...f, themeColor: color }))} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="color" value={formData.themeColor} onChange={e => setFormData(f => ({ ...f, themeColor: e.target.value }))} style={{ width: 44, height: 36, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)' }} />
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{formData.themeColor}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? t('creating') : t('create_business')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {modal === 'edit' && editingBusiness && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('edit_business')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label>{t('business_name_label')}</label>
                  <input type="text" required autoFocus value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{t('currency')}</label>
                  <select value={formData.currency} onChange={e => setFormData(f => ({ ...f, currency: e.target.value as any }))}>
                    <option value="USD">USD ($)</option>
                    <option value="TZS">TZS (TSh)</option>
                    <option value="KSH">KSH (KSh)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('brand_color')}</label>
                  <div className="color-swatches">
                    {COLOR_OPTIONS.map(color => (
                      <button key={color} type="button" className={`color-swatch ${formData.themeColor === color ? 'active' : ''}`} style={{ background: color }} onClick={() => setFormData(f => ({ ...f, themeColor: color }))} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="color" value={formData.themeColor} onChange={e => setFormData(f => ({ ...f, themeColor: e.target.value }))} style={{ width: 44, height: 36, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)' }} />
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{formData.themeColor}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? t('saving') : t('save_changes')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logo Upload Modal */}
      {modal === 'logo' && editingBusiness && (
        <div className="modal-overlay" onClick={() => !isUploading && setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('upload_logo')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)} disabled={isUploading}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div
                className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={async e => {
                  e.preventDefault()
                  setIsDragging(false)
                  const file = e.dataTransfer.files[0]
                  if (file && editingBusiness) await uploadLogoFile(file, editingBusiness)
                }}
              >
                <Upload size={40} style={{ color: 'var(--accent)', marginBottom: 12 }} />
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('drag_logo_here')}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text3)', marginBottom: 8 }}>
                  or <span className="browse-link" onClick={() => fileInputRef.current?.click()}>{t('browse_files')}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{t('logo_upload_hint')}</div>
                {isUploading && (
                  <>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${uploadProgress}%` }} /></div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600, marginTop: 6 }}>{uploadProgress}%</div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={isUploading}
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file && editingBusiness) await uploadLogoFile(file, editingBusiness)
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings / Info Modal */}
      {modal === 'settings' && editingBusiness && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('business_settings')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="info-row">
                <div className="info-row-label">{t('business_id')}</div>
                <div className="info-row-copy">
                  <span className="info-row-value mono">{editingBusiness.id}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => copyId(editingBusiness.id)}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
              <div className="info-row">
                <div className="info-row-label">{t('owner_id')}</div>
                <div className="info-row-value mono">{editingBusiness.owner_id}</div>
              </div>
              <div className="info-row">
                <div className="info-row-label">{t('created')}</div>
                <div className="info-row-value">{formatDate(editingBusiness.created_at)}</div>
              </div>
              <div className="info-row">
                <div className="info-row-label">{t('last_updated')}</div>
                <div className="info-row-value">{formatDate(editingBusiness.updated_at)}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>{t('close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
