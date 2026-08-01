import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBusiness } from '../contexts/BusinessContext'
import { useAuth } from '../contexts/AuthContext'
import { uploadBusinessLogo, deleteBusinessLogo } from '../lib/logoUpload'
import { Building2, Plus, Edit2, Trash2, X, Upload, Check, Settings, Users, Calendar, Clock, DollarSign, Palette } from 'lucide-react'

export default function BusinessManagement() {
  const { businesses, currentBusiness, createBusiness, updateBusiness, deleteBusiness, refreshBusinesses } = useBusiness()
  const { user } = useAuth()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingBusiness, setEditingBusiness] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: '',
    themeColor: '#3B82F6',
    currency: 'USD' as 'USD' | 'TZS' | 'KSH'
  })

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
        setFormData({ name: '', themeColor: '#3B82F6', currency: 'USD' })
        await refreshBusinesses()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
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
        setFormData({ name: '', themeColor: '#3B82F6', currency: 'USD' })
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

  const handleLogoUpload = async (business: any, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const result = await uploadBusinessLogo(file, business.id)
      if (result.error) {
        setError(result.error)
      } else {
        // Update business with new logo URL
        await updateBusiness(business.id, { logo_url: result.url })
        await refreshBusinesses()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogoDelete = async (business: any) => {
    if (!confirm('Are you sure you want to remove the logo?')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      await deleteBusinessLogo(business.id)
      await updateBusiness(business.id, { logo_url: undefined })
      await refreshBusinesses()
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
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
  ]

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    hover: { y: -4, transition: { duration: 0.2 } }
  }

  const EmptyState = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 px-6"
    >
      <div className="w-32 h-32 mb-6 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center">
        <Building2 size={64} className="text-amber-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">No businesses yet</h2>
      <p className="text-gray-600 text-center max-w-md mb-8">
        Create your first business to start managing invoices, customers, products, and reports.
      </p>
      <button
        onClick={() => setShowCreateModal(true)}
        className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-8 py-3 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg hover:shadow-xl"
      >
        <Plus size={20} />
        Create Business
      </button>
    </motion.div>
  )

  const BusinessCard = ({ business }: { business: any }) => {
    const [isHovered, setIsHovered] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isUploading, setIsUploading] = useState(false)
    const [showActions, setShowActions] = useState(false)

    const handleLogoUploadWithProgress = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB')
        return
      }

      setIsUploading(true)
      setUploadProgress(0)

      // Simulate progress
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
        }, 500)
      }
    }

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.files = e.dataTransfer.files
        handleLogoUploadWithProgress({ target: input } as any)
      }
    }

    const isActive = currentBusiness?.id === business.id

    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover="hover"
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 shadow-2xl border transition-all duration-300 ${
          isActive ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-700 hover:border-gray-600'
        }`}
      >
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isActive 
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
              : 'bg-gray-700/50 text-gray-400 border border-gray-600'
          }`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Logo Section */}
        <div className="flex items-start gap-4 mb-6">
          <div 
            className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ 
              background: business.logo_url 
                ? 'transparent' 
                : `linear-gradient(135deg, ${business.theme_color}40, ${business.theme_color}20)`
            }}
          >
            {business.logo_url ? (
              <img 
                src={business.logo_url} 
                alt={business.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Building2 size={36} style={{ color: business.theme_color }} />
              </div>
            )}
            
            {isUploading && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-amber-400 text-sm font-semibold">{uploadProgress}%</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-white mb-1 truncate">{business.name}</h3>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <DollarSign size={14} />
              <span>{business.currency}</span>
            </div>
          </div>
        </div>

        {/* Brand Color Preview */}
        <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-gray-800/50">
          <div 
            className="w-10 h-10 rounded-lg shadow-lg"
            style={{ backgroundColor: business.theme_color }}
          />
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">Brand Color</div>
            <div className="text-sm font-mono text-gray-300">{business.theme_color}</div>
          </div>
          <Palette size={18} className="text-gray-500" />
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <Calendar size={14} />
            <span>Created: {formatDate(business.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Clock size={14} />
            <span>Updated: {formatDate(business.updated_at)}</span>
          </div>
        </div>

        {/* Role Badge */}
        {business._role && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Users size={14} />
              <span className="capitalize">Role: {business._role}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(business)}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-xl transition-all duration-200 group"
            aria-label="Edit business"
          >
            <Edit2 size={16} className="group-hover:text-amber-400 transition-colors" />
            <span className="text-sm font-medium">Edit</span>
          </button>

          <label className="flex-1 flex items-center justify-center gap-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer group">
            <Upload size={16} className="group-hover:text-amber-400 transition-colors" />
            <span className="text-sm font-medium">Logo</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUploadWithProgress}
              disabled={isUploading}
            />
          </label>

          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-xl transition-all duration-200"
            aria-label="More actions"
          >
            <Settings size={16} />
          </button>
        </div>

        {/* Expandable Actions */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-gray-700"
            >
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowActions(false)
                    // Navigate to business settings
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-800/50 hover:bg-gray-800 text-gray-400 px-3 py-2 rounded-lg transition-all text-sm"
                >
                  <Settings size={14} />
                  Settings
                </button>
                {business._role === 'owner' && (
                  <button
                    onClick={() => {
                      setShowActions(false)
                      // Navigate to user management
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-800/50 hover:bg-gray-800 text-gray-400 px-3 py-2 rounded-lg transition-all text-sm"
                  >
                    <Users size={14} />
                    Users
                  </button>
                )}
                {business.logo_url && (
                  <button
                    onClick={() => {
                      setShowActions(false)
                      handleLogoDelete(business)
                    }}
                    className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-lg transition-all text-sm"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Button (Owner Only) */}
        {business._role === 'owner' && (
          <button
            onClick={() => handleDelete(business.id)}
            className="absolute bottom-4 right-4 p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            aria-label="Delete business"
          >
            <Trash2 size={16} />
          </button>
        )}
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-[1400px] mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Business Management</h1>
              <p className="text-gray-400 text-lg">
                Manage your businesses, currencies, branding, and settings from one place.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-3 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg hover:shadow-xl hover:shadow-amber-500/20"
            >
              <Plus size={20} />
              <span className="font-semibold">Add Business</span>
            </button>
          </div>
        </motion.div>

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Business Grid */}
        {businesses.length === 0 ? (
          <EmptyState />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {businesses.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </motion.div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-700"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Create New Business</h2>
                    <p className="text-gray-400 text-sm mt-1">Set up your business profile</p>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Close modal"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Business Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-white placeholder-gray-500 transition-all"
                      placeholder="My Business"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-white transition-all"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="TZS">TZS (TSh)</option>
                      <option value="KSH">KSH (KSh)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Theme Color
                    </label>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      {colorOptions.map((color) => (
                        <motion.button
                          key={color}
                          type="button"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setFormData({ ...formData, themeColor: color })}
                          className={`w-full aspect-square rounded-xl transition-all ${
                            formData.themeColor === color 
                              ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-amber-500' 
                              : 'hover:ring-2 hover:ring-offset-2 hover:ring-offset-gray-900 hover:ring-gray-500'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Select color ${color}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={formData.themeColor}
                        onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                        className="w-12 h-12 rounded-xl cursor-pointer bg-transparent"
                      />
                      <span className="text-sm text-gray-400 font-mono">{formData.themeColor}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 px-4 py-3 border border-gray-700 text-gray-300 rounded-xl hover:bg-gray-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-3 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                      {loading ? 'Creating...' : 'Create Business'}
                    </button>
                  </div>
                </form>
              </div>
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-700"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Edit Business</h2>
                    <p className="text-gray-400 text-sm mt-1">Update your business settings</p>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Close modal"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleEdit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Business Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-white transition-all"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="TZS">TZS (TSh)</option>
                      <option value="KSH">KSH (KSh)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Theme Color
                    </label>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      {colorOptions.map((color) => (
                        <motion.button
                          key={color}
                          type="button"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setFormData({ ...formData, themeColor: color })}
                          className={`w-full aspect-square rounded-xl transition-all ${
                            formData.themeColor === color 
                              ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-amber-500' 
                              : 'hover:ring-2 hover:ring-offset-2 hover:ring-offset-gray-900 hover:ring-gray-500'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Select color ${color}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={formData.themeColor}
                        onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                        className="w-12 h-12 rounded-xl cursor-pointer bg-transparent"
                      />
                      <span className="text-sm text-gray-400 font-mono">{formData.themeColor}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="flex-1 px-4 py-3 border border-gray-700 text-gray-300 rounded-xl hover:bg-gray-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-3 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
