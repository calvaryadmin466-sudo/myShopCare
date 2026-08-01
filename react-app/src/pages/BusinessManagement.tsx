import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBusiness } from '../contexts/BusinessContext'
import { useAuth } from '../contexts/AuthContext'
import { uploadBusinessLogo, deleteBusinessLogo } from '../lib/logoUpload'
import { Building2, Plus, Edit, Settings, Users, Image as ImageIcon, Trash2, X, Archive, BarChart3, DollarSign, Calendar, Clock, Palette, Upload } from 'lucide-react'

function fmt(n: number) {
  return new Intl.NumberFormat('sw-TZ', { style: 'decimal', maximumFractionDigits: 0 }).format(n)
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BusinessManagement() {
  const { businesses, currentBusiness, createBusiness, updateBusiness, deleteBusiness, refreshBusinesses } = useBusiness()
  const { user } = useAuth()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showLogoUploadModal, setShowLogoUploadModal] = useState(false)
  const [editingBusiness, setEditingBusiness] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: '',
    themeColor: '#F7B23B',
    currency: 'TZS' as 'USD' | 'TZS' | 'KSH'
  })

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, business: any) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 100)

    try {
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
        setShowLogoUploadModal(false)
      }, 500)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const result = await createBusiness(formData.name, formData.themeColor, formData.currency)
      if (result.error) {
        setError(result.error)
      } else {
        setShowCreateModal(false)
        setFormData({ name: '', themeColor: '#F7B23B', currency: 'TZS' })
        await refreshBusinesses()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBusiness) return

    setLoading(true)
    setError(null)

    try {
      const result = await updateBusiness(editingBusiness.id, {
        name: formData.name,
        theme_color: formData.themeColor,
        currency: formData.currency
      })
      if (result.error) {
        setError(result.error)
      } else {
        setShowEditModal(false)
        setEditingBusiness(null)
        await refreshBusinesses()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (businessId: string) => {
    if (!confirm('Are you sure you want to delete this business? This action cannot be undone.')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await deleteBusiness(businessId)
      if (result.error) {
        setError(result.error)
      } else {
        await refreshBusinesses()
      }
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (business: any) => {
    setEditingBusiness(business)
    setFormData({
      name: business.name,
      themeColor: business.theme_color,
      currency: business.currency
    })
    setShowEditModal(true)
  }

  const colorOptions = [
    '#F7B23B', // Gold/Amber
    '#3B82F6', // Blue
    '#10B981', // Green
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F59E0B', // Orange
  ]

  const EmptyState = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 px-6"
    >
      <div className="w-24 h-24 mb-6 rounded-full bg-[var(--bg2)] border border-[var(--border)] flex items-center justify-center">
        <Building2 size={48} style={{ color: 'var(--accent)' }} />
      </div>
      <h2 className="text-2xl font-bold mb-2">No Businesses Yet</h2>
      <p className="text-[var(--text3)] text-center max-w-md mb-8">
        Create your first business to start managing invoices, customers, products, and reports.
      </p>
      <button
        onClick={() => setShowCreateModal(true)}
        className="btn btn-primary"
        style={{ padding: '12px 32px' }}
      >
        <Plus size={20} />
        Create Business
      </button>
    </motion.div>
  )

  const BusinessCard = ({ business }: { business: any }) => {
    const isActive = currentBusiness?.id === business.id

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3 }}
        transition={{ duration: 0.3 }}
        className="card"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div 
              className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
              style={{ 
                background: business.logo_url 
                  ? 'transparent' 
                  : `linear-gradient(135deg, ${business.theme_color}30, ${business.theme_color}15)`
              }}
            >
              {business.logo_url ? (
                <img 
                  src={business.logo_url} 
                  alt={business.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 size={32} style={{ color: business.theme_color }} />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold mb-1">{business.name}</h3>
              <span 
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: isActive ? '#10B981' : '#F59E0B',
                  border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                }}
              >
                ● {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-6" style={{ fontSize: '0.875rem', color: 'var(--text2)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text3)' }}>Currency</span>
            <span className="font-medium">{business.currency}</span>
          </div>
          <div className="flex justify-between items-center">
            <span style={{ color: 'var(--text3)' }}>Brand Color</span>
            <div className="flex items-center gap-2">
              <div 
                className="w-6 h-6 rounded"
                style={{ backgroundColor: business.theme_color }}
              />
              <span className="font-mono text-xs">{business.theme_color}</span>
            </div>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text3)' }}>Created</span>
            <span className="font-medium">{formatDate(business.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text3)' }}>Updated</span>
            <span className="font-medium">{formatDate(business.updated_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => openEditModal(business)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-[var(--accent-light)]"
            style={{ border: '1px solid var(--border)' }}
          >
            <Edit size={18} />
            <span className="font-medium">Edit Business</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all hover:bg-[var(--accent-light)]"
              style={{ border: '1px solid var(--border)', fontSize: '0.875rem' }}
            >
              <Users size={16} />
              <span>Users</span>
            </button>
            <button
              onClick={() => {
                setEditingBusiness(business)
                setShowSettingsModal(true)
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all hover:bg-[var(--accent-light)]"
              style={{ border: '1px solid var(--border)', fontSize: '0.875rem' }}
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setEditingBusiness(business)
                setShowLogoUploadModal(true)
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all hover:bg-[var(--accent-light)]"
              style={{ border: '1px solid var(--border)', fontSize: '0.875rem' }}
            >
              <ImageIcon size={16} />
              <span>Upload Logo</span>
            </button>
            <button
              onClick={() => handleDelete(business.id)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all hover:bg-red-500/10"
              style={{ border: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--red)' }}
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          </div>
        </div>

      </motion.div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2><Building2 size={20} />Business Management</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text3)', marginTop: '4px' }}>
            Manage all businesses, branding, currencies, users and settings.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus size={20} />
          Add Business
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="card" style={{ 
          padding: '16px', 
          marginBottom: '24px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: 'var(--red)'
        }}>
          {error}
        </div>
      )}

      {/* Statistics Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            <Building2 />
          </div>
          <div className="stat-label">Businesses</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{businesses.length}</div>
          <div className="stat-sub">Total organizations</div>
        </div>
      </div>

      {/* Business Grid */}
      {businesses.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {businesses.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card max-w-md w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Create New Business</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-[var(--border)] rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Business Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--bg2)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                    placeholder="My Business"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
                    className="w-full px-4 py-3 bg-[var(--bg2)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="TZS">TZS (TSh)</option>
                    <option value="KSH">KSH (KSh)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">Brand Color</label>
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, themeColor: color })}
                        className={`w-full aspect-square rounded-xl transition-all ${
                          formData.themeColor === color ? 'ring-2 ring-offset-2 ring-offset-[var(--bg)] ring-[var(--accent)]' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.themeColor}
                      onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                      className="w-12 h-12 rounded-xl cursor-pointer"
                    />
                    <span className="text-sm font-mono">{formData.themeColor}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-3 border border-[var(--border)] rounded-xl hover:bg-[var(--bg2)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 btn btn-primary"
                  >
                    {loading ? 'Creating...' : 'Create Business'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && editingBusiness && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card max-w-md w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Edit Business</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 hover:bg-[var(--border)] rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Business Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--bg2)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
                    className="w-full px-4 py-3 bg-[var(--bg2)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="TZS">TZS (TSh)</option>
                    <option value="KSH">KSH (KSh)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">Brand Color</label>
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, themeColor: color })}
                        className={`w-full aspect-square rounded-xl transition-all ${
                          formData.themeColor === color ? 'ring-2 ring-offset-2 ring-offset-[var(--bg)] ring-[var(--accent)]' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.themeColor}
                      onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                      className="w-12 h-12 rounded-xl cursor-pointer"
                    />
                    <span className="text-sm font-mono">{formData.themeColor}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-3 border border-[var(--border)] rounded-xl hover:bg-[var(--bg2)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 btn btn-primary"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logo Upload Modal */}
      <AnimatePresence>
        {showLogoUploadModal && editingBusiness && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card max-w-md w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Upload Logo</h3>
                <button
                  onClick={() => setShowLogoUploadModal(false)}
                  className="p-2 hover:bg-[var(--border)] rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div
                className="p-8 rounded-xl border-2 border-dashed text-center"
                style={{ borderColor: 'var(--border)' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files[0]
                  if (file && file.type.startsWith('image/')) {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*'
                    input.files = e.dataTransfer.files
                    handleLogoUpload({ target: input } as any, editingBusiness)
                  }
                }}
              >
                <Upload size={48} className="mx-auto mb-4" style={{ color: 'var(--accent)' }} />
                <div className="font-medium mb-2">Drag logo here</div>
                <div className="text-sm mb-4" style={{ color: 'var(--text3)' }}>
                  or <span className="underline cursor-pointer" onClick={() => fileInputRef.current?.click()}>Browse Files</span>
                </div>
                <div className="text-xs mb-4" style={{ color: 'var(--text3)' }}>PNG JPG SVG • Maximum 5 MB</div>
                {isUploading && (
                  <div className="mt-4">
                    <div className="text-sm font-medium" style={{ color: 'var(--accent)' }}>{uploadProgress}%</div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleLogoUpload(e, editingBusiness)}
                  disabled={isUploading}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && editingBusiness && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card max-w-md w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Business Settings</h3>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-[var(--border)] rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl" style={{ background: 'var(--bg2)' }}>
                  <div className="text-sm font-medium mb-2">Business ID</div>
                  <div className="text-xs font-mono" style={{ color: 'var(--text3)' }}>{editingBusiness.id}</div>
                </div>

                <div className="p-4 rounded-xl" style={{ background: 'var(--bg2)' }}>
                  <div className="text-sm font-medium mb-2">Owner ID</div>
                  <div className="text-xs font-mono" style={{ color: 'var(--text3)' }}>{editingBusiness.owner_id}</div>
                </div>

                <div className="p-4 rounded-xl" style={{ background: 'var(--bg2)' }}>
                  <div className="text-sm font-medium mb-2">Created</div>
                  <div className="text-sm" style={{ color: 'var(--text2)' }}>{formatDate(editingBusiness.created_at)}</div>
                </div>

                <div className="p-4 rounded-xl" style={{ background: 'var(--bg2)' }}>
                  <div className="text-sm font-medium mb-2">Last Updated</div>
                  <div className="text-sm" style={{ color: 'var(--text2)' }}>{formatDate(editingBusiness.updated_at)}</div>
                </div>

                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full px-4 py-3 border border-[var(--border)] rounded-xl hover:bg-[var(--bg2)] transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
